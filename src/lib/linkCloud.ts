/**
 * 资源链接墙 · 云端补充
 * ------------------------------------------------------------------
 * 与「克拉动态」的补充动态同一套 Supabase Storage 轻客户端架构，
 * 但使用独立的 `reslinks/` 前缀，互不干扰：
 *   - 每条访客补充的链接 = 云端的 1 个 JSON 文件，扁平存放在 `reslinks/` 下。
 *   - 一次 list 即可拿到全部，人人可见、人人可补充。
 *   - 文件名含时间戳与随机串，天然唯一；提交用 x-upsert:false，绝不覆盖已有内容。
 *   - 渲染时按 url 去重，避免重复链接出现多次。
 */
import { CLOUD_CONFIG, isCloudEnabled } from '@/config/cloud';

export interface ResLink {
  /** 云端文件名，同时作为唯一 id（含 reslinks/ 前缀） */
  id: string;
  title: string;
  url: string;
  note?: string;
  platform: string;
  publisherId: string;
  timestamp: number;
}

interface StoredResLink {
  title: string;
  url: string;
  note?: string;
  platform: string;
  publisherId: string;
  timestamp: number;
}

const SEP = '__';
const PREFIX = 'reslinks/';
const LIST_LIMIT = 1000;
const LOCAL_KEY = 'reslinks_local';

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

function bust(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
}

const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'cache-control': 'no-cache, no-store, must-revalidate',
};

function buildName(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${PREFIX}link${SEP}${Date.now()}${SEP}${rand}.json`;
}

/** 从链接自动识别平台 */
export function detectLinkPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('bilibili.com') || u.includes('b23.tv')) return 'bilibili';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('xiaohongshu.com') || u.includes('xhslink')) return 'xiaohongshu';
  if (u.includes('weibo.com')) return 'weibo';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('douyin.com')) return 'douyin';
  if (u.includes('weverse.io')) return 'weverse';
  if (u.includes('twitter.com') || u.includes('x.com')) return 'x';
  return 'other';
}

function loadLocal(): ResLink[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ResLink[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLocal(list: ResLink[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* 容量满则忽略 */
  }
}

export function resLinkPublisherId(): string {
  try {
    const KEY = 'svt_reslink_id';
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

/** 拉取云端全部补充链接（按时间倒序） */
export async function listResLinks(signal?: AbortSignal): Promise<ResLink[]> {
  if (!isCloudEnabled()) return loadLocal();
  try {
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
    if (!res.ok) return loadLocal();
    const rows: Array<{ name?: string }> = await res.json();
    if (!Array.isArray(rows)) return loadLocal();
    const names: string[] = [];
    for (const row of rows) {
      const n = row?.name;
      if (n && n.endsWith('.json')) names.push(n.startsWith(PREFIX) ? n : PREFIX + n);
    }
    const items = await Promise.all(
      names.map(async (name): Promise<ResLink | null> => {
        try {
          const r = await fetch(bust(`${base()}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/${name}`), {
            signal,
            cache: 'no-store',
          });
          if (!r.ok) return null;
          const d = (await r.json()) as StoredResLink;
          if (!d || typeof d.url !== 'string' || !d.title) return null;
          return {
            id: name,
            title: d.title,
            url: d.url,
            note: d.note,
            platform: d.platform || detectLinkPlatform(d.url),
            publisherId: String(d.publisherId ?? ''),
            timestamp: Number(d.timestamp) || Date.now(),
          };
        } catch {
          return null;
        }
      })
    );
    const cloud = items.filter((x): x is ResLink => x !== null).sort((a, b) => b.timestamp - a.timestamp);
    // 云端优先，本地兜底（网络失败时的离线内容）合并去重
    const local = loadLocal().filter((l) => !cloud.some((c) => c.url === l.url));
    return [...cloud, ...local];
  } catch {
    return loadLocal();
  }
}

/** 发布一条补充链接到云端（不覆盖、不修改任何既有内容） */
export async function uploadResLink(u: Omit<ResLink, 'id'>): Promise<ResLink> {
  const name = buildName();
  const body: StoredResLink = {
    title: u.title,
    url: u.url,
    note: u.note,
    platform: u.platform,
    publisherId: u.publisherId,
    timestamp: u.timestamp,
  };
  if (!isCloudEnabled()) {
    const local = loadLocal();
    const item: ResLink = { id: name, ...u };
    saveLocal([...local, item]);
    return item;
  }
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

/** 删除云端一条补充链接（仅发布者本人可调用） */
export async function deleteResLink(name: string): Promise<void> {
  if (!isCloudEnabled()) {
    const local = loadLocal().filter((l) => l.id !== name);
    saveLocal(local);
    return;
  }
  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`删除失败 (${res.status})`);
}
