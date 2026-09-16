import { CLOUD_CONFIG, isCloudEnabled } from '@/config/cloud';

/**
 * 克拉SAY 云端回忆册 —— Supabase Storage 轻客户端
 * 直接走 REST API，不引入 SDK 依赖。
 *
 * 文件命名约定（扁平存放，一次 list 即可拿到全部）：
 *   {section}__{timestamp}__{random}.{ext}
 *   例：hoshi__1754880000000__k3f9ab.jpg
 */

export interface CloudPhoto {
  /** 云端文件名，同时作为唯一 id */
  id: string;
  section: string;
  url: string;
  timestamp: number;
}

const SEP = '__';
/** 一次拉取上限 */
const LIST_LIMIT = 1000;

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

/** 拼出公开访问地址 */
export function publicUrl(name: string): string {
  return `${base()}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/${encodeURIComponent(name)}`;
}

/** 从文件名解析出分区与时间戳 */
function parseName(name: string): { section: string; timestamp: number } | null {
  const parts = name.split(SEP);
  if (parts.length < 3) return null;
  const section = parts[0];
  const timestamp = Number(parts[1]);
  if (!section || !Number.isFinite(timestamp)) return null;
  return { section, timestamp };
}

/** 生成新文件名 */
function buildName(section: string, ext: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${section}${SEP}${Date.now()}${SEP}${rand}.${ext}`;
}

/** 拉取云端全部照片（按时间倒序） */
export async function listCloudPhotos(signal?: AbortSignal): Promise<CloudPhoto[]> {
  if (!isCloudEnabled()) return [];

  const res = await fetch(`${base()}/storage/v1/object/list/${CLOUD_CONFIG.bucket}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      prefix: '',
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

  return rows
    .map((row) => {
      const name = row?.name;
      if (!name || name.startsWith('.')) return null;
      const meta = parseName(name);
      if (!meta) return null;
      return {
        id: name,
        section: meta.section,
        url: publicUrl(name),
        timestamp: meta.timestamp,
      } satisfies CloudPhoto;
    })
    .filter((p): p is CloudPhoto => p !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
}

/** 上传一张照片到云端 */
export async function uploadCloudPhoto(section: string, blob: Blob): Promise<CloudPhoto> {
  if (!isCloudEnabled()) throw new Error('云端未配置');

  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const name = buildName(section, ext);

  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': blob.type || 'image/jpeg',
      'cache-control': 'max-age=31536000',
      'x-upsert': 'false',
    }),
    body: blob,
  });

  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.message || body?.error || '';
    } catch {
      /* ignore */
    }
    throw new Error(detail || `上传失败 (${res.status})`);
  }

  const meta = parseName(name)!;
  return { id: name, section: meta.section, url: publicUrl(name), timestamp: meta.timestamp };
}

/** 删除云端照片 */
export async function deleteCloudPhoto(name: string): Promise<void> {
  if (!isCloudEnabled()) throw new Error('云端未配置');

  const res = await fetch(`${base()}/storage/v1/object/${CLOUD_CONFIG.bucket}/${name}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error(`删除失败 (${res.status})`);
}
