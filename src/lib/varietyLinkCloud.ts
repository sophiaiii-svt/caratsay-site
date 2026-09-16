/**
 * 综艺卡片真实跳转链接补充
 * ------------------------------------------------------------------
 * 与资源墙/动态同一套 Supabase Storage 架构，但使用独立的 `varietylinks/` 前缀。
 * 每个综艺条目（varietyId）的每个平台（youtube/bilibili）最多保留一条最新链接：
 *   - 文件名固定为 `varietylinks/{varietyId}-{platform}.json`
 *   - 上传时允许覆盖（x-upsert:true），新链接会替换旧链接
 *   - 读取时按 varietyId + platform 聚合，取 timestamp 最新的一条
 */
import { CLOUD_CONFIG, isCloudEnabled } from '@/config/cloud';

export interface VarietyLink {
  /** 云端文件名（含 varietylinks/ 前缀） */
  id: string;
  varietyId: string;
  platform: 'youtube' | 'bilibili' | string;
  url: string;
  publisherId: string;
  timestamp: number;
}

interface StoredVarietyLink {
  varietyId: string;
  platform: string;
  url: string;
  publisherId: string;
  timestamp: number;
}

const PREFIX = 'varietylinks/';
const LIST_LIMIT = 1000;
const LOCAL_KEY = 'varietylinks_local';

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

function fileName(varietyId: string, platform: string): string {
  return `${PREFIX}${varietyId}-${platform}.json`;
}

function loadLocal(): VarietyLink[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as VarietyLink[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveLocal(list: VarietyLink[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* 容量满则忽略 */
  }
}

export function varietyLinkPublisherId(): string {
  try {
    const KEY = 'svt_varietylink_id';
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

/** 拉取云端全部综艺补充链接，按 varietyId + platform 聚合取最新 */
export async function listVarietyLinks(signal?: AbortSignal): Promise<VarietyLink[]> {
  if (!isCloudEnabled()) return loadLocal();
  try {
    const res = await fetch(`${base()}/storage/v1/object/list/${CLOUD_CONFIG.bucket}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        prefix: PREFIX,
        limit: LIST_LIMIT,
        offset: 0,
        sortBy: { column: 'updated_at', order: 'desc' },
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
      names.map(async (name): Promise<VarietyLink | null> => {
        try {
          const r = await fetch(bust(`${base()}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/${name}`), {
            signal,
            cache: 'no-store',
          });
          if (!r.ok) return null;
          const d = (await r.json()) as StoredVarietyLink;
          if (!d || typeof d.url !== 'string' || !d.varietyId) return null;
          return {
            id: name,
            varietyId: d.varietyId,
            platform: d.platform || 'other',
            url: d.url,
            publisherId: String(d.publisherId ?? ''),
            timestamp: Number(d.timestamp) || Date.now(),
          };
        } catch {
          return null;
        }
      })
    );
    const cloud = items.filter((x): x is VarietyLink => x !== null);
    // 同一 varietyId + platform 取最新
    const latest = new Map<string, VarietyLink>();
    for (const item of cloud) {
      const key = `${item.varietyId}:${item.platform}`;
      const cur = latest.get(key);
      if (!cur || item.timestamp > cur.timestamp) latest.set(key, item);
    }
    const cloudLatest = Array.from(latest.values()).sort((a, b) => b.timestamp - a.timestamp);
    const local = loadLocal().filter((l) => !cloudLatest.some((c) => c.id === l.id));
    return [...cloudLatest, ...local];
  } catch {
    return loadLocal();
  }
}

/** 上传/覆盖某个综艺条目的某个平台真实链接 */
export async function uploadVarietyLink(
  varietyId: string,
  platform: string,
  url: string
): Promise<VarietyLink> {
  const name = fileName(varietyId, platform);
  const body: StoredVarietyLink = {
    varietyId,
    platform,
    url,
    publisherId: varietyLinkPublisherId(),
    timestamp: Date.now(),
  };
  if (!isCloudEnabled()) {
    const local = loadLocal();
    const item: VarietyLink = { id: name, ...body };
    const next = local.filter((l) => !(l.varietyId === varietyId && l.platform === platform));
    saveLocal([...next, item]);
    return item;
  }
  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
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
    throw new Error(detail || `上传失败 (${res.status})`);
  }
  return { id: name, ...body };
}

/** 删除某个综艺条目的某个平台补充链接 */
export async function deleteVarietyLink(varietyId: string, platform: string): Promise<void> {
  const name = fileName(varietyId, platform);
  if (!isCloudEnabled()) {
    const local = loadLocal().filter((l) => !(l.varietyId === varietyId && l.platform === platform));
    saveLocal(local);
    return;
  }
  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`删除失败 (${res.status})`);
}

/** 查找某个综艺条目指定平台的最新补充链接 */
export function findVarietyLink(
  links: VarietyLink[],
  varietyId: string,
  platform: string
): VarietyLink | undefined {
  return links.find((l) => l.varietyId === varietyId && l.platform === platform);
}
