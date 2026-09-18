/**
 * Vercel Serverless Function —— SEVENTEEN 粉丝站定时同步（替代 CloudBase 的 sync-feeds 定时任务）
 * ------------------------------------------------------------------
 * 每 30 分钟被 GitHub Actions 调用一次，抓取全平台实时动态，写回 Supabase Storage
 * 的 updates/live-feeds.json（前端 liveFeeds.ts 直接读该公共地址展示）。
 *
 * 出网策略（与原 CloudBase 版一致）：
 *   · YouTube  -> api.rss2json.com 中继（云端可用）
 *   · 微博/B站 -> rsshub.rssforever.com 镜像（数据中心 IP 常被风控，失败则优雅跳过）
 * 写入：Supabase Storage updates/live-feeds.json（先 DELETE 再 INSERT，anon 仅允许这两种）。
 *
 * 环境变量（Vercel 项目里已配好 *VITE_SUPABASE_*）：
 *   VITE_SUPABASE_URL / SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY
 *   VITE_SUPABASE_BUCKET / SUPABASE_BUCKET
 * 可选：CRON_SECRET（若设置，调用方须带 Authorization: Bearer <secret>）
 *
 * 手动触发：curl -X POST https://你的站.vercel.app/api/sync-feeds
 *          ?dryRun=1 仅抓取不写库
 */

'use strict';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://dfcpcllldgmdxfrpeiel.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_mom_kOxAnqsvkSrtTM7_Xg_gxGRPdyU';
const BUCKET = process.env.VITE_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || 'caratsay';
const FEEDS_PATH = 'updates/live-feeds.json';
const MAX_ITEMS = 500;

const DIAG: any[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MONITORS = {
  youtube: [
    { channelId: 'UCfkXDY7vwkcJ8ddFGz8KusA', memberId: null, category: 'official', name: 'SEVENTEEN' },
  ],
  weibo: [] as any[],
  bilibili: [] as any[],
};

const RSSHUB_BASE = process.env.RSSHUB_BASE || 'https://rsshub.rssforever.com';

const RELAY_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
};

async function safeGet(url: string, { timeout = 12000, headers = {}, redirect = 'follow' }: any = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, { signal: ctrl.signal, headers, redirect });
  } finally {
    clearTimeout(t);
  }
}
async function safeGetJson(url: string, opts: any) {
  const res = await safeGet(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
  return await res.json();
}

function stripHtml(s: string) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function parseRss(xml: string) {
  const items: any[] = [];
  const blocks = xml.split(/<item[ >]/i).slice(1);
  for (const b of blocks) {
    const seg = b.split('</item>')[0];
    const tag = (t: string) => {
      const m = seg.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const title = tag('title');
    const link = tag('link');
    const pub = tag('pubDate') || tag('dc:date');
    const desc = tag('description');
    if (title || link) items.push({ title, link, pub, desc });
  }
  return items;
}
async function fetchRssWithRetry(url: string, retries = 2) {
  let lastErr: any;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await safeGet(url, { timeout: 12000, headers: RELAY_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return parseRss(await res.text());
    } catch (e) {
      lastErr = e;
      if (i < retries) await sleep(800);
    }
  }
  throw lastErr;
}

async function fetchYouTube() {
  const out: any[] = [];
  for (const m of MONITORS.youtube) {
    try {
      const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${m.channelId}`;
      const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
      const j = await safeGetJson(api, { timeout: 12000 });
      if (j?.status !== 'ok') throw new Error(`rss2json ${j?.message || j?.status}`);
      DIAG.push({ source: 'youtube', channel: j.feed?.title || m.name, count: (j.items || []).length });
      for (const it of (j.items || []).slice(0, 10)) {
        out.push({
          id: `yt-${it.link}`,
          category: m.category,
          memberId: m.memberId,
          platform: 'youtube',
          kind: 'post',
          title: (it.title || 'YouTube 更新').slice(0, 80),
          description: stripHtml(it.description || '').slice(0, 80),
          date: new Date(it.pubDate || Date.now()).toISOString(),
          url: it.link,
        });
      }
    } catch (e: any) {
      DIAG.push({ source: 'youtube', error: String(e?.message || e) });
    }
  }
  return out;
}

async function fetchWeibo() {
  const out: any[] = [];
  for (const w of MONITORS.weibo) {
    try {
      const uid = w.uid;
      if (!uid) {
        DIAG.push({ source: 'weibo', handle: w.handle, error: 'uid 未配置' });
        continue;
      }
      const items = await fetchRssWithRetry(`${RSSHUB_BASE}/weibo/user/${uid}`);
      DIAG.push({ source: 'weibo', handle: w.handle, uid, count: items.length });
      for (const it of items.slice(0, 10)) {
        out.push({
          id: `wb-${it.link}`,
          category: w.category,
          memberId: w.memberId,
          platform: 'weibo',
          kind: 'post',
          title: (it.title || '微博更新').slice(0, 80),
          description: stripHtml(it.desc).slice(0, 80),
          date: new Date(it.pub || Date.now()).toISOString(),
          url: it.link,
        });
      }
    } catch (e: any) {
      DIAG.push({ source: 'weibo', handle: w.handle, error: String(e?.message || e) });
    }
  }
  return out;
}

async function fetchBilibili() {
  const out: any[] = [];
  for (const m of MONITORS.bilibili) {
    try {
      const items = await fetchRssWithRetry(`${RSSHUB_BASE}/bilibili/user/dynamic/${m.mid}`);
      DIAG.push({ source: 'bilibili', mid: m.mid, count: items.length });
      for (const it of items.slice(0, 10)) {
        out.push({
          id: `bili-${it.link}`,
          category: m.category,
          memberId: m.memberId,
          platform: 'bilibili',
          kind: 'post',
          title: (it.title || 'Bilibili 动态').slice(0, 80),
          description: stripHtml(it.desc).slice(0, 80),
          date: new Date(it.pub || Date.now()).toISOString(),
          url: it.link,
        });
      }
    } catch (e: any) {
      DIAG.push({ source: 'bilibili', mid: m.mid, error: String(e?.message || e) });
    }
  }
  return out;
}

const ADAPTERS = [
  { key: 'youtube', fn: fetchYouTube },
  { key: 'weibo', fn: fetchWeibo },
  { key: 'bilibili', fn: fetchBilibili },
];

async function readExisting() {
  try {
    const res = await safeGet(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${FEEDS_PATH}`, { timeout: 10000 });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}
async function writeToSupabase(items: any[], counts: any, at: number) {
  const payload = JSON.stringify({ items, ...counts, at, updatedAt: new Date().toISOString() });
  const rel = `${BUCKET}/${FEEDS_PATH}`;
  const baseHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'cache-control': 'max-age=0',
  };
  const objUrl = `${SUPABASE_URL}/storage/v1/object/${rel}`;
  // DELETE 后 Supabase 侧删除可能短暂未生效，紧跟的 POST 会 409；
  // 因此 DELETE 后稍作等待，并对 409 做有限次重试。
  const LAST_WRITE = 3;
  for (let attempt = 1; attempt <= LAST_WRITE; attempt++) {
    try {
      await fetch(objUrl, { method: 'DELETE', headers: baseHeaders });
    } catch {
      /* 旧文件不存在忽略 */
    }
    await new Promise((r) => setTimeout(r, attempt === 1 ? 1500 : 500));
    const res = await fetch(objUrl, {
      method: 'POST',
      headers: { ...baseHeaders, 'x-upsert': 'false' },
      body: payload,
    });
    if (res.ok) return true;
    const detail = await res.text().catch(() => '');
    const isDuplicate = detail.includes('KeyAlreadyExists') || detail.includes('Duplicate');
    if (!isDuplicate || attempt === LAST_WRITE) {
      throw new Error(`Supabase 写入失败 (${res.status}): ${detail}`);
    }
  }
  return false;
}

async function run(dryRun: boolean) {
  const fresh: any[] = [];
  const perSource: any = {};
  for (const a of ADAPTERS) {
    try {
      const items = await a.fn();
      perSource[a.key] = items.length;
      fresh.push(...items);
    } catch (e: any) {
      perSource[a.key] = 0;
      DIAG.push({ source: a.key, error: String(e?.message || e) });
    }
  }

  const existing = await readExisting();
  const seen = new Set();
  const merged: any[] = [];
  for (const it of [...fresh, ...existing]) {
    const key = it.url || it.id;
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    merged.push(it);
  }
  merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const finalItems = merged.slice(0, MAX_ITEMS);

  const counts = {
    youtube: finalItems.filter((i) => i.platform === 'youtube').length,
    bilibili: finalItems.filter((i) => i.platform === 'bilibili').length,
    weibo: finalItems.filter((i) => i.platform === 'weibo').length,
    douyin: finalItems.filter((i) => i.platform === 'douyin').length,
    tiktok: finalItems.filter((i) => i.platform === 'tiktok').length,
    xiaohongshu: finalItems.filter((i) => i.platform === 'xiaohongshu').length,
  };

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      fresh: fresh.length,
      perSource,
      diag: DIAG,
      samples: fresh.slice(0, 8).map((i) => ({ platform: i.platform, title: i.title, date: i.date, url: i.url })),
    };
  }
  if (fresh.length === 0) {
    return { ok: true, skipped: true, reason: 'no_new_data', existing: existing.length, diag: DIAG };
  }
  try {
    await writeToSupabase(finalItems, counts, Date.now());
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e), fresh: fresh.length, perSource, diag: DIAG };
  }
  return { ok: true, fresh: fresh.length, existing: existing.length, total: finalItems.length, perSource, counts, diag: DIAG };
}

export default async function handler(req: any, res: any) {
  // 可选鉴权：若设置了 CRON_SECRET，调用方须带 Authorization: Bearer <secret>
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers?.authorization || '';
    if (auth !== `Bearer ${secret}`) {
      res.status(401).json({ ok: false, error: 'unauthorized' });
      return;
    }
  }

  let dryRun = process.env.DRY_RUN === '1';
  try {
    if (req.method === 'GET') {
      dryRun = dryRun || (req.query && req.query.dryRun === '1');
    } else if (req.body && typeof req.body === 'object') {
      dryRun = dryRun || req.body.dryRun === true;
    }
  } catch {
    /* ignore */
  }

  const result = await run(dryRun);
  res.status(200).json(result);
}
