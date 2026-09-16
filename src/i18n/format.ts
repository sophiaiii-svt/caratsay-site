import type { Lang } from './translations';

/** 语言 → BCP47 locale，用于 Intl 系列格式化 */
export const LOCALE: Record<Lang, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ko: 'ko-KR',
  ja: 'ja-JP',
};

/** 完整日期：2026年8月24日 */
export function fmtDate(lang: Lang, d: Date): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/** 日期 + 时间：2026年8月24日 14:05 */
export function fmtDateTime(lang: Lang, d: Date): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** 简短日期：2026/8/24（用于紧凑展示） */
export function fmtDateShort(lang: Lang, d: Date): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** 星期表头（周日优先），如 ['日','一','二'...] / ['Sun','Mon'...] */
export function fmtWeekdayShort(lang: Lang): string[] {
  const loc = LOCALE[lang];
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(new Date(2023, 0, 1 + i)),
  );
}

/** 星期表头（周一优先），用于月历网格首列=周一：['一','二',...,'日'] */
export function fmtWeekdayMonday(lang: Lang): string[] {
  const wd = fmtWeekdayShort(lang); // 周日优先
  return [...wd.slice(1), wd[0]]; // 把周日移到末尾
}

/** 相对时间：刚刚 / 5分钟前 / 3天前（numeric:auto 自动处理「刚刚」「昨天」等） */
export function fmtRelative(lang: Lang, date: Date): string {
  const rtf = new Intl.RelativeTimeFormat(LOCALE[lang], { numeric: 'auto' });
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return rtf.format(Math.round(diffSec), 'second');
  const min = diffSec / 60;
  if (Math.abs(min) < 60) return rtf.format(Math.round(min), 'minute');
  const hr = min / 60;
  if (Math.abs(hr) < 24) return rtf.format(Math.round(hr), 'hour');
  const day = hr / 24;
  if (Math.abs(day) < 30) return rtf.format(Math.round(day), 'day');
  const mon = day / 30;
  if (Math.abs(mon) < 12) return rtf.format(Math.round(mon), 'month');
  const yr = mon / 12;
  return rtf.format(Math.round(yr), 'year');
}
