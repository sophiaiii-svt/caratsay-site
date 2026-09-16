/**
 * 克拉动态 · 公开平台实时拉取（客户端）
 * ------------------------------------------------------------------
 * YouTube（官方频道 RSS，无需登录）与 Bilibili（WBI 签名动态接口）都是
 * 公开可访问的源，前端可直接抓取并合并进「克拉动态」专区，做到真正的实时同步。
 *
 * 浏览器受 CORS 限制，故统一走公共 CORS 代理（allorigins → corsproxy 兜底）。
 * 任一源抓取失败均返回 []，不影响页面其余数据（优雅回退到精选数据）。
 *
 * 注：Weverse / Instagram 仍需登录授权，无法在前端直连，继续由定时检索补全。
 */

import type { UpdateItem, UpdateKind } from '@/data/updates';
import { CLOUD_CONFIG, isCloudEnabled } from '@/config/cloud';

const YT_CHANNEL = 'UCfkXDY7vwkcJ8ddFGz8KusA'; // @pledis17 官方频道
const BILI_UID = '692206640'; // SEVENTEEN 官方 Bilibili

const PROXIES = [
  (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  (u: string) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}`,
];

async function fetchText(target: string, timeoutMs = 12000): Promise<string> {
  let lastErr: unknown;
  for (const mk of PROXIES) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(mk(target), { signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetch failed');
}

/* ── YouTube RSS ──────────────────────────────────────── */
function classifyYoutube(title: string): UpdateKind {
  const t = title.toLowerCase();
  if (t.includes('official mv') || t.includes(' m/v') || t.includes('mv teaser')) return 'music';
  if (t.includes('archive') || t.includes('challenge') || t.includes('records')) return 'variety';
  return 'post';
}

export async function fetchYouTube(): Promise<UpdateItem[]> {
  try {
    const xml = await fetchText(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${YT_CHANNEL}`,
    );
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const entries = Array.from(doc.getElementsByTagName('entry'));
    return entries.slice(0, 12).map((e) => {
      const title = e.getElementsByTagName('title')[0]?.textContent ?? 'YouTube 更新';
      const link = e.getElementsByTagName('link')[0]?.getAttribute('href') ?? '';
      const videoId = e.getElementsByTagName('yt:videoId')[0]?.textContent ?? '';
      const published = e.getElementsByTagName('published')[0]?.textContent ?? new Date().toISOString();
      const thumb = e.getElementsByTagName('media:thumbnail')[0]?.getAttribute('url') ?? '';
      return {
        id: `yt-${videoId || title}`,
        category: 'official' as const,
        memberId: null,
        platform: 'youtube' as const,
        kind: classifyYoutube(title),
        title,
        description: thumb ? 'YouTube 官方频道新视频' : undefined,
        date: published,
        url: link,
      };
    });
  } catch {
    return [];
  }
}

/* ── Bilibili 动态（WBI 签名） ─────────────────────────── */
const WBI_ORDER = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33,
  9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17,
  0, 1, 57, 34, 44, 22, 25, 60, 51, 56, 30, 4, 59, 20, 54, 6, 36, 21, 11, 52,
];

function md5(s: string): string {
  function add(x: number, y: number) { const l = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff); }
  function rol(n: number, c: number) { return (n << c) | (n >>> (32 - c)); }
  function f(a: number, b: number, c: number, d: number, x: number, k: number, s: number) {
    return rol(add(add(a, add(b & c | (~b & d), x)), k), s);
  }
  function g(a: number, b: number, c: number, d: number, x: number, k: number, s: number) {
    return rol(add(add(a, add(b & d | c & ~d, x)), k), s);
  }
  function h(a: number, b: number, c: number, d: number, x: number, k: number, s: number) {
    return rol(add(add(a, add(b ^ c ^ d, x)), k), s);
  }
  function i(a: number, b: number, c: number, d: number, x: number, k: number, s: number) {
    return rol(add(add(a, add(c ^ (b | ~d), x)), k), s);
  }
  function cm(q: number) { return q < 16 ? f : q < 32 ? g : q < 48 ? h : i; }
  function ck(q: number) { return [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][q >> 2] | 0; }
  function cx(q: number) { return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63][q] | 0; }

  const utf = unescape(encodeURIComponent(s));
  const len = utf.length;
  const words: number[] = [];
  for (let i = 0; i < len; i += 1) words[i >> 2] |= (utf.charCodeAt(i) & 0xff) << (i % 4) * 8;
  words[len >> 2] |= 0x80 << (len % 4) * 8;
  words[(((len + 8) >> 6) << 1) + 14] = len * 8;
  words[(((len + 8) >> 6) << 1) + 15] = 0;

  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < words.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;
    for (let q = 0; q < 64; q += 1) {
      const x = words[i + (cx(q) - 1)] | 0;
      const k = (Math.abs(Math.sin(q + 1)) * 4294967296) | 0;
      let r = cm(q)(a, b, c, d, x, k, ck(q));
      a = d; d = c; c = b; b = r;
    }
    a = add(a, oa); b = add(b, ob); c = add(c, oc); d = add(d, od);
  }
  const hex = (n: number) => (((n >>> 0).toString(16)).padStart(8, '0'));
  return hex(a) + hex(b) + hex(c) + hex(d);
}

function mixinKey(img: string, sub: string): string {
  const raw = (img || '') + (sub || '');
  return WBI_ORDER.map((i) => raw[i] || '').join('').slice(0, 32);
}

async function biliNav(): Promise<{ img: string; sub: string }> {
  const json = JSON.parse(
    await fetchText('https://api.bilibili.com/x/web-interface/nav'),
  );
  const wbi = json?.data?.wbi_img ?? {};
  const img = (wbi.img_url ?? '').split('/').pop()?.split('.')[0] ?? '';
  const sub = (wbi.sub_url ?? '').split('/').pop()?.split('.')[0] ?? '';
  return { img, sub };
}

export async function fetchBilibili(): Promise<UpdateItem[]> {
  try {
    const { img, sub } = await biliNav();
    const mk = mixinKey(img, sub);
    const wts = Math.floor(Date.now() / 1000);
    const params: Record<string, string> = {
      host_uid: BILI_UID,
      offset: '0',
      type: 'all',
      wts: String(wts),
    };
    const sorted = Object.keys(params).sort();
    const base = sorted.map((k) => `${k}=${params[k]}`).join('&') + mk;
    const w_rid = md5(base);
    const api =
      `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?` +
      `host_uid=${BILI_UID}&offset=0&type=all&wts=${wts}&w_rid=${w_rid}`;
    const json = JSON.parse(await fetchText(api));
    if (json?.code !== 0) return [];
    const items: any[] = json?.data?.items ?? [];
    return items
      .filter((it) => it?.modules?.module_dynamic)
      .slice(0, 12)
      .map((it) => {
        const mod = it.modules.module_dynamic;
        const author = it.modules.module_author ?? {};
        const text = mod.desc?.text ?? '';
        const major = mod.major;
        let title = text || 'Bilibili 动态';
        let kind: UpdateKind = 'post';
        if (major?.type === 'MAJOR_TYPE_VIDEO') {
          title = major.archive?.title ?? text ?? 'Bilibili 视频';
          kind = 'post';
        } else if (major?.type === 'MAJOR_TYPE_ARTICLE') {
          title = major.article?.title ?? text ?? 'Bilibili 专栏';
        }
        const ts = (author.timestamp ?? Math.floor(Date.now() / 1000)) * 1000;
        const dynId = it.id_str ?? it.id ?? '';
        return {
          id: `bili-${dynId}`,
          category: 'official' as const,
          memberId: null,
          platform: 'bilibili' as const,
          kind,
          title: title.slice(0, 80),
          description: text ? text.slice(0, 60) : undefined,
          date: new Date(ts).toISOString(),
          url: `https://space.bilibili.com/${BILI_UID}/dynamic/${dynId}`,
        };
      });
  } catch {
    return [];
  }
}

/* ── 微博（团体官号 + 文俊辉 + 徐明浩，走公共 CORS 代理，作为云函数兜底） ──
   浏览器直连微博会被 CORS 拦，统一走 PROXIES。任一代理失败返回 []，不污染数据。
   注：真正的自动同步由 sync-feeds 云函数（m.weibo.cn 容器接口）完成，这里只是兜底。 */
const WEIBO_UIDS: { uid: string; memberId: string | null; category: 'official' | 'member' }[] = [
  { uid: 'pledis17', memberId: null, category: 'official' },
  { uid: 'jun', memberId: 'jun', category: 'member' },
  { uid: 'the8', memberId: 'the8', category: 'member' },
];

export async function fetchWeibo(): Promise<UpdateItem[]> {
  const out: UpdateItem[] = [];
  for (const { uid, memberId, category } of WEIBO_UIDS) {
    try {
      // m.weibo.cn 公开容器接口，经 CORS 代理访问（兜底用，可能失败）
      const json = JSON.parse(
        await fetchText(
          `https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}&containerid=107603${uid}`,
        ),
      );
      const cards = json?.data?.cards || [];
      for (const c of cards.slice(0, 5)) {
        const mblog = c?.mblog;
        if (!mblog) continue;
        const text = (mblog.text || '').replace(/<[^>]+>/g, '').slice(0, 80);
        const id = mblog.bid || mblog.id || '';
        out.push({
          id: `wb-${id}`,
          category,
          memberId,
          platform: 'weibo',
          kind: 'post',
          title: text || '微博更新',
          description: undefined,
          date: mblog.created_at || new Date().toISOString(),
          url: `https://m.weibo.cn/detail/${id}`,
        });
      }
    } catch {
      /* 单账号失败忽略 */
    }
  }
  return out;
}

export interface LiveResult {
  items: UpdateItem[];
  youtube: number;
  bilibili: number;
  weibo: number;
  douyin: number;
  tiktok: number;
  xiaohongshu: number;
  at: number | null;
  /** 数据来源：'cloud' = 云端定时云函数已同步的快照；'live' = 前端实时抓取 */
  source: 'cloud' | 'live' | 'mixed';
}

/**
 * 云端定时同步产出的 JSON 路径（与 sync-feeds 云函数约定一致）。
 * 云函数把数据回写到 Supabase Storage 的 live-feeds.json，因此前端直接读该公共对象地址，
 * 形成「云函数抓取 → Supabase → 前端展示」的闭环（零 cookie、无需重新部署站点）。
 */
const CLOUD_FEEDS_PATH =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CLOUD_FEEDS_PATH) ||
  (isCloudEnabled()
    ? `${CLOUD_CONFIG.url.replace(/\/+$/, '')}/storage/v1/object/public/${CLOUD_CONFIG.bucket}/updates/live-feeds.json`
    : (typeof import.meta !== 'undefined' && (import.meta as any).env?.BASE_URL
        ? `${(import.meta as any).env.BASE_URL}live-feeds.json`
        : 'live-feeds.json'));

/**
 * 读取云端定时云函数回写的同步快照（live-feeds.json）。
 * 该文件由 CloudBase 定时器每 30 分钟抓取全平台后写入 Supabase Storage，
 * 因此即使前端因 CORS / 反爬抓不到，也能拿到「全平台同步」的内容。
 */
async function fetchCloudFeeds(): Promise<LiveResult | null> {
  try {
    const res = await fetch(`${CLOUD_FEEDS_PATH}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<LiveResult> & { items?: UpdateItem[] };
    if (!Array.isArray(data.items)) return null;
    const items = data.items;
    return {
      items,
      youtube: items.filter((i) => i.platform === 'youtube').length,
      bilibili: items.filter((i) => i.platform === 'bilibili').length,
      weibo: items.filter((i) => i.platform === 'weibo').length,
      douyin: items.filter((i) => i.platform === 'douyin').length,
      tiktok: items.filter((i) => i.platform === 'tiktok').length,
      xiaohongshu: items.filter((i) => i.platform === 'xiaohongshu').length,
      at: typeof data.at === 'number' ? data.at : Date.now(),
      source: 'cloud',
    };
  } catch {
    return null;
  }
}

/**
 * 统一获取实时动态：优先用云端定时同步快照（全平台，含微博/抖音/TikTok/小红书），
 * 前端实时抓取作为兜底补充（YouTube/B站 直连，失败则忽略）。
 * 这样「手动复制链接」之外，所有平台都能自动回流，且新增内容同步可见。
 */
export async function fetchLiveFeeds(): Promise<LiveResult> {
  const cloud = await fetchCloudFeeds();
  let frontItems: UpdateItem[] = [];
  let ytN = 0;
  let biliN = 0;
  let wbN = 0;
  try {
    const [yt, bili, wb] = await Promise.allSettled([fetchYouTube(), fetchBilibili(), fetchWeibo()]);
    const ytItems = yt.status === 'fulfilled' ? yt.value : [];
    const biliItems = bili.status === 'fulfilled' ? bili.value : [];
    const wbItems = wb.status === 'fulfilled' ? wb.value : [];
    frontItems = [...ytItems, ...biliItems, ...wbItems];
    ytN = ytItems.length;
    biliN = biliItems.length;
    wbN = wbItems.length;
  } catch {
    /* 前端抓取异常不影响云端数据 */
  }

  if (cloud) {
    // 合并：云端快照为主，前端实时抓到的（可能更新鲜）按 URL/ID 去重叠加
    const seen = new Set<string>();
    const merged: UpdateItem[] = [];
    for (const it of [...frontItems, ...cloud.items]) {
      const key = it.url || it.id;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      merged.push(it);
    }
    // 计数从合并后的实际数据计算，避免与前端实时抓取重复累加
    return {
      items: merged,
      youtube: merged.filter((i) => i.platform === 'youtube').length,
      bilibili: merged.filter((i) => i.platform === 'bilibili').length,
      weibo: merged.filter((i) => i.platform === 'weibo').length,
      douyin: merged.filter((i) => i.platform === 'douyin').length,
      tiktok: merged.filter((i) => i.platform === 'tiktok').length,
      xiaohongshu: merged.filter((i) => i.platform === 'xiaohongshu').length,
      at: cloud.at,
      source: frontItems.length ? 'mixed' : 'cloud',
    };
  }

  // 无云端快照：仅前端抓取
  return {
    items: frontItems,
    youtube: ytN,
    bilibili: biliN,
    weibo: wbN,
    douyin: 0,
    tiktok: 0,
    xiaohongshu: 0,
    at: frontItems.length ? Date.now() : null,
    source: 'live',
  };
}
