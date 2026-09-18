/**
 * Vercel Serverless Function —— 链接自动识别（替代 CloudBase 的 resolve-link 云函数）
 * ------------------------------------------------------------------
 * 访客在「克拉补充」粘贴一条动态链接后，前端调用本函数，服务端抓取该链接对应的
 * 帖子文案（标题）与发布时间，自动回填到提交表单，减少手动输入。
 *
 * 解析策略（按平台分发，优先平台专用接口，再回退通用 Open Graph）：
 *   1. YouTube   → oembed（标题 / 作者 / 封面），时间需 Data API（无 key 故留空）
 *   2. Bilibili  → x/web-interface/view（标题 / 作者 / 发布时间戳 / 封面）
 *   3. 通用 OG   → 抓取目标页 HTML，解析 og:title / og:description /
 *                  article:published_time / og:image / twitter:* 元信息
 *   小红书 / 微博 / 抖音等需登录态的平台，公开页通常无 OG 或不完整，
 *   此时解析失败，前端自动回退到手动填写（不阻断提交流程）。
 *
 * 依赖：仅使用 Node18+ 内置的全局 fetch，零 npm 依赖。
 * 触发：前端 POST { url } 到 /api/resolve-link。
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function decodeStr(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** 通用 fetch GET（跟随重定向、带超时、限制体积避免大资源拖垮函数） */
async function fetchText(target: string, options: { timeout?: number; headers?: Record<string, string>; accept?: string } = {}): Promise<{ status: number; body: string }> {
  const timeoutMs = options.timeout || 12000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(target, {
      method: 'GET',
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        Accept: options.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    // 仅保留前 3MB，避免大页面正则灾难
    return { status: res.status, body: text.length > 3_000_000 ? text.slice(0, 3_000_000) : text };
  } finally {
    clearTimeout(timer);
  }
}

/** 从 HTML 解析 Open Graph / Twitter Card 元信息 */
function parseOg(html: string) {
  const get = (prop: string) => {
    const re1 = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
      'i',
    );
    const m1 = html.match(re1);
    if (m1) return decodeStr(m1[1]);
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
      'i',
    );
    const m2 = html.match(re2);
    return m2 ? decodeStr(m2[1]) : '';
  };
  return {
    title: get('og:title') || get('twitter:title'),
    description: get('og:description') || get('twitter:description') || get('description'),
    image: get('og:image') || get('twitter:image'),
    publishedAt: get('article:published_time') || get('og:published_time') || get('publishDate') || '',
  };
}

/** YouTube：官方 oembed，无需密钥 */
async function resolveYoutube(url: string) {
  try {
    const r = await fetchText(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { accept: 'application/json', timeout: 8000 },
    );
    if (r.status !== 200) return null;
    const j = JSON.parse(r.body);
    if (j && j.title) {
      return {
        title: j.title,
        author: j.author_name || '',
        image: j.thumbnail_url || '',
        platform: 'youtube',
        publishedAt: '',
      };
    }
  } catch {
    /* 忽略 */
  }
  return null;
}

/** Bilibili：公开 view 接口，拿标题 / UP主 / 发布时间戳 / 封面 */
async function resolveBilibili(url: string) {
  const m = url.match(/(BV[0-9A-Za-z]+)/i) || url.match(/[?&]bvid=(BV[0-9A-Za-z]+)/i);
  if (!m) return null;
  const bvid = m[1];
  try {
    const r = await fetchText(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      timeout: 10000,
      headers: { Referer: 'https://www.bilibili.com/', Origin: 'https://www.bilibili.com' },
    });
    if (r.status !== 200) return null;
    const j = JSON.parse(r.body);
    if (j && j.code === 0 && j.data) {
      const d = j.data;
      const iso = d.pubdate ? new Date(d.pubdate * 1000).toISOString().slice(0, 16) : '';
      return {
        title: d.title || '',
        author: (d.owner && d.owner.name) || '',
        image: d.pic || '',
        platform: 'bilibili',
        publishedAt: iso,
      };
    }
  } catch {
    /* 忽略 */
  }
  return null;
}

/** 安全截取 HTML */
function safeHtmlSlice(html: string, maxLen = 300000) {
  if (!html || html.length <= maxLen) return html || '';
  return html.slice(0, maxLen);
}

/**
 * Instagram：走 imginn.com（公开镜像，免登录）抓取文案 / 作者 / 时间。
 * 云端若出网受限会在超时后返回 null，上层自动兜底（离线文案库命中则已优先返回，否则前端生成默认标题）。
 */
async function resolveInstagram(url: string, timeoutMs = 6000) {
  const m = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([^/?#]+)/i);
  if (!m) return null;
  const shortcode = m[1];
  const targets = [`https://imginn.com/p/${shortcode}/`, `https://imginn.com/reel/${shortcode}/`];
  for (const target of targets) {
    try {
      const r = await fetchText(target, { timeout: timeoutMs });
      if (r.status !== 200) continue;
      const html = safeHtmlSlice(r.body);
      const ownerM = html.match(/\(@([A-Za-z0-9_.]+)\)/);
      const owner = ownerM ? ownerM[1] : '';
      let publishedAt = '';
      const dateM = html.match(/Posted On:\s*([^<]+)</i);
      if (dateM) {
        const d = new Date(dateM[1].replace(/\s+/g, ' ').trim());
        if (!isNaN(d.getTime())) publishedAt = d.toISOString().slice(0, 16);
      }
      let caption = '';
      const capM = html.match(/class="desc">(.*?)(?:<ul|<\/div>)/is);
      if (capM) {
        caption = decodeStr(capM[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      }
      if (caption || owner) {
        return {
          title: caption || `${owner} Instagram update`,
          author: owner,
          image: '',
          platform: 'instagram',
          publishedAt,
        };
      }
    } catch {
      /* 继续下一个 target，或最终返回 null 让上层兜底 */
    }
  }
  return null;
}

/** 主解析：先平台专用，再通用 OG */
async function resolve(target: string) {
  if (!/^https?:\/\//i.test(target)) return { ok: false, error: 'invalid url' };
  const low = target.toLowerCase();
  let r: any = null;
  let skipGeneric = false;
  try {
    if (low.includes('youtube.com') || low.includes('youtu.be')) r = await resolveYoutube(target);
    else if (low.includes('bilibili.com') || low.includes('b23.tv')) r = await resolveBilibili(target);
    else if (low.includes('instagram.com')) {
      r = await resolveInstagram(target, 6000);
      skipGeneric = true;
    }
  } catch {
    r = null;
  }
  if (!r && !skipGeneric) {
    try {
      const fr = await fetchText(target, { timeout: 8000 });
      const og = parseOg(fr.body);
      if (og.title) {
        r = { title: og.title, author: '', image: og.image, platform: '', publishedAt: og.publishedAt };
      }
    } catch {
      /* 抓取失败 */
    }
  }
  if (!r || !r.title) {
    return { ok: false, error: '无法自动识别，请手动填写', url: target };
  }
  return { ok: true, url: target, ...r };
}

export default async function handler(req: any, res: any) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  let target = '';
  try {
    if (req.method === 'GET') {
      target = (req.query && (req.query.url as string)) || '';
    } else {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      target = (body && body.url) || '';
    }
  } catch {
    /* ignore */
  }

  if (!target) {
    res.status(400).json({ ok: false, error: 'missing url' });
    return;
  }

  const result = await resolve(target);
  res.status(200).json(result);
}
