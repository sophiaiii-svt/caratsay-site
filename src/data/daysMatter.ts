import { members } from '@/data';

/** 成员中文名映射（与全站其余板块保持一致） */
export const MEMBER_CN: Record<string, string> = {
  scoups: '崔胜澈',
  jeonghan: '尹净汉',
  joshua: '洪知秀',
  jun: '文俊辉',
  hoshi: '权顺荣',
  wonwoo: '全圆佑',
  woozi: '李知勋',
  the8: '徐明浩',
  mingyu: '金珉奎',
  dk: '李硕珉',
  seungkwan: '夫胜宽',
  vernon: '崔瀚率',
  dino: '李灿',
};

export interface MemberBirthday {
  id: string;
  memberId: string;
  stageName: string;
  cnName: string;
  month: number;
  day: number;
  birthYear: number;
  emoji: string;
  accent: string;
}

/** 13 位成员的生日（由 members.birthday 解析，格式 YYYY.MM.DD） */
export const memberBirthdays: MemberBirthday[] = members.map((m) => {
  const [y, mo, d] = m.birthday.split('.').map(Number);
  return {
    id: `birth-${m.id}`,
    memberId: m.id,
    stageName: m.stageName,
    cnName: MEMBER_CN[m.id] ?? m.stageName,
    month: mo,
    day: d,
    birthYear: y,
    emoji: m.emoji,
    accent: m.representativeColor,
  };
});

/* ───────────────── 成员入伍（兵役）节点 ───────────────── */
export interface MemberEnlistment {
  memberId: string;
  stageName: string;
  cnName: string;
  emoji: string;
  accent: string;
  enlistDate?: string; // YYYY-MM-DD，免役留空
  dischargeDate?: string; // YYYY-MM-DD，免役留空
  type?: string; // 兵种，免役留空
  exempt?: boolean;
  exemptReason?: string;
}

export type EnlistStatus = 'exempt' | 'scheduled' | 'serving' | 'discharged';

/** 13 位成员兵役时间线（依据 PLEDIS 官方公告公开汇总）
 *  - 免役：S.Coups（伤病免役 / 兵役体检 5 级）
 *           Joshua 美籍 / Jun、The8 中籍，不须服韩国兵役 */
export const memberEnlistments: MemberEnlistment[] = [
  { memberId: 'scoups', stageName: 'S.Coups', cnName: '崔胜澈', emoji: '🍒', accent: '#E8555E', exempt: true, exemptReason: '伤病免役（兵役体检 5 级）' },
  { memberId: 'jeonghan', stageName: 'Jeonghan', cnName: '尹净汉', emoji: '👼', accent: '#B8B8D1', enlistDate: '2024-09-26', dischargeDate: '2026-06-25', type: '替代役（社会服务要员）' },
  { memberId: 'joshua', stageName: 'Joshua', cnName: '洪知秀', emoji: '🦌', accent: '#7BA7D9', exempt: true, exemptReason: '美国籍 · 免于服兵役' },
  { memberId: 'jun', stageName: 'Jun', cnName: '文俊辉', emoji: '🐱', accent: '#E8A87C', exempt: true, exemptReason: '中国籍 · 免于服兵役' },
  { memberId: 'hoshi', stageName: 'Hoshi', cnName: '权顺荣', emoji: '🐯', accent: '#F2A900', enlistDate: '2025-09-16', dischargeDate: '2027-03-15', type: '陆军现役' },
  { memberId: 'wonwoo', stageName: 'Wonwoo', cnName: '全圆佑', emoji: '🦊', accent: '#4A6FA5', enlistDate: '2025-04-03', dischargeDate: '2027-01-02', type: '替代役（社会服务要员）' },
  { memberId: 'woozi', stageName: 'Woozi', cnName: '李知勋', emoji: '🍙', accent: '#9B72CF', enlistDate: '2025-09-15', dischargeDate: '2027-03-14', type: '陆军现役' },
  { memberId: 'the8', stageName: 'The8', cnName: '徐明浩', emoji: '🐸', accent: '#06D6A0', exempt: true, exemptReason: '中国籍 · 免于服兵役' },
  { memberId: 'mingyu', stageName: 'Mingyu', cnName: '金珉奎', emoji: '🥔', accent: '#6C757D', enlistDate: '2026-09-10', dischargeDate: '2028-06-09', type: '替代役（社会服务要员）' },
  { memberId: 'dk', stageName: 'DK', cnName: '李硕珉', emoji: '🐶', accent: '#52B788', enlistDate: '2026-09-08', dischargeDate: '2028-03-07', type: '陆军现役' },
  { memberId: 'seungkwan', stageName: 'Seungkwan', cnName: '夫胜宽', emoji: '🍊', accent: '#FF8C42', enlistDate: '2026-10-26', dischargeDate: '2028-04-25', type: '陆军军乐兵' },
  { memberId: 'vernon', stageName: 'Vernon', cnName: '崔瀚率', emoji: '🐻‍❄️', accent: '#3D5A80', enlistDate: '2026-08-20', dischargeDate: '2028-05-19', type: '替代役（社会服务要员）' },
  { memberId: 'dino', stageName: 'Dino', cnName: '李灿', emoji: '🦦', accent: '#C77DFF', enlistDate: '2026-10-26', dischargeDate: '2028-04-25', type: '陆军军乐兵' },
];

/** 解析 YYYY-MM-DD 为本地 00:00 */
export const parseISO = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

/** 兵役状态（随 now 实时计算）：待入伍 / 服役中 / 已退伍 / 免役 */
export function getEnlistStatus(e: MemberEnlistment, nowMs: number): EnlistStatus {
  if (e.exempt) return 'exempt';
  const en = parseISO(e.enlistDate!).getTime();
  const dis = parseISO(e.dischargeDate!).getTime();
  if (nowMs < en) return 'scheduled';
  if (nowMs < dis) return 'serving';
  return 'discharged';
}

/** 团体 & 粉丝固定纪念日 */
export const DEBUT = { year: 2015, month: 5, day: 26 }; // 出道
export const CARAT_DAY = { year: 2016, month: 2, day: 14 }; // 克拉日（粉丝名 2016.02.14 公布）

/* ───────────────── 时间工具 ───────────────── */

export interface CountdownParts {
  d: number;
  h: number;
  m: number;
  s: number;
  ms: number;
  isPast: boolean;
}

export function splitDuration(ms: number): CountdownParts {
  const clamped = Math.max(0, ms);
  const total = Math.floor(clamped / 1000);
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
    ms: clamped,
    isPast: ms <= 0,
  };
}

export const pad = (n: number) => String(n).padStart(2, '0');

/** 下一次该月日出现的日期（今年或明年 00:00 本地时间） */
export function nextOccurrence(month: number, day: number, now: Date): Date {
  const y = now.getFullYear();
  let d = new Date(y, month - 1, day, 0, 0, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d = new Date(y + 1, month - 1, day, 0, 0, 0, 0);
  }
  return d;
}

/** 下一次生日（含是否已过今年） */
export function nextBirthday(b: MemberBirthday, now: Date): { date: Date; age: number } {
  const date = nextOccurrence(b.month, b.day, now);
  const age = date.getFullYear() - b.birthYear;
  return { date, age };
}

/** 倒计时目标（毫秒）。过去则 isPast=true */
export function countdownTo(targetMs: number, nowMs: number): CountdownParts {
  return splitDuration(targetMs - nowMs);
}

/** 距今天数（用于日程排序，可正可负） */
export function daysUntil(targetMs: number, nowMs: number): number {
  return Math.ceil((targetMs - nowMs) / 86400000);
}

/** 本地日期 dayNumber（基于本地时区，避免 UTC 午夜偏移导致差 1 天） */
function localDayNumber(ms: number): number {
  const d = new Date(ms);
  return Math.floor((ms - d.getTimezoneOffset() * 60000) / 86400000);
}

/** 目标日期与现在的本地天数差。
 * 返回：days > 0 未来还有多少天；days < 0 已经过去多少天；days = 0 今天。 */
export function diffDaysLocal(targetMs: number, nowMs: number): { days: number; isToday: boolean; isPast: boolean } {
  const days = localDayNumber(targetMs) - localDayNumber(nowMs);
  return { days, isToday: days === 0, isPast: days < 0 };
}

/** 成员生日相对当前日期的距离（以「今年生日」为锚点）。
 * direction: 'future' = 今年生日还没到；'past' = 今年生日已过。
 * 今天生日由调用方单独渲染。 */
export function relativeBirthday(
  b: MemberBirthday,
  now: Date
): { date: Date; age: number; direction: 'past' | 'future' } {
  const y = now.getFullYear();
  const thisYear = new Date(y, b.month - 1, b.day, 0, 0, 0, 0);
  if (thisYear.getTime() > now.getTime()) {
    return { date: thisYear, age: y - b.birthYear, direction: 'future' };
  }
  return { date: thisYear, age: y - b.birthYear, direction: 'past' };
}

export const dot = (s: string) => s.replace(/-/g, '.');

/** 'YYYY-MM-DD' → 'YYYY.MM.DD' */
export function fmtDate(y: number, m: number, d: number): string {
  return `${y}.${pad(m)}.${pad(d)}`;
}
