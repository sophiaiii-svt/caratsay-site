// @ts-nocheck
const ENV_ID = 'sophia0214svt0526-d7d10lc48336b0';

let _app: any = null;
let _authReady: Promise<any> | null = null;

async function ensureApp() {
  if (!_app) {
    // 动态引入：仅当用户首次粘贴链接识别时才加载 SDK，避免拖慢首屏
    const mod = await import('@cloudbase/js-sdk');
    const cloudbase = mod.default || mod;
    _app = cloudbase.init({ env: ENV_ID });
  }
  // 匿名登录：提升云函数调用成功率（环境需开启「匿名登录」；失败则回退直接调用）
  if (!_authReady) {
    _authReady = (async () => {
      try {
        if (_app.auth && _app.auth().signInAnonymously) {
          await _app.auth().signInAnonymously();
        }
      } catch {
        /* 忽略：匿名登录未开启时直接调用 */
      }
      return _app;
    })();
  }
  return _authReady;
}

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

function parseCloudResult(result: any): ResolvedMeta | null {
  if (!result) return null;
  // CloudBase callFunction 返回结构：{ requestId, result: { statusCode, headers, body } }
  let data = result.result || result;
  if (data && typeof data.body === 'string') {
    try {
      data = JSON.parse(data.body);
    } catch {
      return null;
    }
  }
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

/** 调用云端 resolve-link 云函数，服务端识别链接文案与时间（Bilibili / 国内平台等） */
export async function resolveViaCloud(url: string, timeoutMs = 12000): Promise<ResolvedMeta | null> {
  try {
    const app = await ensureApp();
    const res = await app.callFunction({ name: 'resolve-link', data: { url } });
    const meta = parseCloudResult(res);
    if (meta) return meta;
  } catch (e: any) {
    // 忽略：匿名调用被拒 / 网络错误 → 上层回退到前端 oembed
  }
  return { ok: false, error: 'cloud resolve failed' };
}

/**
 * 调用云端 presign-r2 云函数，为 Cloudflare R2 生成 PUT 预签名地址与公开直链。
 * 与 resolve-link 一样走 CloudBase Web SDK（app.callFunction），无需把密钥放前端。
 */
export async function presignForR2({ contentType, size, ext }: {
  contentType: string;
  size: number;
  ext: string;
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const app = await ensureApp();
  const res: any = await app.callFunction({
    name: 'presign-r2',
    data: { contentType, size, ext },
  });
  let data = res && res.result ? res.result : res;
  if (data && typeof data.body === 'string') {
    try {
      data = JSON.parse(data.body);
    } catch {
      data = {};
    }
  }
  if (!data || !data.uploadUrl) {
    throw new Error((data && data.error) || 'R2 预签名失败');
  }
  return { uploadUrl: data.uploadUrl, publicUrl: data.publicUrl, key: data.key };
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
 * - YouTube：优先前端 oembed（云端对 YouTube 国内 IP 超时，故前端跨域更稳）
 * - Bilibili / 国内平台：走云端函数（已验证可用）
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
