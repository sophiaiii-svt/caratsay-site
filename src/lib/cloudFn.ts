// @ts-nocheck
// 链接识别相关云端调用。resolve-link 已迁到 Vercel 函数 /api/resolve-link（零 CloudBase 依赖）。

export interface ResolvedMeta {
  ok: boolean;
  title?: string;
  description?: string;
  image?: string;
  /** ISO 字符串，形如 2026-08-18T12:00 */
  publishedAt?: string;
  platform?: string;
  error?: string;
  /** Instagram 离线识别专用：已抓取到的文案 / 成员 */
  igCaption?: string;
  igMemberId?: string;
  igName?: string;
}

function parseResult(data: any): ResolvedMeta | null {
  if (!data) return null;
  if (data && data.ok) {
    return {
      ok: true,
      title: data.title,
      description: data.description,
      image: data.image,
      publishedAt: data.publishedAt ? String(data.publishedAt).slice(0, 16) : undefined,
      platform: data.platform,
    };
  }
  return { ok: false, error: (data && data.error) || 'no meta' };
}

/** 调用 Vercel /api/resolve-link，服务端识别链接文案与时间（Bilibili / 国内平台等） */
export async function resolveViaCloud(url: string, timeoutMs = 12000): Promise<ResolvedMeta | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch('/api/resolve-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!r.ok) return { ok: false, error: 'resolve failed' };
    const data = await r.json();
    const meta = parseResult(data);
    if (meta) return meta;
  } catch (e: any) {
    // 忽略：网络错误 → 上层回退到前端 oembed / 手动填写
  }
  return { ok: false, error: 'cloud resolve failed' };
}

/** 前端直接调用 YouTube oembed（浏览器跨域友好，确定可用），但无发布时间 */
export async function resolveYouTube(url: string, timeoutMs = 8000): Promise<ResolvedMeta | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: ctrl.signal },
    );
    clearTimeout(timer);
    if (!r.ok) return { ok: false };
    const j = await r.json();
    if (j && j.title) {
      return { ok: true, title: j.title, description: j.author_name, platform: 'youtube' };
    }
  } catch {
    /* 忽略 */
  }
  return { ok: false };
}

/**
 * 统一入口：自动识别一条动态链接的文案与时间。
 * - Instagram：优先查「离线文案库」（已抓取成员动态，即时可靠，无需联网），
 *   未命中再走云端 imginn 尽力而为识别。
 * - YouTube：优先前端 oembed（跨域更稳）
 * - Bilibili / 国内平台：走 /api/resolve-link（Vercel 服务端识别）
 */
export async function resolveLink(url: string): Promise<ResolvedMeta | null> {
  const low = url.toLowerCase();
  const isYouTube = low.includes('youtube.com') || low.includes('youtu.be');
  const isIg = low.includes('instagram.com');

  // 1) Instagram 离线文案库：即时、可靠，覆盖已抓取的成员动态
  if (isIg) {
    try {
      const { lookupIgCaption } = await import('./igCaptions');
      const local = lookupIgCaption(url);
      if (local?.ok) {
        return {
          ok: true,
          platform: 'instagram',
          igCaption: local.igCaption,
          igMemberId: local.igMemberId,
          igName: local.igName,
          publishedAt: local.publishedAt,
        };
      }
    } catch {
      /* 离线库异常不影响后续流程 */
    }
  }

  // 2) YouTube 前端 oembed（跨域友好）
  if (isYouTube) {
    const yt = await resolveYouTube(url);
    if (yt?.ok) return yt;
  }

  // 3) 云端识别（B站/国内平台/IG-imginn 尽力而为）
  const cloud = await resolveViaCloud(url);
  if (cloud?.ok) return cloud;

  // 4) YouTube 再兜一次
  if (isYouTube) {
    const yt = await resolveYouTube(url);
    if (yt?.ok) return yt;
  }
  return cloud;
}
