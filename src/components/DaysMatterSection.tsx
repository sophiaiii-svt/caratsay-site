import { useState, useEffect, useMemo, type ReactNode } from 'react';
import {
  memberBirthdays,
  DEBUT,
  CARAT_DAY,
  nextOccurrence,
  nextBirthday,
  diffDaysLocal,
  countdownTo,
  fmtDate,
  memberEnlistments,
  getEnlistStatus,
  parseISO,
  type MemberEnlistment,
  type EnlistStatus,
} from '@/data/daysMatter';
import { useI18n } from '@/i18n/LanguageContext';
import { fmtWeekdayShort, fmtWeekdayMonday } from '@/i18n/format';
import SectionTitle from './SectionTitle';
import type { CountdownParts, MemberBirthday } from '@/data/daysMatter';

/* ────────────────────── 本地存储 Hook ────────────────────── */
function useLocalStorage<T>(key: string, initial: T | (() => T)) {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {
      /* ignore */
    }
  }, [key, val]);
  return [val, setVal] as const;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/* ────────────────────── 类型 ────────────────────── */
interface ScheduleItem {
  id: string;
  title: string;
  date: string;
  note?: string;
  importance?: number; // 1-5 💎
  createdAt: number;
}
interface ManualCountdown {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  importance?: number; // 1-5 💎
  createdAt: number;
}
interface Concert {
  id: string;
  name: string;
  date: string;
  country: string;
  city: string;
  createdAt: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

/* ────────────────────── 倒计时翻牌 ────────────────────── */
function Flip({ parts, accent, size = 'md' }: { parts: CountdownParts; accent: string; size?: 'sm' | 'md' }) {
  const big = size === 'md';
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between gap-1.5 sm:gap-2 tabular-nums w-full">
      {[
        { v: String(parts.d), u: t('daysmatter.unitDay') },
        { v: pad(parts.h), u: t('daysmatter.unitHour') },
        { v: pad(parts.m), u: t('daysmatter.unitMin') },
        { v: pad(parts.s), u: t('daysmatter.unitSec') },
      ].map((x) => (
        <div key={x.u} className="flex flex-col items-center flex-1 min-w-0">
          <div
            className={`w-full min-w-[2.2rem] px-1 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-white/85 backdrop-blur border shadow-sm flex items-center justify-center ${
              big ? 'text-xl sm:text-2xl lg:text-3xl' : 'text-base sm:text-xl'
            } font-black`}
            style={{ borderColor: `${accent}33`, color: accent }}
          >
            {x.v}
          </div>
          <span className="text-[9px] sm:text-[11px] text-muted-foreground mt-1 tracking-wider">{x.u}</span>
        </div>
      ))}
    </div>
  );
}

/* ────────────────────── 时区 Tab ────────────────────── */
const TZ_PRESETS = [
  { labelKey: 'daysmatter.tzChina', tz: 'Asia/Shanghai' },
  { labelKey: 'daysmatter.tzKorea', tz: 'Asia/Seoul' },
  { labelKey: 'daysmatter.tzJapan', tz: 'Asia/Tokyo' },
  { labelKey: 'daysmatter.tzUSEast', tz: 'America/New_York' },
  { labelKey: 'daysmatter.tzUSWest', tz: 'America/Los_Angeles' },
  { labelKey: 'daysmatter.tzUK', tz: 'Europe/London' },
];

function zoneInfo(now: number, tz: string) {
  const d = new Date(now);
  const time = new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
  const date = new Intl.DateTimeFormat('zh-CN', {
    timeZone: tz,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(d);
  const off =
    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value ?? '';
  return { time, date, off };
}

function TimezoneTab({ now }: { now: number }) {
  const [tz, setTz] = useLocalStorage('dm_tz', 'Asia/Shanghai');
  const cur = zoneInfo(now, tz);
  const quick = ['Asia/Seoul', 'Asia/Shanghai', 'America/Los_Angeles'];
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="relative rounded-3xl border border-[#F7CAC9]/60 bg-white/70 backdrop-blur-sm shadow-lg p-6 sm:p-8 overflow-hidden">
        <div className="absolute -top-16 -right-12 w-56 h-56 rounded-full bg-[#F7CAC9]/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-[#92A8D1]/25 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <p className="text-[11px] font-bold tracking-[0.2em] text-[#E8555E] mb-1">{t('daysmatter.tzTitle')}</p>
              <p className="text-sm text-muted-foreground">{cur.off}</p>
            </div>
            <select
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="rounded-xl border border-[#F7CAC9] bg-white px-3 py-2 text-sm font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F7CAC9]"
            >
              {TZ_PRESETS.map((p) => (
                <option key={p.tz} value={p.tz}>
                  {t(p.labelKey)}
                </option>
              ))}
            </select>
          </div>
          <div className="text-center">
            <div className="text-5xl sm:text-7xl font-black svt-gradient-text tabular-nums tracking-tight">
              {cur.time}
            </div>
            <p className="text-sm text-muted-foreground mt-2">{cur.date}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {quick.map((q) => {
          const info = zoneInfo(now, q);
          const label = TZ_PRESETS.find((p) => p.tz === q)?.labelKey ?? q;
          return (
            <button
              key={q}
              onClick={() => setTz(q)}
              className={`rounded-2xl border p-4 text-left transition-all hover:shadow-md ${
                tz === q ? 'border-[#E8555E] bg-[#F7CAC9]/15' : 'border-border bg-card'
              }`}
            >
              <p className="text-xs font-bold text-muted-foreground mb-1 truncate">{t(label)}</p>
              <p className="text-2xl font-black tabular-nums svt-gradient-text">{info.time}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{info.off}</p>
            </button>
          );
        })}
      </div>
      <p className="text-center text-[11px] text-muted-foreground/80">
        {t('daysmatter.clockHint')}
      </p>
    </div>
  );
}

/* ────────────────────── 倒数日 Tab ────────────────────── */
function BirthdayCard({ b, now }: { b: MemberBirthday; now: number }) {
  const nowDate = new Date(now);
  const isToday = nowDate.getMonth() + 1 === b.month && nowDate.getDate() === b.day;
  const { t, L } = useI18n();
  const currentAge = nowDate.getFullYear() - b.birthYear;
  const { date: next, age: nextAge } = nextBirthday(b, nowDate);
  const parts = countdownTo(next.getTime(), now);
  return (
    <div
      className="relative rounded-3xl border border-border bg-card p-5 overflow-hidden transition-all hover:shadow-md animate-fade-in flex flex-col h-full"
      style={{ boxShadow: `inset 4px 0 0 ${b.accent}` }}
    >
      <div className="flex items-center gap-3 mb-4">
        <span
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm shrink-0"
          style={{ background: `${b.accent}1A`, boxShadow: `0 0 0 3px ${b.accent}55` }}
        >
          {b.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-base truncate">
            {b.stageName} <span className="text-sm font-normal text-muted-foreground">{L(b.cnName)}</span>
            <span className="ml-1" title={t('daysmatter.birthdayWord')}>🎂</span>
          </p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {fmtDate(b.birthYear, b.month, b.day)} · 下次 {b.month}.{pad(b.day)}
          </p>
        </div>
      </div>

      {isToday ? (
        <div className="flex-1 flex items-center justify-center py-4">
          <p className="text-center text-xl font-black" style={{ color: b.accent }}>
            {t('daysmatter.birthdayHappy', { age: currentAge })}
          </p>
        </div>
      ) : (
        <>
          <p className="text-center text-xs text-muted-foreground mb-3">
            {t('daysmatter.birthdayUntil', { n: parts.d, age: nextAge })}
          </p>
          <div className="mt-auto">
            <Flip parts={parts} accent={b.accent} size="md" />
          </div>
        </>
      )}
      </div>
  );
}

/* ────────────────────── 成员入伍卡片 ────────────────────── */
const ENLIST_STATUS_META: Record<EnlistStatus, { labelKey: string; color: string }> = {
  exempt: { labelKey: 'daysmatter.military.exempt', color: '#9CA3AF' },
  scheduled: { labelKey: 'daysmatter.military.scheduled', color: '#5B7CF7' },
  serving: { labelKey: 'daysmatter.military.serving', color: '#E8555E' },
  discharged: { labelKey: 'daysmatter.military.discharged', color: '#06D6A0' },
};
const ENLIST_ORDER: Record<EnlistStatus, number> = {
  scheduled: 0,
  serving: 1,
  discharged: 2,
  exempt: 3,
};

function EnlistCard({ e, now }: { e: MemberEnlistment; now: number }) {
  const status = getEnlistStatus(e, now);
  const enMs = e.enlistDate ? parseISO(e.enlistDate).getTime() : 0;
  const disMs = e.dischargeDate ? parseISO(e.dischargeDate).getTime() : 0;
  const sm = ENLIST_STATUS_META[status];
  const enDiff = e.enlistDate ? diffDaysLocal(enMs, now) : null;
  const disDiff = e.dischargeDate ? diffDaysLocal(disMs, now) : null;
  const { t } = useI18n();

  let big: ReactNode;
  let tip = '';
  if (status === 'exempt') {
    big = <span className="text-lg font-bold" style={{ color: sm.color }}>{t(sm.labelKey)}</span>;
    tip = e.exemptReason ?? '';
  } else if (enDiff && enDiff.isToday) {
    big = <span className="text-xl font-black" style={{ color: sm.color }}>{t('daysmatter.enlistToday')}</span>;
    tip = `${e.type} · ${e.enlistDate}`;
  } else if (status === 'scheduled' && enDiff) {
    big = (
      <>
        <span className="text-3xl font-black tabular-nums" style={{ color: sm.color }}>{enDiff.days}</span>
        <span className="text-sm ml-1 text-muted-foreground">{t('daysmatter.enlistDaysAfter')}</span>
      </>
    );
    tip = `${e.type} · ${e.enlistDate}`;
  } else if (status === 'serving' && enDiff && disDiff) {
    const since = Math.abs(enDiff.days);
    const left = disDiff.days;
    big = (
      <>
        <span className="text-3xl font-black tabular-nums" style={{ color: sm.color }}>{since}</span>
        <span className="text-sm ml-1 text-muted-foreground">{t('daysmatter.enlistDaysBefore')}</span>
      </>
    );
    tip = t('daysmatter.enlistServed', { n: since, m: left }) + ` · ${e.type}`;
  } else {
    const ago = disDiff ? Math.abs(disDiff.days) : 0;
    big = <span className="text-xl font-bold" style={{ color: sm.color }}>{t('daysmatter.enlistDischarged', { n: ago })}</span>;
    tip = `${e.type} · ${e.enlistDate} ~ ${e.dischargeDate}`;
  }

  return (
    <div
      className="relative rounded-3xl border border-border bg-card p-5 overflow-hidden transition-all hover:shadow-md flex flex-col h-full"
      style={{ boxShadow: `inset 4px 0 0 ${e.accent}` }}
    >
      <div className="flex items-center gap-3 mb-3">
        <span
          className="w-11 h-11 rounded-full flex items-center justify-center text-xl shadow-sm shrink-0"
          style={{ background: `${e.accent}1A`, boxShadow: `0 0 0 3px ${e.accent}55` }}
        >
          {e.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-base truncate">
            {e.stageName} <span className="text-sm font-normal text-muted-foreground">{e.cnName}</span>
          </p>
        </div>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: `${sm.color}1A`, color: sm.color }}
        >
          {t(sm.labelKey)}
        </span>
      </div>
      <div className="flex-1 flex items-center">{big}</div>
      <p className="text-[11px] text-muted-foreground tabular-nums mt-2 truncate">{tip}</p>
    </div>
  );
}

function CountdownTab({ now }: { now: number }) {
  const { t } = useI18n();
  const debutNext = nextOccurrence(DEBUT.month, DEBUT.day, new Date(now));
  const debutParts = countdownTo(debutNext.getTime(), now);
  const debutYears = debutNext.getFullYear() - DEBUT.year;
  const debutCurrentAge = new Date(now).getFullYear() - DEBUT.year;
  const isDebutToday =
    new Date(now).getMonth() + 1 === DEBUT.month && new Date(now).getDate() === DEBUT.day;

  const caratNext = nextOccurrence(CARAT_DAY.month, CARAT_DAY.day, new Date(now));
  const caratParts = countdownTo(caratNext.getTime(), now);
  const caratYears = caratNext.getFullYear() - CARAT_DAY.year;
  const caratCurrentAge = new Date(now).getFullYear() - CARAT_DAY.year;
  const isCaratToday =
    new Date(now).getMonth() + 1 === CARAT_DAY.month && new Date(now).getDate() === CARAT_DAY.day;

  return (
    <div className="space-y-8">
      {/* 成员生日 */}
      <section>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-xl">🎂</span>
          <h3 className="text-lg font-bold">{t('daysmatter.birthdayLabel')}</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-[#F7CAC9]/50 to-transparent" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {memberBirthdays.map((b, i) => (
            <div key={b.id} className="animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
              <BirthdayCard b={b} now={now} />
            </div>
          ))}
        </div>
      </section>

      {/* 团体 & 粉丝纪念 */}
      <section>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-xl">💎</span>
          <h3 className="text-lg font-bold">{t('daysmatter.groupFanLabel')}</h3>
          <div className="flex-1 h-px bg-gradient-to-r from-[#F7CAC9]/50 to-transparent" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative rounded-3xl border border-[#F7CAC9]/60 bg-white/70 backdrop-blur-sm shadow-lg p-6 overflow-hidden">
            <div className="absolute -top-12 -right-10 w-44 h-44 rounded-full bg-[#F7CAC9]/25 blur-3xl" />
            <div className="relative text-center">
              <p className="text-xs font-bold tracking-[0.2em] text-[#E8555E] mb-1">{t('daysmatter.debutBadge')}</p>
              <p className="text-sm text-muted-foreground mb-3 tabular-nums">
                {fmtDate(DEBUT.year, DEBUT.month, DEBUT.day)} {t('daysmatter.debutLine', { age: debutCurrentAge })}
              </p>
              {isDebutToday ? (
                <p className="text-3xl font-black svt-gradient-text mb-3">{t('daysmatter.debutHappy', { age: debutYears })}</p>
              ) : (
                <>
                  <p className="text-sm font-bold mb-2">{t('daysmatter.debutUntil', { age: debutYears })}</p>
                  <Flip parts={debutParts} accent="#E8555E" />
                  <p className="text-[11px] text-muted-foreground mt-3">{t('daysmatter.debutComing', { age: debutYears })}</p>
                </>
              )}
            </div>
          </div>
          <div className="relative rounded-3xl border border-[#F7CAC9]/60 bg-white/70 backdrop-blur-sm shadow-lg p-6 overflow-hidden">
            <div className="absolute -top-12 -right-10 w-44 h-44 rounded-full bg-[#92A8D1]/25 blur-3xl" />
            <div className="relative text-center">
              <p className="text-xs font-bold tracking-[0.2em] text-[#E08E9D] mb-1">{t('daysmatter.caratBadge')}</p>
              <p className="text-sm text-muted-foreground mb-3 tabular-nums">
                {fmtDate(CARAT_DAY.year, CARAT_DAY.month, CARAT_DAY.day)} {t('daysmatter.caratLine', { age: caratCurrentAge })}
              </p>
              {isCaratToday ? (
                <p className="text-3xl font-black svt-gradient-text mb-3">{t('daysmatter.caratHappy', { age: caratYears })}</p>
              ) : (
                <>
                  <p className="text-sm font-bold mb-2">{t('daysmatter.caratUntil', { age: caratYears })}</p>
                  <Flip parts={caratParts} accent="#E08E9D" />
                  <p className="text-[11px] text-muted-foreground mt-3">{t('daysmatter.caratCelebrate')}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 成员入伍进度（随日期实时更新） */}
      <section>
        <div className="flex items-center gap-2.5 mb-4">
          <span className="text-xl">🪖</span>
          <h3 className="text-lg font-bold">{t('daysmatter.enlistTitle')}</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8555E]/15 text-[#E8555E]">{t('daysmatter.enlistBadge')}</span>
          <div className="flex-1 h-px bg-gradient-to-r from-[#F7CAC9]/50 to-transparent" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[...memberEnlistments]
            .sort((a, b) => {
              const sa = ENLIST_ORDER[getEnlistStatus(a, now)];
              const sb = ENLIST_ORDER[getEnlistStatus(b, now)];
              if (sa !== sb) return sa - sb;
              const da = a.enlistDate ? parseISO(a.enlistDate).getTime() : 0;
              const db = b.enlistDate ? parseISO(b.enlistDate).getTime() : 0;
              return da - db;
            })
            .map((e, i) => (
              <div key={e.memberId} className="animate-fade-in" style={{ animationDelay: `${i * 0.03}s` }}>
                <EnlistCard e={e} now={now} />
              </div>
            ))}
        </div>
        <p className="text-center text-[11px] text-muted-foreground/80 mt-4">
          {t('daysmatter.enlistNote')}
        </p>
      </section>

    </div>
  );
}

/* ────────────────────── 日程 Tab（月历视图）────────────────────── */
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getCalendarDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 周一开头
  const start = new Date(year, month, 1 - startOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

interface CalendarEvent {
  id: string;
  title: string;
  emoji: string;
  accent: string;
  date: Date;
  kind: '生日' | '团体' | '粉丝' | '我的日程' | '我的倒数日' | '演唱会' | '入伍';
  note?: string;
  manualId?: string; // 兼容旧字段
  source?: 'schedule' | 'countdown' | 'concert';
  sourceId?: string;
  age?: number; // 团体/粉丝纪念日：第几周年（岁）
  importance: number; // 0-5 💎
  enlistDate?: string;
  dischargeDate?: string;
}

const KIND_LABEL_KEY: Record<CalendarEvent['kind'], string> = {
  '生日': 'daysmatter.kindBirthday',
  '团体': 'daysmatter.kindGroup',
  '粉丝': 'daysmatter.kindFan',
  '我的日程': 'daysmatter.kindMine',
  '我的倒数日': 'daysmatter.kindMyCountdown',
  '演唱会': 'daysmatter.kindConcert',
  '入伍': 'daysmatter.kindEnlist',
};

function formatEventDate(d: Date, weekday: string) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${weekday}`;
}

function milestoneText(diff: { days: number; isToday: boolean; isPast: boolean }, t: (k: string, p?: Record<string, string | number | undefined>) => string) {
  const abs = Math.abs(diff.days);
  if (diff.isToday) return t('daysmatter.todayEvent') + ' 🎉';
  if (abs === 0) return null;
  if (!diff.isPast) {
    const list = [100, 200, 365, 500, 999, 1000];
    if (list.includes(abs)) return `${t('daysmatter.futurePrefix')} ${abs} ${t('daysmatter.daySuffix')} ${t('daysmatter.reminder')}`;
  }
  if (diff.isPast) {
    if (abs % 100 === 0 || abs === 999) return `${t('daysmatter.pastPrefix')} ${abs} ${t('daysmatter.daySuffix')} ${t('daysmatter.reminder')}`;
    if (abs % 365 === 0) return `${t('daysmatter.pastPrefix')} ${abs / 365} 周年 ${t('daysmatter.reminder')}`;
  }
  return null;
}

function ScheduleCountdownList({
  events,
  now,
  onDelete,
}: {
  events: CalendarEvent[];
  now: number;
  onDelete?: (e: CalendarEvent) => void;
}) {
  const [filter, setFilter] = useState<'all' | 'important'>('all');
  const { lang, t } = useI18n();
  const WD = fmtWeekdayShort(lang);

  const computeDiff = (e: CalendarEvent) => {
    const diff = diffDaysLocal(e.date.getTime(), now);
    // 成员生日如果今年已过，自动显示距离下一个生日还有多少天
    if (e.kind === '生日' && diff.isPast) {
      const next = new Date(e.date.getFullYear() + 1, e.date.getMonth(), e.date.getDate());
      return diffDaysLocal(next.getTime(), now);
    }
    return diff;
  };

  const displayDate = (e: CalendarEvent) => {
    if (e.kind === '生日' && diffDaysLocal(e.date.getTime(), now).isPast) {
      const next = new Date(e.date.getFullYear() + 1, e.date.getMonth(), e.date.getDate());
      return `${formatEventDate(next, WD[next.getDay()])}（${t('daysmatter.birthdayWord')}）`;
    }
    return formatEventDate(e.date, WD[e.date.getDay()]);
  };

  const rows = useMemo(() => {
    const list = events
      .map((e) => ({ e, diff: computeDiff(e) }))
      .filter(({ e }) => (filter === 'all' ? true : e.importance >= 3));
    const today = list.filter((x) => x.diff.isToday);
    const future = list.filter((x) => !x.diff.isToday && !x.diff.isPast).sort((a, b) => a.diff.days - b.diff.days);
    const past = list.filter((x) => x.diff.isPast).sort((a, b) => b.diff.days - a.diff.days);
    return [...today, ...future, ...past];
  }, [events, now, filter]);

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">⏳</span>
          <h3 className="text-lg font-bold">{t('daysmatter.scheduleTitle')}</h3>
        </div>
        <div className="flex items-center gap-1 bg-muted/60 rounded-full p-1">
          {[
            { id: 'all', label: t('daysmatter.filterAll') },
            { id: 'important', label: t('daysmatter.filterImportant') },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id as 'all' | 'important')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                filter === opt.id
                  ? 'svt-gradient text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-4">
          {filter === 'important'
            ? t('daysmatter.emptyImportant')
            : t('daysmatter.emptySchedule')}
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map(({ e, diff }) => {
            const isEnlist = e.kind === '入伍';
            let days = Math.abs(diff.days);
            let accent = diff.isToday ? '#E8555E' : diff.isPast ? '#F97316' : '#5B7CF7';
            let labelPrefix = diff.isToday ? t('daysmatter.todayPrefix') : diff.isPast ? t('daysmatter.pastPrefix') : t('daysmatter.futurePrefix');
            let daySuffix = t('daysmatter.daySuffix');
            if (isEnlist && e.enlistDate && e.dischargeDate) {
              const en = parseDate(e.enlistDate).getTime();
              const dis = parseDate(e.dischargeDate).getTime();
              const sd = diffDaysLocal(en, now);
              const dd = diffDaysLocal(dis, now);
              if (sd.isToday) {
                labelPrefix = t('daysmatter.todayPrefix');
                days = 0;
                daySuffix = ' ' + t('daysmatter.enlistWord') + ' 🎉';
                accent = '#E8555E';
              } else if (!sd.isPast) {
                labelPrefix = t('daysmatter.futurePrefix');
                days = sd.days;
                daySuffix = t('daysmatter.enlistDaySuffix');
                accent = '#5B7CF7';
              } else if (!dd.isPast) {
                labelPrefix = t('daysmatter.enlistedPrefix');
                days = Math.abs(sd.days);
                daySuffix = t('daysmatter.daySuffix');
                accent = '#E8555E';
              } else {
                labelPrefix = t('daysmatter.dischargedPrefix');
                days = Math.abs(dd.days);
                daySuffix = t('daysmatter.dischargedDaySuffix');
                accent = '#06D6A0';
              }
            }
            const ms = isEnlist ? null : milestoneText(diff, t);
            return (
              <div
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 hover:shadow-sm transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{e.emoji}</span>
                    <p className="font-bold text-sm truncate">{e.title}</p>
                    {e.importance > 0 && (
                      <span className="text-[11px] tracking-tight" style={{ color: e.accent }}>
                        {Array.from({ length: e.importance }, () => '💎').join('')}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                    {displayDate(e)}
                    {e.note ? ` · ${e.note}` : ''}
                  </p>
                  {ms && (
                    <p className="text-[11px] font-bold mt-1" style={{ color: accent }}>
                      🔔 {ms}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-xs text-muted-foreground">{labelPrefix}</span>
                    {labelPrefix !== t('daysmatter.todayPrefix') && (
                      <span
                        className="text-2xl sm:text-3xl font-black tabular-nums leading-none ml-1"
                        style={{ color: accent }}
                      >
                        {days}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-0.5">{daySuffix}</span>
                  </div>
                  {e.source && onDelete && (
                    <button
                      onClick={() => onDelete(e)}
                      className="text-xs text-[#E8555E] hover:underline shrink-0"
                      title={t('daysmatter.deleteTitle')}
                    >
                      {t('daysmatter.deleteTitle')}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ScheduleTab({ now }: { now: number }) {
  const [list, setList] = useLocalStorage<ScheduleItem[]>('dm_schedules', []);
  const [countdowns, setCountdowns] = useLocalStorage<ManualCountdown[]>('dm_countdowns', []);
  const [concerts, setConcerts] = useLocalStorage<Concert[]>('dm_concerts', []);
  const [form, setForm] = useState({ title: '', date: '', importance: 0 });
  const [viewDate, setViewDate] = useState(() => new Date(now));
  const [selected, setSelected] = useState<Date | null>(null);
  const { lang, t, L } = useI18n();

  const add = () => {
    if (!form.title.trim() || !form.date) return;
    setCountdowns([
      { id: uid(), title: form.title.trim(), date: form.date, importance: form.importance, createdAt: Date.now() },
      ...countdowns,
    ]);
    setForm({ title: '', date: '', importance: 0 });
  };
  const delSchedule = (id: string) => setList(list.filter((x) => x.id !== id));
  const delCountdown = (id: string) => setCountdowns(countdowns.filter((x) => x.id !== id));
  const delConcert = (id: string) => setConcerts(concerts.filter((x) => x.id !== id));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const events = useMemo<CalendarEvent[]>(() => {
    const evs: CalendarEvent[] = [];
    // 成员生日：成员图标 + 🎂（如 崔胜澈 🍒🎂）
    memberBirthdays.forEach((b) =>
      evs.push({
        id: `birth-${b.id}-${year}`,
        title: `${b.stageName} ${L(b.cnName)} ${t('daysmatter.birthdayWord')}`,
        emoji: `${b.emoji}🎂`,
        accent: b.accent,
        date: new Date(year, b.month - 1, b.day),
        kind: '生日',
        importance: 4,
      })
    );
    // 入坑 / 出道纪念日：💎 + 第几周年
    evs.push({
      id: `debut-${year}`,
      title: `${t('daysmatter.debutBadge')} · SVT ${year - DEBUT.year}${t('daysmatter.ageCake')}`,
      emoji: '💎',
      accent: '#E8555E',
      date: new Date(year, DEBUT.month - 1, DEBUT.day),
      kind: '团体',
      age: year - DEBUT.year,
      importance: 5,
    });
    // 克拉生日（CARAT DAY）：💎🎂（与成员生日同风格）+ 第几周年
    evs.push({
      id: `carat-${year}`,
      title: `${t('daysmatter.caratBadge')} · CARAT ${year - CARAT_DAY.year}${t('daysmatter.ageCake')}`,
      emoji: '💎🎂',
      accent: '#E08E9D',
      date: new Date(year, CARAT_DAY.month - 1, CARAT_DAY.day),
      kind: '粉丝',
      age: year - CARAT_DAY.year,
      importance: 5,
    });
    // 其他粉丝纪念日（如有新增）：💙💖 交替
    const otherFanEvents: { id: string; title: string; accent: string; date: Date }[] = [];
    otherFanEvents.forEach((f, i) =>
      evs.push({ ...f, emoji: i % 2 === 0 ? '💙' : '💖', kind: '粉丝', importance: 3 })
    );
    list.forEach((s) =>
      evs.push({
        id: s.id,
        title: s.title,
        emoji: '📌',
        accent: '#9A7A82',
        date: parseDate(s.date),
        kind: '我的日程',
        note: s.note,
        source: 'schedule',
        sourceId: s.id,
        importance: s.importance ?? 0,
      })
    );
    countdowns.forEach((c) =>
      evs.push({
        id: `countdown-${c.id}`,
        title: c.title,
        emoji: '⏳',
        accent: '#F7CAC9',
        date: parseDate(c.date),
        kind: '我的倒数日',
        source: 'countdown',
        sourceId: c.id,
        importance: c.importance ?? 0,
      })
    );
    concerts.forEach((c) =>
      evs.push({
        id: `concert-${c.id}`,
        title: c.name,
        emoji: '🎤',
        accent: '#E8555E',
        date: parseDate(c.date),
        kind: '演唱会',
        note: [c.country, c.city].filter(Boolean).join(' ') || undefined,
        source: 'concert',
        sourceId: c.id,
        importance: 0,
      })
    );
    // 成员入伍（兵役）节点：固定在月历标记，重要度拉满
    memberEnlistments.forEach((e) => {
      if (e.exempt || !e.enlistDate) return;
      evs.push({
        id: `enlist-${e.memberId}`,
        title: `${e.stageName} ${L(e.cnName)} ${t('daysmatter.enlistWord')}`,
        emoji: '🪖',
        accent: e.accent,
        date: parseDate(e.enlistDate),
        kind: '入伍',
        importance: 5,
        enlistDate: e.enlistDate,
        dischargeDate: e.dischargeDate,
      });
    });
    return evs;
  }, [year, list, countdowns, concerts]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      const key = `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [events]);

  const days = useMemo(() => getCalendarDays(year, month), [year, month]);
  const today = new Date(now);
  const selectedEvents = selected
    ? events.filter((e) => isSameDay(e.date, selected)).sort((a, b) => a.kind.localeCompare(b.kind))
    : [];

  const goToday = () => {
    const d = new Date(now);
    setViewDate(d);
    setSelected(d);
  };

  const monthLabel = t('daysmatter.monthLabel', { y: year, m: month + 1 });

  return (
    <div className="space-y-6">
      {/* 我的倒数日 */}
      <div className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">➕</span>
          <h4 className="font-bold">{t('daysmatter.myCountdownTitle')}</h4>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F7CAC9]/30 text-[#9A7A82]">{t('daysmatter.localOnlyDevice')}</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t('daysmatter.addPlaceholder')}
            className="flex-1 min-w-[140px] rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7CAC9]"
          />
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7CAC9]"
          />
          <button
            onClick={add}
            className="rounded-xl svt-gradient text-white px-4 py-2 text-sm font-bold shadow-sm hover:opacity-90 transition"
          >
            {t('daysmatter.addBtn')}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs text-muted-foreground">{t('daysmatter.importanceLabel')}</span>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setForm({ ...form, importance: form.importance === n ? n - 1 : n })}
                title={`重要度 ${n}`}
                className={`text-lg leading-none transition ${n <= form.importance ? 'text-[#92A8D1]' : 'text-muted-foreground/30 hover:text-[#92A8D1]/60'}`}
              >
                💎
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted-foreground/70">
            {form.importance > 0 ? t('daysmatter.importanceCurrent', { n: form.importance }) : t('daysmatter.importanceNone')}
          </span>
        </div>
        {countdowns.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">
            {t('daysmatter.myEmpty')}
          </p>
        ) : (
          <div className="space-y-2.5">
            {countdowns.map((x) => {
              const diff = diffDaysLocal(parseDate(x.date).getTime(), now);
              return (
                <div
                  key={x.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#F7CAC9]/40 bg-[#F7CAC9]/8 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{x.title}</p>
                      {x.importance && x.importance > 0 && (
                        <span className="text-[11px] tracking-tight text-[#92A8D1]">
                          {Array.from({ length: x.importance }, () => '💎').join('')}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {x.date.replace(/-/g, '.')} ·{' '}
                      {diff.isToday ? t('daysmatter.isTodayEvent') : diff.isPast ? `${t('daysmatter.pastPrefix')} ${Math.abs(diff.days)} ${t('daysmatter.daySuffix')}` : `${t('daysmatter.futurePrefix')} ${diff.days} ${t('daysmatter.daySuffix')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {diff.isToday ? (
                      <span className="text-sm font-black svt-gradient-text tabular-nums hidden sm:inline">{t('daysmatter.isTodayEvent')}</span>
                    ) : (
                      <span
                        className={`text-lg font-black tabular-nums hidden sm:inline ${
                          diff.isPast ? 'text-[#06D6A0]' : 'svt-gradient-text'
                        }`}
                      >
                        {Math.abs(diff.days)}
                        <span className="text-xs font-normal text-muted-foreground ml-0.5">{t('daysmatter.daySuffix')}</span>
                      </span>
                    )}
                    <button
                      onClick={() => delCountdown(x.id)}
                      className="text-xs text-[#E8555E] hover:underline shrink-0"
                      title={t('daysmatter.deleteAriaSelf')}
                    >
                      {t('daysmatter.deleteTitle')}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 日程倒数清单 */}
      <ScheduleCountdownList
        events={events}
        now={now}
        onDelete={(e) => {
          if (e.source === 'schedule') delSchedule(e.sourceId!);
          else if (e.source === 'countdown') delCountdown(e.sourceId!);
          else if (e.source === 'concert') delConcert(e.sourceId!);
        }}
      />

      {/* 月历 */}
      <div className="rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📅</span>
            <h3 className="text-lg font-bold">{t('daysmatter.calendarTitle')}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="w-9 h-9 rounded-xl border border-border bg-background hover:bg-[#F7CAC9]/20 flex items-center justify-center text-sm font-bold"
            >
              ‹
            </button>
            <span className="min-w-[7.5rem] text-center font-bold tabular-nums">{monthLabel}</span>
            <button
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="w-9 h-9 rounded-xl border border-border bg-background hover:bg-[#F7CAC9]/20 flex items-center justify-center text-sm font-bold"
            >
              ›
            </button>
            <button
              onClick={goToday}
              className="ml-1 px-3 h-9 rounded-xl border border-[#F7CAC9] bg-[#F7CAC9]/15 text-xs font-bold hover:bg-[#F7CAC9]/25"
            >
              {t('daysmatter.todayEvent')}
            </button>
          </div>
        </div>

        {/* 图例 */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span>💎</span>{t('daysmatter.legendEnlist')}</span>
          <span className="flex items-center gap-1"><span>💎🎂</span>{t('daysmatter.legendCarat')}</span>
          <span className="flex items-center gap-1"><span>💙💖</span>{t('daysmatter.legendOther')}</span>
          <span className="flex items-center gap-1"><span>📌</span>{t('daysmatter.legendMine')}</span>
          <span className="flex items-center gap-1"><span>🎂</span>{t('daysmatter.legendBirthday')}</span>
          <span className="flex items-center gap-1"><span>🪖</span>{t('daysmatter.legendMilitary')}</span>
        </div>

        {/* 星期头（周一优先，与网格对齐） */}
        <div className="grid grid-cols-7 mb-2">
          {fmtWeekdayMonday(lang).map((w) => (
            <div key={w} className="text-center text-xs font-bold text-muted-foreground py-1.5">{w}</div>
          ))}
        </div>

        {/* 日期网格 */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {days.map((d) => {
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayEvents = eventsByDay.get(key) ?? [];
            const inMonth = d.getMonth() === month;
            const isToday = isSameDay(d, today);
            const isSelected = selected && isSameDay(d, selected);
            return (
              <button
                key={key + d.getTime()}
                onClick={() => setSelected(d)}
                className={`relative min-h-[4.2rem] sm:min-h-[5.5rem] rounded-xl sm:rounded-2xl border p-1 sm:p-2 text-left transition-all flex flex-col ${
                  inMonth ? 'bg-white/60 border-border hover:shadow-sm' : 'bg-muted/30 border-transparent text-muted-foreground/60'
                } ${isToday ? 'ring-2 ring-[#E8555E]' : ''} ${isSelected ? 'bg-[#F7CAC9]/15 border-[#F7CAC9]' : ''}`}
              >
                <span className={`text-xs sm:text-sm font-bold tabular-nums ${isToday ? 'text-[#E8555E]' : ''}`}>
                  {d.getDate()}
                </span>
                <div className="mt-auto flex flex-wrap items-end gap-0.5 sm:gap-1 content-end leading-none">
                  {dayEvents.slice(0, 3).map((e) => (
                    <span key={e.id} title={e.title} className="flex items-end leading-none">
                      <span
                        className="text-[11px] sm:text-sm"
                        style={{ filter: `drop-shadow(0 0 1px ${e.accent}88)` }}
                      >
                        {e.emoji}
                      </span>
                      {e.age != null && (
                        <sup
                          className="text-[8px] sm:text-[9px] font-black leading-none ml-0.5"
                          style={{ color: e.accent }}
                        >
                          {e.age}
                        </sup>
                      )}
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[9px] text-muted-foreground leading-none">+{dayEvents.length - 3}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 选中日详情 */}
      {selected && (
        <div className="rounded-3xl border border-border bg-card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold">
              {t('daysmatter.selectedDate', { y: selected.getFullYear(), m: selected.getMonth() + 1, d: selected.getDate() })}
              {isSameDay(selected, today) && <span className="ml-2 text-xs text-[#E8555E]">{t('daysmatter.isTodayEvent')}</span>}
            </h4>
            <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:text-foreground">{t('daysmatter.collapse')}</button>
          </div>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">{t('daysmatter.noEvent')}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {selectedEvents.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-3 py-2.5"
                  style={{ boxShadow: `inset 4px 0 0 ${e.accent}` }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{e.emoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t(KIND_LABEL_KEY[e.kind])}
                        {e.note ? ` · ${e.note}` : ''}
                      </p>
                    </div>
                  </div>
                  {e.source && (
                    <button
                      onClick={() => {
                        if (e.source === 'schedule') delSchedule(e.sourceId!);
                        else if (e.source === 'countdown') delCountdown(e.sourceId!);
                        else if (e.source === 'concert') delConcert(e.sourceId!);
                      }}
                      className="text-xs text-[#E8555E] hover:underline shrink-0"
                    >
                      {t('daysmatter.deleteTitle')}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────── 主组件 ────────────────────── */
const TABS = [
  { id: 'tz', labelKey: 'daysmatter.tabTz' },
  { id: 'countdown', labelKey: 'daysmatter.tabCountdown' },
  { id: 'schedule', labelKey: 'daysmatter.tabSchedule' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function DaysMatterSection() {
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<TabId>('countdown');
  const { t } = useI18n();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden svt-gradient-soft">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold text-[#E08E9D] tracking-[0.25em] mb-2">DAYS MATTER</p>
          <SectionTitle tKey="section.daysmatter" />
          <p className="text-muted-foreground text-sm">{t('daysmatter.intro')}</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-8 flex-wrap">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`px-4 sm:px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                tab === tb.id
                  ? 'svt-gradient text-white shadow-md'
                  : 'bg-white/70 text-foreground/70 hover:bg-[#F7CAC9]/40 border border-border'
              }`}
            >
              {t(tb.labelKey)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="animate-fade-in" key={tab}>
          {tab === 'tz' && <TimezoneTab now={now} />}
          {tab === 'countdown' && <CountdownTab now={now} />}
          {tab === 'schedule' && <ScheduleTab now={now} />}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/80 mt-10 leading-relaxed">
          {t('daysmatter.notice')}
        </p>
      </div>
    </section>
  );
}
