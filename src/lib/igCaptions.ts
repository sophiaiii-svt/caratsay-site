// Instagram 文案离线查找库。
// 数据由脚本从本地 scrape_ig.py 抓取的 ig_scrape.json 生成（key = IG shortcode）。
// 这些文案是已抓取到的成员公开动态，打包进前端后可即时（零网络）自动识别，
// 解决「服务端出网受限、Instagram 需登录」导致云端无法识别的问题。
import captions from './ig-captions.json';

export interface IgCaption {
  caption: string;
  date: string;
  memberId: string;
  handle: string;
  name: string;
  kind: string;
}

const MAP = captions as Record<string, IgCaption>;

export interface IgLookupResult {
  ok: true;
  platform: 'instagram';
  igCaption: string;
  igMemberId: string;
  igName: string;
  publishedAt: string;
}

/** 根据 IG 链接的 shortcode 在离线库中查找已抓取的文案与时间 */
export function lookupIgCaption(url: string): IgLookupResult | null {
  const m = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([^/?#]+)/i);
  if (!m) return null;
  const entry = MAP[m[1]];
  if (!entry) return null;
  return {
    ok: true,
    platform: 'instagram',
    igCaption: entry.caption || '',
    igMemberId: entry.memberId,
    igName: entry.name,
    publishedAt: (entry.date || '').slice(0, 16),
  };
}
