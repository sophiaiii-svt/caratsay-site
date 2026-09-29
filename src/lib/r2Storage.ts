/**
 * 前端媒体上传适配器：把文件传到 Cloudflare R2（永久存储方案）
 * 流程：① 调本站 /api/presign（Vercel Serverless Function）拿临时上传地址；
 *       ② 浏览器直接 PUT 到 R2；③ 返回公开直链。
 * 仅在 import.meta.env.VITE_R2_ENABLED === 'true' 时启用（见 updateCloud.ts）。
 *
 * 注：R2 密钥只在服务端 /api/presign 函数持有，前端零密钥；本地 `vercel dev` 也能跑通。
 */
import type { MediaItem } from '@/data/updates';

function guessMediaType(file: File): 'image' | 'video' {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return 'video';
  return 'image';
}

export async function uploadMediaToR2(file: File): Promise<MediaItem> {
  const ext = file.name.split('.').pop() || '';
  // ① 向本站 Vercel 函数申请一次性 PUT 预签名地址
  let presign: Response;
  try {
    presign = await fetch('/api/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        ext,
      }),
    });
  } catch {
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
  const { uploadUrl, publicUrl } = await presign.json();

  // ② 浏览器直传 R2（不经过本站，省带宽、不受函数体积限制）
  let put: Response;
  try {
    put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
  } catch {
    // 典型场景：国内网络无法直连 *.r2.cloudflarestorage.com（CDN 域名 r2.dev 可以通）
    throw new Error('无法连接 R2 存储服务器（网络/代理可能屏蔽了 *.r2.cloudflarestorage.com），请开启 VPN 后重试');
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

  return {
    url: publicUrl as string,
    type: guessMediaType(file),
    name: file.name,
  };
}
