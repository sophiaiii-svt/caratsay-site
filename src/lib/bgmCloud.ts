import { CLOUD_CONFIG, isCloudEnabled } from '@/config/cloud';
import { publisherId } from '@/lib/updateCloud';

/**
 * 克拉SAY 背景音乐库 —— Supabase Storage 轻客户端（直接走 REST，不引 SDK）
 *
 * 存储约定：
 *   bgm/playlist.json        -> { v: 1, tracks: BgmTrack[] }   播放列表（索引，禁缓存）
 *   bgm/audio/{ts}_{rand}_{name}.mp3  -> 音频二进制（内容不变，长缓存）
 *
 * 权限：bucket 对 anon 开放读；写入 / 删除已实测通过（HTTP 200），
 * 因此所有访客都能上传曲目、所有人可见。删除仅作用于「自己上传的」曲目。
 */

export type BgmSource = 'cloud' | 'link' | 'builtin';
/** 场景：与克拉SAY 的三种视图对应，切换视图时可自动换到该场景的曲目 */
export type BgmScene = 'grid' | 'book' | 'slideshow';

export interface BgmTrack {
  id: string;
  title: string;
  artist?: string;
  /** 播放地址：云端 mp3 / 外链 URL / 本地 /audio/xxx.mp3 */
  url: string;
  source: BgmSource;
  /** 归属场景，可选。留空表示「通用曲目」 */
  scene?: BgmScene;
  /** 上传者 id —— 用于判断能否删除（仅自己可删） */
  addedBy?: string;
  addedAt?: number;
}

const PLAYLIST_KEY = 'bgm/playlist.json';
const AUDIO_PREFIX = 'bgm/audio/';
const MAX_AUDIO_BYTES = 30 * 1024 * 1024; // 30MB
const LOCAL_KEY = 'caratsay_bgm_tracks';

function base(): string {
  return CLOUD_CONFIG.url.replace(/\/+$/, '');
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: CLOUD_CONFIG.anonKey,
    Authorization: `Bearer ${CLOUD_CONFIG.anonKey}`,
    ...extra,
  };
}

/** 索引 JSON 会被频繁覆盖，读取必须绕开一切缓存 */
function bust(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}_t=${Date.now()}`;
}

const NO_CACHE_HEADERS = {
  'Content-Type': 'application/json',
  'cache-control': 'no-cache, no-store, must-revalidate',
};

/* ── 本地兜底：云端不可用时，用户添加的曲目暂存浏览器 ── */
export function loadLocalTracks(): BgmTrack[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as BgmTrack[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalTracks(tracks: BgmTrack[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(tracks));
  } catch {
    /* 容量不足时忽略 */
  }
}

/** 读取云端播放列表；失败返回 null（调用方据此决定用本地兜底） */
export async function listBgmPlaylist(): Promise<BgmTrack[] | null> {
  if (!isCloudEnabled()) return null;
  try {
    const res = await fetch(
      bust(`${base()}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/${PLAYLIST_KEY}`),
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { v?: number; tracks?: unknown };
    if (!d || !Array.isArray(d.tracks)) return null;
    return d.tracks.filter(
      (t): t is BgmTrack =>
        !!t && typeof (t as BgmTrack).url === 'string' && typeof (t as BgmTrack).title === 'string'
    );
  } catch {
    return null;
  }
}

/** 保存播放列表（anon 不能 upsert，故先删后插） */
export async function saveBgmPlaylist(tracks: BgmTrack[]): Promise<void> {
  if (!isCloudEnabled()) throw new Error('云端未配置');
  saveLocalTracks(tracks); // 无论云端成败，本地留一份

  try {
    await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${PLAYLIST_KEY}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch {
    /* 首次写入时文件不存在，忽略 */
  }

  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${PLAYLIST_KEY}`, {
    method: 'POST',
    headers: authHeaders(NO_CACHE_HEADERS),
    body: JSON.stringify({ v: 1, tracks, updatedAt: Date.now() }),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const b = await res.json();
      detail = b?.message || b?.error || '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `播放列表保存失败 (${res.status})`);
  }
}

function audioFileName(file: File): string {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${AUDIO_PREFIX}${Date.now()}_${rand}_${safe}`;
}

/** 上传音频文件，返回可直接播放的公开 URL */
export async function uploadBgmFile(file: File): Promise<{ url: string; name: string }> {
  if (!isCloudEnabled()) throw new Error('云端未配置');
  if (file.size > MAX_AUDIO_BYTES) throw new Error('文件超过 30MB 上限');

  const name = audioFileName(file);
  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': file.type || 'audio/mpeg',
      'cache-control': 'max-age=31536000',
      'x-upsert': 'false',
    }),
    body: file,
  });

  if (!res.ok) {
    let detail = '';
    try {
      const b = await res.json();
      detail = b?.message || b?.error || '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `音频上传失败 (${res.status})`);
  }
  return {
    url: `${base()}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/${name}`,
    name,
  };
}

/** 从公开 URL 反解出对象名，用于删除 */
function objectNameFromUrl(url: string): string | null {
  const marker = `/object/public/${CLOUD_CONFIG.bucket}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  return url.slice(i + marker.length).split('?')[0];
}

/** 删除云端音频文件（外链 URL 会静默跳过） */
export async function deleteBgmFile(url: string): Promise<void> {
  const name = objectNameFromUrl(url);
  if (!name || !name.startsWith(AUDIO_PREFIX)) return; // 非本站音频，不动
  if (!isCloudEnabled()) return;
  try {
    await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch {
    /* 删除失败不影响列表更新 */
  }
}

/** 新建一条曲目的工厂（统一 id / 归属 / 时间戳） */
export function makeTrack(init: {
  title: string;
  artist?: string;
  url: string;
  source: BgmSource;
  scene?: BgmScene;
}): BgmTrack {
  return {
    id: `bgm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: init.title,
    artist: init.artist,
    url: init.url,
    source: init.source,
    scene: init.scene,
    addedBy: publisherId(),
    addedAt: Date.now(),
  };
}

/** 当前访客是否有权删除这条曲目 */
export function canDeleteTrack(track: BgmTrack): boolean {
  return !track.addedBy || track.addedBy === publisherId();
}
