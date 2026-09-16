import { CLOUD_CONFIG, isCloudEnabled } from '@/config/cloud';
import type { Platform, UpdateKind, UpdateCategory, MediaItem } from '@/data/updates';
import { uploadMediaToR2 } from '@/lib/r2Storage';

/**
 * 克拉动态 · 云端手动补充
 * ------------------------------------------------------------------
 * 复用克拉SAY 的 Supabase Storage 轻客户端（与「次人语录」同一套架构）：
 *   - 每条访客补充的动态 = 云端的 1 个 JSON 文件，扁平存放在 `updates/` 前缀下。
 *   - 一次 list 即可拿到全部，人人可见、人人可补充，与基础的「同步」数据合并展示。
 *   - 文件名含时间戳与随机串，天然唯一；提交用 x-upsert:false，绝不覆盖已有内容。
 *   - 合并展示时由前端按 URL 去重（重复的只出现一个）。
 *
 * 文件名约定：
 *   updates/{who}__{timestamp}__{random}.json
 *   例：updates/joshua__1755000000000__k3f9ab.json
 * 文件内容（JSON）：完整 UpdateItem 字段 + publisherId / timestamp
 */

export interface CloudUpdate {
  /** 云端文件名，同时作为唯一 id（含 updates/ 前缀） */
  id: string;
  category: UpdateCategory;
  memberId: string | null;
  /** 多人共创：一条动态关联的多位成员 id；单选时为空，回退 memberId */
  memberIds?: string[] | null;
  platform: Platform;
  kind: UpdateKind;
  title: string;
  description?: string;
  date: string; // ISO — 上传时间（用户复制链接提交的那一刻）
  publishedAt?: string; // 链接本身的原始发布时间（可选，仅作辅助展示）
  url: string;
  media?: MediaItem[];
  publisherId: string;
  timestamp: number;
}

const SEP = '__';
const PREFIX = 'updates/';
const LIST_LIMIT = 1000;
const LOCAL_KEY = 'updates_local';

interface StoredUpdate {
  category: UpdateCategory;
  memberId: string | null;
  memberIds?: string[] | null;
  platform: Platform;
  kind: UpdateKind;
  title: string;
  description?: string;
  date: string;
  publishedAt?: string;
  url: string;
  media?: MediaItem[];
  publisherId: string;
  timestamp: number;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: CLOUD_CONFIG.anonKey,
    Authorization: `Bearer ${CLOUD_CONFIG.anonKey}`,
    ...extra,
  };
}

function base(): string {
  return CLOUD_CONFIG.url.replace(/\/+$/, '');
}

/**
 * 读取云端 JSON 时绕过一切缓存。
 * ------------------------------------------------------------------
 * 背景（踩过的坑）：早期版本在写入索引文件时带了 `cache-control: max-age=31536000`，
 * 导致手机上传的照片/视频登记后，电脑端浏览器仍拿着一年前的旧副本，永远看不到新内容。
 * 因此这里读取一律 `cache: 'no-store'` + 时间戳参数，双重确保拿到的是最新数据。
 */
function bust(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
}

/** 索引类 JSON 的写入头：内容会频繁变动，禁止任何缓存 */
const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'cache-control': 'no-cache, no-store, must-revalidate',
};

/** 生成新文件名（who / 数字 / base36 均为 URL 安全字符） */
function buildName(who: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${PREFIX}${who}${SEP}${Date.now()}${SEP}${rand}.json`;
}

/** 本机稳定发布者 id（用于「仅自己可见删除按钮」判定） */
export function publisherId(): string {
  try {
    const KEY = 'svt_pub_id';
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = 'u' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

/** 从链接自动识别平台 */
export function detectPlatform(url: string): Platform {
  const u = url.toLowerCase();
  if (u.includes('xiaohongshu.com') || u.includes('xhslink')) return 'xiaohongshu';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('bilibili.com') || u.includes('b23.tv')) return 'bilibili';
  if (u.includes('weibo.com')) return 'weibo';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('douyin.com')) return 'douyin';
  if (u.includes('weverse.io')) return 'weverse';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'x';
  return 'other';
}

/** 读取本地缓存（离线 / 云端未连时的兜底） */
function loadLocal(): CloudUpdate[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CloudUpdate[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLocal(list: CloudUpdate[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* 容量满则忽略 */
  }
}

/** 拉取云端全部补充动态（并行读取内容，按时间倒序） */
export async function listCloudUpdates(signal?: AbortSignal): Promise<CloudUpdate[]> {
  if (!isCloudEnabled()) return [];
  const res = await fetch(`${base()}/storage/v1/object/list/${CLOUD_CONFIG.bucket}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      prefix: PREFIX,
      limit: LIST_LIMIT,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`云端读取失败 (${res.status})`);
  const rows: Array<{ name?: string }> = await res.json();
  if (!Array.isArray(rows)) return [];
  const names: string[] = [];
  for (const row of rows) {
    const n = row?.name;
    // Supabase list 返回的 name 不含 prefix（相对路径），这里统一补全，确保可读
    if (n && n.endsWith('.json')) names.push(n.startsWith(PREFIX) ? n : PREFIX + n);
  }
  const items = await Promise.all(
    names.map(async (name): Promise<CloudUpdate | null> => {
      try {
        const r = await fetch(bust(`${base()}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/${name}`), {
          signal,
          cache: 'no-store',
        });
        if (!r.ok) return null;
        const d = (await r.json()) as StoredUpdate;
        if (!d || typeof d.url !== 'string' || !d.title) return null;
        return {
          id: name,
          category: d.category,
          memberId: d.memberId ?? null,
          memberIds: d.memberIds ?? null,
          platform: d.platform,
          kind: d.kind,
          title: d.title,
          description: d.description,
          date: d.date,
          publishedAt: d.publishedAt,
          url: d.url,
          media: Array.isArray(d.media) ? d.media : undefined,
          publisherId: String(d.publisherId ?? ''),
          timestamp: Number(d.timestamp) || Date.now(),
        };
      } catch {
        return null;
      }
    })
  );
  return items.filter((x): x is CloudUpdate => x !== null).sort((a, b) => b.timestamp - a.timestamp);
}

/** 发布一条补充动态到云端（不覆盖、不修改任何既有内容） */
export async function uploadCloudUpdate(u: Omit<CloudUpdate, 'id'>): Promise<CloudUpdate> {
  if (!isCloudEnabled()) throw new Error('云端未配置');
  const who = u.memberId ?? u.category;
  const name = buildName(who);
  const body: StoredUpdate = {
    category: u.category,
    memberId: u.memberId,
    memberIds: u.memberIds,
    platform: u.platform,
    kind: u.kind,
    title: u.title,
    description: u.description,
    date: u.date,
    url: u.url,
    media: u.media,
    publisherId: u.publisherId,
    timestamp: u.timestamp,
  };
  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'POST',
    headers: authHeaders({ ...NO_CACHE_HEADERS, 'x-upsert': 'false' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const rbody = await res.json();
      detail = rbody?.message || rbody?.error || '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `发布失败 (${res.status})`);
  }
  return { id: name, ...u };
}

/** 更新（覆盖）云端一条补充动态。
 *  仅用于编辑场景：保留原 publisherId / timestamp，允许发布者本人或建设者修改
 *  title / description / date / publishedAt。 */
export async function updateCloudUpdate(u: CloudUpdate): Promise<CloudUpdate> {
  if (!isCloudEnabled()) throw new Error('云端未配置');
  const body: StoredUpdate = {
    category: u.category,
    memberId: u.memberId,
    memberIds: u.memberIds,
    platform: u.platform,
    kind: u.kind,
    title: u.title,
    description: u.description,
    date: u.date,
    publishedAt: u.publishedAt,
    url: u.url,
    media: u.media,
    publisherId: u.publisherId,
    timestamp: u.timestamp,
  };
  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${u.id}`, {
    method: 'POST',
    headers: authHeaders({ ...NO_CACHE_HEADERS, 'x-upsert': 'true' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const rbody = await res.json();
      detail = rbody?.message || rbody?.error || '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `更新失败 (${res.status})`);
  }
  return u;
}

/** 删除云端一条补充动态（仅发布者本人或建设者可调用） */
export async function deleteCloudUpdate(name: string): Promise<void> {
  if (!isCloudEnabled()) throw new Error('云端未配置');
  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`删除失败 (${res.status})`);
}

/* ── 全量编辑覆盖层（edits overlay） ────────────────────
   硬编码动态（updates.ts）与云端同步动态（yt-/bili-/wb-）没有「自己的文件」，
   无法直接改写。改为把「编辑结果」存到一个独立的覆盖层（按 item.id 索引），
   渲染时套用。这样同步云函数每 30 分钟重写 live-feeds.json 也不会冲掉编辑。
   存储：Supabase `meta/feed-edits/{safeId}.json`（每条独立文件，避免互相覆盖）。
   写入：anon 不能 upsert，故 DELETE + INSERT。 */
export interface FeedEdit {
  title?: string;
  description?: string;
  date?: string;
  publishedAt?: string;
  url?: string;
  media?: MediaItem[];
  deleted?: boolean;
  /** 编辑时也可改「所属 / 多人共创」成员归属 */
  category?: UpdateCategory;
  memberId?: string | null;
  memberIds?: string[] | null;
}

const EDIT_PREFIX = 'meta/feed-edits/';

/** item.id 转成文件名安全的字符串（id 一般含字母/数字/-，这里兜底替换其余字符） */
export function encodeItemKey(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

/** 读取全部编辑覆盖层，返回 { itemId: FeedEdit } 映射 */
export async function listFeedEdits(): Promise<Record<string, FeedEdit>> {
  if (!isCloudEnabled()) return {};
  try {
    const res = await fetch(`${base()}/storage/v1/object/list/${CLOUD_CONFIG.bucket}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: EDIT_PREFIX, limit: 1000, offset: 0 }),
    });
    if (!res.ok) return {};
    const rows: Array<{ name?: string }> = await res.json();
    if (!Array.isArray(rows)) return {};
    const map: Record<string, FeedEdit> = {};
    await Promise.all(
      rows.map(async (row) => {
        const n = row?.name;
        if (!n || !n.endsWith('.json')) return;
        const id = n.slice(EDIT_PREFIX.length, -'.json'.length);
        if (!id) return;
        try {
          const r = await fetch(bust(`${base()}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/${n}`), {
            cache: 'no-store',
          });
          if (!r.ok) return;
          const d = (await r.json()) as FeedEdit;
          if (d && typeof d === 'object') map[id] = d;
        } catch {
          /* 单条失败忽略 */
        }
      }),
    );
    return map;
  } catch {
    return {};
  }
}

/** 保存一条编辑覆盖层（先删后插，绕开 anon 不能 upsert 的限制） */
export async function saveFeedEdit(id: string, edit: FeedEdit): Promise<void> {
  if (!isCloudEnabled()) return;
  const name = `${EDIT_PREFIX}${encodeItemKey(id)}.json`;
  await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).catch(() => {
    /* 文件不存在忽略 */
  });
  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'POST',
    headers: authHeaders({ ...NO_CACHE_HEADERS, 'x-upsert': 'false' }),
    body: JSON.stringify(edit),
  });
  if (!res.ok) throw new Error(`保存编辑失败 (${res.status})`);
}

/** 删除一条编辑覆盖层（还原为原始内容） */
export async function deleteFeedEdit(id: string): Promise<void> {
  if (!isCloudEnabled()) return;
  const name = `${EDIT_PREFIX}${encodeItemKey(id)}.json`;
  await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).catch(() => {
    /* 已不存在忽略 */
  });
}

/* ── 媒体文件上传 ───────────────────────────────────────
   把用户选择的图片 / 视频上传到 Supabase Storage `media/` 前缀，
   返回公开访问 URL，供动态引用。 */
const MEDIA_PREFIX = 'media/';
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB
/* 超过此阈值改用 TUS 分片上传，绕过 Supabase 单次直传 6MB / 20MB 限制 */
const TUS_THRESHOLD = 6 * 1024 * 1024; // 6 MB
const TUS_CHUNK_SIZE = 6 * 1024 * 1024; // Supabase 推荐固定 6MB

function mediaFileName(file: File): string {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const rand = Math.random().toString(36).slice(2, 8);
  const ts = Date.now();
  return `${MEDIA_PREFIX}${ts}_${rand}_${safe}`;
}

function guessMediaType(file: File): 'image' | 'video' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return 'video';
  return 'image';
}

/** TUS Upload-Metadata 要求 value 用 base64 */
function b64Metadata(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

/** 上传用大文件直连域名：project-id.supabase.co -> project-id.storage.supabase.co */
function storageBase(): string {
  const b = base();
  if (b.includes('.storage.supabase.co')) return b;
  return b.replace(/\.supabase\.co$/, '.storage.supabase.co');
}

/** TUS 第一步：创建上传会话，返回 Location */
async function tusCreateUpload(file: File, name: string): Promise<string> {
  const metadata = [
    `bucketName ${b64Metadata(CLOUD_CONFIG.bucket)}`,
    `objectName ${b64Metadata(name)}`,
    `contentType ${b64Metadata(file.type || 'application/octet-stream')}`,
    `cacheControl ${b64Metadata('31536000')}`,
  ].join(',');
  const res = await fetch(`${storageBase()}/storage/v1/upload/resumable`, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata,
      'x-upsert': 'false',
    },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const rbody = await res.json();
      detail = rbody?.message || rbody?.error || '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `TUS 初始化失败 (${res.status})`);
  }
  const location = res.headers.get('Location') || res.headers.get('location');
  if (!location) throw new Error('TUS 初始化未返回上传地址');
  return location;
}

/** TUS 第二步：按 6MB 分片 PATCH 上传 */
async function tusUploadFile(file: File, name: string): Promise<void> {
  const uploadUrl = await tusCreateUpload(file, name);
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + TUS_CHUNK_SIZE, file.size);
    const chunk = file.slice(offset, end);
    const res = await fetch(uploadUrl, {
      method: 'PATCH',
      headers: {
        ...authHeaders(),
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': String(offset),
        'Content-Type': 'application/offset+octet-stream',
      },
      body: chunk,
    });
    if (!res.ok) {
      let detail = '';
      try {
        const rbody = await res.json();
        detail = rbody?.message || rbody?.error || '';
      } catch {
        /* ignore */
      }
      throw new Error(detail || `分片上传失败 (${res.status})`);
    }
    const next = res.headers.get('Upload-Offset') || res.headers.get('upload-offset');
    offset = next ? Number(next) : end;
  }
}

export async function uploadMediaFile(file: File): Promise<MediaItem> {
  if (!isCloudEnabled()) throw new Error('云端未配置');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('文件超过 50MB 上限');
  /* 永久化方案：若启用 Cloudflare R2（Vercel 部署时 VITE_R2_ENABLED=true），
     媒体直接传到 R2，绕开 Supabase 存储配额；JSON 动态索引仍走 Supabase。 */
  if (import.meta.env.VITE_R2_ENABLED === 'true') {
    return uploadMediaToR2(file);
  }
  const name = mediaFileName(file);
  /* 大文件走 TUS 分片，小文件保持原直传以节省一次 HTTP 请求 */
  if (file.size > TUS_THRESHOLD) {
    await tusUploadFile(file, name);
  } else {
    const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
      method: 'POST',
      headers: authHeaders({
        'Content-Type': file.type || 'application/octet-stream',
        'cache-control': 'max-age=31536000',
        'x-upsert': 'false',
      }),
      body: file,
    });
    if (!res.ok) {
      let detail = '';
      try {
        const rbody = await res.json();
        detail = rbody?.message || rbody?.error || '';
      } catch {
        /* ignore */
      }
      throw new Error(detail || `上传失败 (${res.status})`);
    }
  }
  return {
    url: `${base()}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/${name}`,
    type: guessMediaType(file),
    name: file.name,
  };
}

export const localStore = { loadLocal, saveLocal };

/* ── 媒体叠加层（多人各自累积，互不覆盖） ──────────────
   一条动态可能被多位访客各上传若干照片 / 视频。为避免「谁后传谁覆盖」，
   每位访客的媒体独立存放：
     meta/media/{safeItemId}/{publisherId}.json  ->  { media: MediaItem[] }
   渲染时把该 item 下所有访客的 media 合并展示；删除仅作用于「自己那份」，不影响他人。
   一次 list `meta/media/` 即可取回全部 item 的全部访客媒体，前端按 safeItemId / publisherId 分组。 */
export type MediaOverlayMap = Record<string, Record<string, MediaItem[]>>; // safeItemId -> publisherId -> media[]

const MEDIA_OVERLAY_PREFIX = 'meta/media/';

/** 列出全部媒体叠加层，返回 { safeItemId: { publisherId: MediaItem[] } }
 *  存储结构为两级：meta/media/{safeItemId}/{publisherId}.json
 *  Supabase 的 object/list 在 prefix 下只返回「直接子项」——即每个 item 的文件夹名，
 *  不会递归返回深层文件。因此要先列一级文件夹（safeItemId），再逐个列其下的访客 json。 */
export async function listAllMediaOverlays(): Promise<MediaOverlayMap> {
  if (!isCloudEnabled()) return {};
  try {
    // 1) 列出 meta/media/ 下的 item 文件夹
    const res = await fetch(`${base()}/storage/v1/object/list/${CLOUD_CONFIG.bucket}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix: MEDIA_OVERLAY_PREFIX, limit: 1000, offset: 0 }),
    });
    if (!res.ok) return {};
    const folders: Array<{ name?: string }> = await res.json();
    if (!Array.isArray(folders)) return {};
    const map: MediaOverlayMap = {};
    await Promise.all(
      folders.map(async (folder) => {
        const safeId = folder?.name;
        if (!safeId) return;
        // 2) 列出 meta/media/{safeId}/ 下的访客 json 文件
        const r2 = await fetch(`${base()}/storage/v1/object/list/${CLOUD_CONFIG.bucket}`, {
          method: 'POST',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ prefix: `${MEDIA_OVERLAY_PREFIX}${safeId}/`, limit: 1000, offset: 0 }),
        });
        if (!r2.ok) return;
        const files = (await r2.json()) as Array<{ name?: string }>;
        if (!Array.isArray(files)) return;
        await Promise.all(
          files.map(async (file) => {
            const fn = file?.name;
            if (!fn || !fn.endsWith('.json')) return;
            const pubId = fn.slice(0, -'.json'.length);
            try {
              const r = await fetch(
                bust(
                  `${base()}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/${MEDIA_OVERLAY_PREFIX}${safeId}/${fn}`
                ),
                { cache: 'no-store' }
              );
              if (!r.ok) return;
              const d = (await r.json()) as { media?: MediaItem[] };
              if (!d || !Array.isArray(d.media)) return;
              map[safeId] = map[safeId] || {};
              map[safeId][pubId] = d.media;
            } catch {
              /* 单条失败忽略 */
            }
          })
        );
      })
    );
    return map;
  } catch {
    return {};
  }
}

/** 保存某访客对某 item 的媒体（先删后插，仅改写自己那份文件，绝不触碰他人） */
export async function saveMyMedia(safeId: string, pubId: string, media: MediaItem[]): Promise<void> {
  if (!isCloudEnabled()) return;
  const name = `${MEDIA_OVERLAY_PREFIX}${safeId}/${pubId}.json`;
  await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'DELETE',
    headers: authHeaders(),
  }).catch(() => {
    /* 文件不存在忽略 */
  });
  if (media.length === 0) return; // 全部删除则移除文件
  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'POST',
    headers: authHeaders({ ...NO_CACHE_HEADERS, 'x-upsert': 'false' }),
    body: JSON.stringify({ media }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const rbody = await res.json();
      detail = rbody?.message || rbody?.error || '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `保存媒体失败 (${res.status})`);
  }
}
