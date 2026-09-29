/**
 * 前端媒体上传适配器：把文件传到 Cloudflare R2（永久存储方案）
 * 流程：① 调本站 /api/presign（Vercel Serverless Function）拿临时上传地址；
 *       ② 浏览器直接 PUT 到 R2；③ 返回公开直链。
 * 仅在 import.meta.env.VITE_R2_ENABLED === 'true' 时启用（见 updateCloud.ts）。
 *
 * 注：R2 密钥只在服务端 /api/presign 函数持有，前端零密钥；本地 `vercel dev` 也能跑通。
 *
 * 稳定性加固：
 *   - 每步请求带超时（失败快速返回，不会一直转圈）
 *   - 网络类抖动自动指数退避重试
 *   - 通道可用性记忆：R2 连续失败后 5 分钟内直接走备用通道，不再干等超时
 */
import type { MediaItem } from '@/data/updates';
import { fetchWithTimeout, withRetry } from '@/lib/netStability';

function guessMediaType(file: File): 'image' | 'video' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return 'video';
  return 'image';
}

/* ── 通道可用性记忆 ──────────────────────────────── */

const R2_DOWN_KEY = 'r2_down_until';

export function isR2Available(): boolean {
  try {
    const until = Number(localStorage.getItem(R2_DOWN_KEY) || '0');
    return !until || Date.now() > until;
  } catch {
    return true;
  }
}

/** R2 失败后短暂拉黑，后续上传直接走备用通道（更快、不干等） */
export function markR2Unavailable(minutes = 5): void {
  try {
    localStorage.setItem(R2_DOWN_KEY, String(Date.now() + minutes * 60_000));
  } catch {
    /* ignore */
  }
}

function markR2Ok(): void {
  try {
    localStorage.removeItem(R2_DOWN_KEY);
  } catch {
    /* ignore */
  }
}

/* ── 主上传流程 ──────────────────────────────────── */

export async function uploadMediaToR2(file: File): Promise<MediaItem> {
  const ext = file.name.split('.').pop() || '';

  // ① 申请一次性 PUT 预签名地址（超时 15s，网络抖动重试 3 次）
  const { uploadUrl, publicUrl } = await withRetry(async () => {
    let presign: Response;
    try {
      presign = await fetchWithTimeout(
        '/api/presign',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentType: file.type || 'application/octet-stream',
            size: file.size,
            ext,
          }),
        },
        15_000,
      );
    } catch (e) {
      if ((e as Error)?.message?.includes('超时')) throw e;
      throw new Error('无法连接预签名服务（/api/presign），请检查网络后重试');
    }
    if (!presign.ok) {
      let detail = '';
      try {
        detail = (await presign.json())?.error || '';
      } catch {
        /* ignore */
      }
      throw new Error(detail || `R2 预签名失败 (${presign.status})`);
    }
    return (await presign.json()) as { uploadUrl: string; publicUrl: string };
  }, 3);

  // ② 直传 R2：按文件大小给足超时（底线 30s，大文件最多 3 分钟），失败重试 2 次
  const putTimeout = Math.min(180_000, Math.max(30_000, file.size / 40_000)); // 约 40KB/s 的保守速率
  await withRetry(async () => {
    let put: Response;
    try {
      put = await fetchWithTimeout(
        uploadUrl,
        {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        },
        putTimeout,
      );
    } catch (e) {
      if ((e as Error)?.message?.includes('超时')) throw e;
      // 典型场景：国内网络无法直连 *.r2.cloudflarestorage.com（CDN 域名 r2.dev 可以通）
      throw new Error('无法连接 R2 存储服务器（网络/代理可能屏蔽了 *.r2.cloudflarestorage.com）');
    }
    if (!put.ok) {
      let detail = '';
      try {
        detail = await put.text();
      } catch {
        /* ignore */
      }
      throw new Error(detail || `R2 上传失败 (${put.status})`);
    }
  }, 2);

  markR2Ok();

  return {
    url: publicUrl as string,
    type: guessMediaType(file),
    name: file.name,
  };
}
