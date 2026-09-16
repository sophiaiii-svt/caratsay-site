import { CLOUD_CONFIG, isCloudEnabled } from '@/config/cloud';

/**
 * 次人语录 云端同步 —— 复用克拉SAY 的 Supabase Storage 轻客户端
 * 与克拉SAY 同一套架构：每条语录 = 云端的 1 个 JSON 文件，扁平存放在
 * `quotes/` 前缀下，一次 list 即可拿到全部，人人可见、人人可补充。
 *
 * 文件名约定：
 *   quotes/{memberId}__{timestamp}__{random}.json
 *   例：quotes/joshua__1755000000000__k3f9ab.json
 * 文件内容（JSON）：
 *   { memberId, text, publisherId, timestamp }
 */

export interface CloudQuote {
  /** 云端文件名，同时作为唯一 id（含 quotes/ 前缀） */
  id: string;
  memberId: string;
  text: string;
  publisherId: string;
  timestamp: number;
}

const SEP = '__';
const PREFIX = 'quotes/';
const LIST_LIMIT = 1000;

interface StoredQuote {
  memberId: string;
  text: string;
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

/** 拼出公开访问地址（文件名只含 URL 安全字符，无需编码） */
export function publicUrl(name: string): string {
  return `${base()}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/${name}`;
}

/** 生成新文件名（memberId / 数字 / base36 均为 URL 安全字符） */
function buildName(memberId: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${PREFIX}${memberId}${SEP}${Date.now()}${SEP}${rand}.json`;
}

/** 拉取云端全部语录（并行读取内容，按时间倒序） */
export async function listCloudQuotes(signal?: AbortSignal): Promise<CloudQuote[]> {
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

  if (!res.ok) {
    throw new Error(`云端读取失败 (${res.status})`);
  }

  const rows: Array<{ name?: string }> = await res.json();
  if (!Array.isArray(rows)) return [];

  const names: string[] = [];
  for (const row of rows) {
    const n = row?.name;
    if (n && n.startsWith(PREFIX) && n.endsWith('.json')) names.push(n);
  }

  const quotes = await Promise.all(
    names.map(async (name): Promise<CloudQuote | null> => {
      try {
        const r = await fetch(publicUrl(name), { signal });
        if (!r.ok) return null;
        const data = (await r.json()) as StoredQuote;
        if (!data || typeof data.text !== 'string' || typeof data.memberId !== 'string') return null;
        return {
          id: name,
          memberId: data.memberId,
          text: data.text,
          publisherId: String(data.publisherId ?? ''),
          timestamp: Number(data.timestamp) || Date.now(),
        };
      } catch {
        return null;
      }
    })
  );

  return quotes
    .filter((q): q is CloudQuote => q !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/** 发布一条语录到云端 */
export async function uploadCloudQuote(q: Omit<CloudQuote, 'id'>): Promise<CloudQuote> {
  if (!isCloudEnabled()) throw new Error('云端未配置');

  const name = buildName(q.memberId);
  const body: StoredQuote = {
    memberId: q.memberId,
    text: q.text,
    publisherId: q.publisherId,
    timestamp: q.timestamp,
  };

  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'cache-control': 'max-age=31536000',
      'x-upsert': 'false',
    }),
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

  return { id: name, ...q };
}

/** 删除云端语录 */
export async function deleteCloudQuote(name: string): Promise<void> {
  if (!isCloudEnabled()) throw new Error('云端未配置');

  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error(`删除失败 (${res.status})`);
}
