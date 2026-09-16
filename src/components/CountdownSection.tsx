import { useState, useEffect, useMemo, useRef } from 'react';
import { members } from '@/data';
import { militaryRecords, militaryEvents, kst, FIRST_ENLIST, OT13_RETURN, liveMilitaryStatus } from '@/data/military';
import type { MilitaryRecord, MilitaryEvent, MilitaryStatus } from '@/data/military';
import SectionTitle from './SectionTitle';
import { useI18n } from '@/i18n/LanguageContext';
import { fmtWeekdayShort } from '@/i18n/format';

/* ────────────────────────── 工具函数 ────────────────────────── */

interface Parts {
  d: number;
  h: number;
  m: number;
  s: number;
}

function splitDuration(ms: number): Parts {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' → 'YYYY.MM.DD' */
const dot = (d: string) => d.replace(/-/g, '.');

/** now 与某 KST 入伍日是否处于「同一个 KST 自然日」（用于「今天入伍」判定） */
function enMsSameKstDay(now: number, enlistMs: number): boolean {
  if (!enlistMs) return false;
  // KST 无夏令时，enlistMs 已是 KST 00:00 的时间戳，按整日取索引即可
  return Math.floor((now - enlistMs) / 86400000) === 0;
}

/** 获取 MINITEEN 图并加缓存刷新参数 */
const miniteenSrc = (src?: string) => (src ? `${src}?v=2` : src);

const STATUS_META: Record<
  MilitaryRecord['status'],
  { labelKey: string; icon: string; chip: string; order: number }
> = {
  discharged: { labelKey: 'military.status.discharged', icon: '🎖️', chip: 'bg-[#F2A900]/15 text-[#B37700] border-[#F2A900]/30', order: 0 },
  serving: { labelKey: 'military.status.serving', icon: '🪖', chip: 'bg-[#92A8D1]/20 text-[#4A6FA5] border-[#92A8D1]/40', order: 1 },
  upcoming: { labelKey: 'military.status.upcoming', icon: '⏳', chip: 'bg-[#E8555E]/12 text-[#E8555E] border-[#E8555E]/25', order: 2 },
  exempt: { labelKey: 'military.status.exempt', icon: '🛡️', chip: 'bg-[#06D6A0]/15 text-[#0E8F6E] border-[#06D6A0]/30', order: 3 },
};

/* ────────────────────────── 数字翻牌 ────────────────────────── */

function TimeCell({ value, unit, accent }: { value: string; unit: string; accent: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="min-w-[3.2rem] sm:min-w-[4.2rem] px-2 py-2 sm:py-3 rounded-2xl bg-white/85 backdrop-blur border shadow-sm tabular-nums text-center"
        style={{ borderColor: `${accent}33` }}
      >
        <span className="text-2xl sm:text-4xl font-black tracking-tight" style={{ color: accent }}>
          {value}
        </span>
      </div>
      <span className="text-[10px] sm:text-xs text-muted-foreground mt-1.5 tracking-wider">{unit}</span>
    </div>
  );
}

function CountdownRow({ ms, accent }: { ms: number; accent: string }) {
  const { t } = useI18n();
  const p = splitDuration(ms);
  return (
    <div className="flex items-start justify-center gap-2 sm:gap-3">
      <TimeCell value={String(p.d)} unit={t('unit.day')} accent={accent} />
      <span className="text-2xl sm:text-3xl font-black pt-2 sm:pt-3" style={{ color: `${accent}66` }}>:</span>
      <TimeCell value={pad(p.h)} unit={t('unit.hour')} accent={accent} />
      <span className="text-2xl sm:text-3xl font-black pt-2 sm:pt-3" style={{ color: `${accent}66` }}>:</span>
      <TimeCell value={pad(p.m)} unit={t('unit.min')} accent={accent} />
      <span className="text-2xl sm:text-3xl font-black pt-2 sm:pt-3" style={{ color: `${accent}66` }}>:</span>
      <TimeCell value={pad(p.s)} unit={t('unit.sec')} accent={accent} />
    </div>
  );
}

/* ────────────────────────── 迷你日历 ────────────────────────── */

function MiniCalendar({
  monthKey,
  events,
  now,
}: {
  monthKey: string;
  events: MilitaryEvent[];
  now: number;
}) {
  const { lang, t, L } = useI18n();
  const weekdays = fmtWeekdayShort(lang);

  const [y, m] = monthKey.split('-').map(Number);
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  const byDay = new Map<number, MilitaryEvent[]>();
  events.forEach((e) => {
    const d = Number(e.date.slice(8, 10));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(e);
  });

  const today = new Date(now);
  const isCurrentMonth = today.getFullYear() === y && today.getMonth() + 1 === m;
  const todayDate = today.getDate();

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const hasDischarge = events.some((e) => e.kind === 'discharge');

  return (
    <div
      className={`rounded-2xl border p-3.5 bg-card transition-all hover:shadow-md ${
        hasDischarge ? 'border-[#F2A900]/40' : 'border-[#92A8D1]/35'
      }`}
    >
      {/* 月份标题 */}
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-black" style={{ color: hasDischarge ? '#B37700' : '#4A6FA5' }}>
            {m}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground">{t('common.month')}</span>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground tracking-wider">{y}</span>
      </div>

      {/* 星期 */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekdays.map((w) => (
          <div key={w} className="text-[9px] text-center text-muted-foreground/70 font-medium">
            {w}
          </div>
        ))}
      </div>

      {/* 日期格 */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="aspect-square" />;
          const dayEvents = byDay.get(day);
          const isToday = isCurrentMonth && day === todayDate;

          if (!dayEvents) {
            return (
              <div
                key={day}
                className={`aspect-square flex items-center justify-center text-[10px] rounded-md ${
                  isToday
                    ? 'bg-[#E8555E] text-white font-bold shadow-sm'
                    : 'text-muted-foreground/55'
                }`}
              >
                {day}
              </div>
            );
          }

          const isEnlist = dayEvents[0].kind === 'enlist';
          const ring = isEnlist ? '#4A6FA5' : '#F2A900';

          return (
            <div
              key={day}
              className="aspect-square relative flex items-center justify-center group"
              title={dayEvents
                .map((e) => `${L(e.cnName)} ${e.kind === 'enlist' ? t('military.enlist') : t('military.discharge')}`)
                .join(' / ')}
            >
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center overflow-hidden transition-transform group-hover:scale-125 group-hover:z-10"
                style={{
                  background: isEnlist
                    ? 'linear-gradient(135deg,#DCE6F5 0%,#B8C9E4 100%)'
                    : 'linear-gradient(135deg,#FFEFC2 0%,#FFD980 100%)',
                  boxShadow: `0 0 0 2px ${ring}`,
                }}
              >
                <div className="flex items-center justify-center -space-x-1.5">
                  {dayEvents.map((e) => {
                    const mb = members.find((x) => x.id === e.memberId);
                    return (
                      <img
                        key={e.memberId + e.kind}
                        src={miniteenSrc(mb?.miniteenImage)}
                        alt={L(e.cnName)}
                        loading="lazy"
                        decoding="async"
                        className={`object-contain drop-shadow-sm ${
                          dayEvents.length > 1 ? 'w-[62%] h-[62%]' : 'w-[82%] h-[82%]'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
              {/* 日期数字角标 */}
              <span
                className="absolute -bottom-0.5 -right-0.5 z-10 text-[8px] font-black leading-none px-1 py-[1px] rounded-full text-white shadow"
                style={{ background: ring }}
              >
                {day}
              </span>
            </div>
          );
        })}
      </div>

      {/* 事件说明 */}
      <div className="mt-2.5 pt-2.5 border-t border-border/60 space-y-1">
        {Array.from(byDay.entries()).map(([day, evs]) => (
          <div key={day} className="flex items-center gap-1.5 text-[10px]">
            <span
              className="px-1.5 py-0.5 rounded font-bold text-white shrink-0"
              style={{ background: evs[0].kind === 'enlist' ? '#4A6FA5' : '#F2A900' }}
            >
              {pad(m)}.{pad(day)}
            </span>
            <span className="font-medium text-foreground/85 truncate">
              {evs.map((e) => L(e.cnName)).join(' · ')}
            </span>
            <span className="text-muted-foreground shrink-0">
              {evs[0].kind === 'enlist' ? `${t('military.enlist')} 🪖` : `${t('military.discharge')} 🎖️`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── 成员倒计时卡 ────────────────────────── */

function MemberCountdownCard({ rec, now, index }: { rec: MilitaryRecord; now: number; index: number }) {
  const { t, L } = useI18n();
  const member = members.find((m) => m.id === rec.memberId);
  const accent = member?.representativeColor || '#E8555E';
  // 实时状态：入伍当天自动转为「服役中」，退伍当天自动转为「已退伍」
  const status: MilitaryStatus = liveMilitaryStatus(rec, now);
  const meta = STATUS_META[status];

  const enlistMs = rec.enlistDate ? kst(rec.enlistDate).getTime() : 0;
  const dischargeMs = rec.dischargeDate ? kst(rec.dischargeDate).getTime() : 0;
  const totalMs = dischargeMs - enlistMs;
  const elapsedMs = now - enlistMs;

  const pct = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
  const totalDays = Math.round(totalMs / 86400000);
  const servedDays = Math.min(totalDays, Math.max(0, Math.floor(elapsedMs / 86400000)));
  const leftDays = Math.max(0, totalDays - servedDays);

  const isDischarged = status === 'discharged';
  const isUpcoming = status === 'upcoming';
  // 入伍当天（KST 同一天）：用于展示「🎉 今天入伍」
  const isEnlistToday = status === 'serving' && enMsSameKstDay(now, enlistMs);

  const targetMs = isUpcoming ? enlistMs : dischargeMs;
  const remainMs = targetMs - now;
  const sinceDischargeDays = Math.floor((now - dischargeMs) / 86400000);

  return (
    <div
      className={`relative rounded-3xl border overflow-hidden bg-card transition-all hover:shadow-xl hover:-translate-y-0.5 animate-fade-in ${
        isDischarged ? 'border-[#F2A900]/50' : 'border-border'
      }`}
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* 退伍荣耀角标 */}
      {isDischarged && (
        <div className="absolute top-0 right-0 z-10">
          <div className="bg-gradient-to-r from-[#F2A900] to-[#FFD980] text-white text-[10px] font-black px-3 py-1 rounded-bl-2xl shadow-md tracking-wide">
            🎖️ {t('military.status.discharged')}
          </div>
        </div>
      )}

      {/* 顶部 */}
      <div
        className="px-5 pt-5 pb-4 flex items-center gap-3.5"
        style={{
          background: isDischarged
            ? 'linear-gradient(135deg, rgba(242,169,0,0.14) 0%, rgba(255,217,128,0.10) 100%)'
            : `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)`,
        }}
      >
        <div
          className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center shrink-0 overflow-hidden"
          style={{ boxShadow: `0 0 0 3px ${isDischarged ? '#F2A900' : accent}55` }}
        >
          <img
            src={miniteenSrc(member?.miniteenImage)}
            alt={L(rec.cnName)}
            loading="lazy"
            decoding="async"
            className={`w-[88%] h-[88%] object-contain ${status === 'serving' ? 'bongbong-float' : ''}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-bold truncate">{L(rec.cnName)}</h4>
            <span className="text-xs text-muted-foreground">{L(rec.stageName)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{L(rec.koreanName)}</p>
          <span
            className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.chip}`}
          >
            {meta.icon} {t(meta.labelKey)}
          </span>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4 space-y-4">
        {/* 兵种 */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">{t('military.serviceForm')}</span>
          <span className="font-bold" style={{ color: accent }}>
            {L(rec.serviceType)} · {t('military.serviceMonths', { n: rec.serviceMonths })}
          </span>
        </div>

        {/* 入伍 / 退伍 日期 */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-[#92A8D1]/10 border border-[#92A8D1]/25 p-2.5 text-center">
            <p className="text-[9px] text-[#4A6FA5] font-bold tracking-wider mb-0.5">🪖 {t('military.enlist')}</p>
            <p className="text-xs font-black text-foreground tabular-nums">{dot(rec.enlistDate!)}</p>
          </div>
          <div className="rounded-xl bg-[#F2A900]/10 border border-[#F2A900]/30 p-2.5 text-center">
            <p className="text-[9px] text-[#B37700] font-bold tracking-wider mb-0.5">🎖️ {t('military.discharge')}</p>
            <p className="text-xs font-black text-foreground tabular-nums">{dot(rec.dischargeDate!)}</p>
          </div>
        </div>

        {/* 实时进度条 */}
        <div>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground">{t('military.progress')}</span>
            <span className="text-sm font-black tabular-nums" style={{ color: isDischarged ? '#B37700' : accent }}>
              {pct.toFixed(4)}%
            </span>
          </div>
          <div className="relative h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-linear"
              style={{
                width: `${pct}%`,
                background: isDischarged
                  ? 'linear-gradient(90deg,#F2A900 0%,#FFD980 100%)'
                  : `linear-gradient(90deg, ${accent} 0%, ${accent}99 100%)`,
              }}
            />
            {/* 进度头部的成员 MINITEEN：服役中跟随进度，即将入伍固定在起点 */}
            {!isDischarged && (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-1000 ease-linear"
                style={{ left: `${isUpcoming ? 3 : Math.min(97, Math.max(3, pct))}%` }}
              >
                <div
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/90 p-0.5 shadow-md"
                  style={{ boxShadow: `0 0 0 2px ${accent}66, 0 4px 8px rgba(0,0,0,0.12)` }}
                >
                  <img
                    src={miniteenSrc(member?.miniteenImage)}
                    alt={L(rec.cnName)}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground tabular-nums">
            <span>{t('military.servedDays', { n: servedDays })}</span>
            <span>{t('military.totalDays', { n: totalDays })}</span>
            <span>{t('military.leftDays', { n: leftDays })}</span>
          </div>
        </div>

        {/* 实时倒计时 */}
        <div
          className="rounded-2xl p-3.5 text-center"
          style={{
            background: isDischarged
              ? 'linear-gradient(135deg, rgba(242,169,0,0.12) 0%, rgba(255,217,128,0.08) 100%)'
              : `linear-gradient(135deg, ${accent}12 0%, ${accent}05 100%)`,
          }}
        >
          {isDischarged ? (
            <>
              <p className="text-[10px] font-bold tracking-wider mb-1 text-[#B37700]">{t('military.enlistAnniversary')}</p>
              <p className="text-xl font-black text-[#B37700] tabular-nums">
                {t('military.dischargedDaysAgo', { n: sinceDischargeDays })}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">{t('military.dischargedFor', { n: sinceDischargeDays })}</p>
            </>
          ) : (
            <>
              <p className="text-[10px] font-bold tracking-wider mb-2" style={{ color: accent }}>
                {isUpcoming
                  ? t('military.untilEnlist')
                  : isEnlistToday
                  ? t('military.todayEnlist')
                  : t('military.untilDischarge')}
              </p>
              <div className="flex items-center justify-center gap-1.5 tabular-nums">
                {[
                  { v: String(splitDuration(remainMs).d), u: t('unit.day') },
                  { v: pad(splitDuration(remainMs).h), u: t('unit.hour') },
                  { v: pad(splitDuration(remainMs).m), u: t('unit.min') },
                  { v: pad(splitDuration(remainMs).s), u: t('unit.sec') },
                ].map((x) => (
                  <div key={x.u} className="flex flex-col items-center">
                    <span className="text-lg font-black leading-none" style={{ color: accent }}>
                      {x.v}
                    </span>
                    <span className="text-[9px] text-muted-foreground mt-0.5">{x.u}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 备注 */}
        {rec.note && (
          <p className="text-[11px] leading-relaxed text-muted-foreground bg-muted/40 rounded-xl p-3">
            {L(rec.note)}
          </p>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────── 庆祝烟火特效 ────────────────────────── */
/** 轻量 canvas 烟火：仅依赖原生 API，无第三方依赖；挂载即播放，卸载即清理。 */
function CelebrationFX() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
    let parts: Particle[] = [];
    const palette = ['#F7CAC9', '#E8555E', '#F2A900', '#92A8D1', '#06D6A0', '#FFFFFF'];
    const launch = () => {
      const cx = w * (0.18 + Math.random() * 0.64);
      const cy = h * (0.2 + Math.random() * 0.4);
      const n = 24 + Math.floor(Math.random() * 16);
      const color = palette[Math.floor(Math.random() * palette.length)];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const sp = 1.3 + Math.random() * 2.3;
        parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
      }
    };
    let acc = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const dt = Math.min(3, (t - last) / 16.67);
      last = t;
      acc += dt;
      if (acc >= 40) {
        launch();
        acc = 0;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const next: Particle[] = [];
      for (const p of parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.05 * dt;
        p.vx *= 0.99;
        p.life -= 0.013 * dt;
        if (p.life <= 0) continue;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        next.push(p);
      }
      parts = next;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
}

/* ────────────────────────── 漂浮图标层 ────────────────────────── */

/** SVT 主题色系对应的庆祝漂浮图标：💎 / ❤️ / 💙 / 🫧 / 🎈
 *  以「兵役空白期结束」庆祝横幅出现时铺满整段倒计时板块（z 在内容之下）。
 *  漂浮相位统一「自底向上」漂浮（不再混用降落，避免一上一下视觉疲劳）。 */
const FLOAT_EMOJIS = ['💎', '❤️', '💙', '🫧', '🎈'];

// 确定性布局：横向铺开、错落大小/时长/延迟，避免每次渲染抖动（漂浮整体放慢）
const FLOAT_LAYOUT: { left: number; size: number; dur: number; delay: number; op: number }[] = [
  { left: 4, size: 1.6, dur: 18, delay: 0, op: 0.85 },
  { left: 13, size: 2.2, dur: 15, delay: 6, op: 0.7 },
  { left: 22, size: 1.3, dur: 22, delay: 2, op: 0.8 },
  { left: 31, size: 1.9, dur: 17, delay: 10, op: 0.65 },
  { left: 39, size: 1.5, dur: 20, delay: 4, op: 0.85 },
  { left: 48, size: 2.3, dur: 14, delay: 8, op: 0.6 },
  { left: 57, size: 1.4, dur: 19, delay: 1.5, op: 0.8 },
  { left: 66, size: 2.0, dur: 16, delay: 9, op: 0.7 },
  { left: 74, size: 1.6, dur: 21, delay: 3, op: 0.82 },
  { left: 83, size: 2.1, dur: 18, delay: 12, op: 0.62 },
  { left: 91, size: 1.4, dur: 15, delay: 3, op: 0.8 },
  { left: 8, size: 1.7, dur: 20, delay: 14, op: 0.7 },
  { left: 35, size: 1.5, dur: 17, delay: 15, op: 0.78 },
  { left: 62, size: 1.8, dur: 18, delay: 13, op: 0.66 },
  { left: 88, size: 1.6, dur: 22, delay: 7, op: 0.8 },
];

function FloatingEmojis() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {FLOAT_LAYOUT.map((c, i) => (
        <span
          key={i}
          className="float-emoji select-none"
          style={{
            left: `${c.left}%`,
            fontSize: `${c.size}rem`,
            animationDuration: `${c.dur}s`,
            animationDelay: `-${c.delay}s`,
            ['--op' as string]: c.op,
            ['--s' as string]: 1,
          }}
        >
          {FLOAT_EMOJIS[i % FLOAT_EMOJIS.length]}
        </span>
      ))}
    </div>
  );
}

/* ────────────────────────── 主组件 ────────────────────────── */

export default function CountdownSection() {
  const { t, L } = useI18n();

  // 预览用：?now=YYYY-MM-DD 可冻结时间，用于查看未来状态（如全员退伍后的庆祝横幅）。正常访问不带此参数则实时走动。
  const previewNow = (() => {
    const p = new URLSearchParams(window.location.search).get('now');
    if (!p) return null;
    const tms = new Date(p).getTime();
    return Number.isNaN(tms) ? null : tms;
  })();
  const [now, setNow] = useState(() => previewNow ?? Date.now());

  useEffect(() => {
    if (previewNow != null) return; // 预览模式不走动
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const discharged = militaryRecords.filter((r) => liveMilitaryStatus(r, now) === 'discharged');
  const serving = militaryRecords.filter((r) => liveMilitaryStatus(r, now) === 'serving');
  const upcoming = militaryRecords.filter((r) => liveMilitaryStatus(r, now) === 'upcoming');
  const exempt = militaryRecords.filter((r) => liveMilitaryStatus(r, now) === 'exempt');

  /** 服役中且距退伍不足 100 天的成员 → 用于「即将退伍」板块。
   *  触发与入伍进度无关，纯按日期：任一服役成员进入退伍前 100 天窗口即出现，
   *  到其退伍当天自动移入「光荣小兵回家」并从本板块消失（liveMilitaryStatus 驱动）。 */
  const DISCHARGE_SOON_DAYS = 100;
  const dischargeSoon = serving.filter((r) => {
    const d = kst(r.dischargeDate!).getTime() - now;
    return d > 0 && d <= DISCHARGE_SOON_DAYS * 86400000;
  });

  /** 全员兵役结束：无人在服役、也无人待入伍（即「兵役空白期」落幕）→ 触发庆祝横幅。
   *  免役成员不影响此判定（他们本就无需服役）。纯日期驱动，到最晚退伍日之后自动成立。 */
  const allHome = serving.length === 0 && upcoming.length === 0;

  const monthsWithEvents = useMemo(() => {
    const map = new Map<string, MilitaryEvent[]>();
    militaryEvents.forEach((e) => {
      const key = e.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, []);

  const startMs = kst(FIRST_ENLIST).getTime();
  const endMs = kst(OT13_RETURN).getTime();
  const groupPct = Math.min(100, Math.max(0, ((now - startMs) / (endMs - startMs)) * 100));
  const ot13Remain = endMs - now;

  const nextEvent = militaryEvents.find((e) => kst(e.date).getTime() > now);

  const stats = [
    { k: 'discharged', labelKey: 'military.stat.discharged', value: discharged.length, icon: '🎖️', color: '#F2A900' },
    { k: 'serving', labelKey: 'military.stat.serving', value: serving.length, icon: '🪖', color: '#4A6FA5' },
    { k: 'upcoming', labelKey: 'military.stat.upcoming', value: upcoming.length, icon: '⏳', color: '#E8555E' },
    { k: 'exempt', labelKey: 'military.stat.exempt', value: exempt.length, icon: '🛡️', color: '#06D6A0' },
  ];

  /** 庆祝态：烟火与漂浮图标「交替」出现（每 8s 轮换），避免两类特效同时叠加造成视觉疲劳。 */
  const [fxPhase, setFxPhase] = useState<'fireworks' | 'float'>('fireworks');
  useEffect(() => {
    if (!allHome) {
      setFxPhase('fireworks');
      return;
    }
    const id = window.setInterval(() => {
      setFxPhase((p) => (p === 'fireworks' ? 'float' : 'fireworks'));
    }, 8000);
    return () => window.clearInterval(id);
  }, [allHome]);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden svt-gradient-soft">
      {/* 全员归队庆祝态：仅「漂浮相位」时整段铺满 SVT 主题漂浮图标（与烟火相位交替，避免同时出现） */}
      {allHome && fxPhase === 'float' && <FloatingEmojis />}
      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-[#E08E9D] tracking-[0.25em] mb-2">COUNTDOWN</p>
          <SectionTitle tKey="section.countdown" />
          <p className="text-muted-foreground text-sm">
            {t('military.timeline')}
          </p>
          <p className="text-[11px] text-muted-foreground/80 mt-1.5">
            {t('military.realtime')}
          </p>
        </div>

        {/* ── 全员退伍庆祝横幅（兵役空白期结束 · serving 与 upcoming 均为空时触发）── */}
        {allHome && (
          <div className="relative mb-10 rounded-[2rem] overflow-hidden p-[2px] bg-gradient-to-r from-[#F7CAC9] via-[#F2A900] to-[#92A8D1] animate-fade-in">
            <div className="relative overflow-hidden rounded-[calc(2rem-2px)] bg-white/90 backdrop-blur px-6 py-9 sm:px-10 sm:py-11 text-center">
              {fxPhase === 'fireworks' && <CelebrationFX />}
              <div className="relative z-10">
                <div className="text-3xl sm:text-4xl mb-3 tracking-[0.3em]">🎉🎖️🎉</div>
                <h2 className="text-xl sm:text-2xl font-black svt-gradient-text mb-2.5">
                  {t('military.celebrate.title')}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t('military.celebrate.sub')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* OT13 主倒计时 */}
        <div className="relative rounded-[2rem] border border-[#F7CAC9]/60 bg-white/70 backdrop-blur-sm shadow-lg p-6 sm:p-9 mb-8 overflow-hidden">
          <div className="absolute -top-16 -right-12 w-56 h-56 rounded-full bg-[#F7CAC9]/25 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-[#92A8D1]/25 blur-3xl pointer-events-none" />

          <div className="relative text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <img src="/images/bongbong.png" alt="bongbong" className="w-9 h-9 object-contain bongbong-float" />
              <p className="text-xs font-bold tracking-[0.2em] text-[#E8555E]">{t('military.ot13')}</p>
            </div>
            <p className="text-[11px] text-muted-foreground mb-5">
              {t('military.lastReturn', { name: L('金珉奎'), date: dot(OT13_RETURN) })}
            </p>

            <CountdownRow ms={ot13Remain} accent="#E8555E" />

            {/* 团体整体进度 */}
            <div className="mt-7 max-w-2xl mx-auto">
              <div className="flex items-baseline justify-between mb-1.5 text-[11px]">
                <span className="text-muted-foreground">{dot(FIRST_ENLIST)} {t('military.firstEnlist')}</span>
                <span className="font-black text-base svt-gradient-text tabular-nums">
                  {groupPct.toFixed(4)}%
                </span>
                <span className="text-muted-foreground">{dot(OT13_RETURN)} {t('military.allReturn')}</span>
              </div>
              <div className="relative h-4 rounded-full bg-white/70 border border-[#F7CAC9]/50 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 svt-gradient rounded-full transition-[width] duration-1000 ease-linear"
                  style={{ width: `${groupPct}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-[left] duration-1000 ease-linear"
                  style={{ left: `${groupPct}%` }}
                >
                  <img src="/images/bongbong.png" alt="" className="w-7 h-7 object-contain drop-shadow" />
                </div>
              </div>
              {nextEvent && (
                <p className="text-[11px] text-muted-foreground mt-3">
                  {t('military.nextNode')}{' '}
                  <span className="font-bold" style={{ color: nextEvent.kind === 'enlist' ? '#4A6FA5' : '#B37700' }}>
                    {dot(nextEvent.date)} {L(nextEvent.cnName)}{' '}
                    {nextEvent.kind === 'enlist' ? t('military.enlist') : t('military.discharge')}
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 状态统计 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          {stats.map((s) => (
            <div
              key={s.k}
              className="rounded-2xl bg-card border border-border p-4 text-center hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-black tabular-nums" style={{ color: s.color }}>
                {s.value}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t(s.labelKey)}</div>
            </div>
          ))}
        </div>

        {/* ── 日历时间轴 ── */}
        <div className="mb-14">
          <div className="text-center mb-5">
            <h3 className="text-xl font-bold mb-1.5">{t('military.calendar')}</h3>
            <p className="text-xs text-muted-foreground">{t('military.calendarHint')}</p>
            <div className="flex items-center justify-center gap-4 mt-3 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: '#4A6FA5' }} />
                {t('military.legendEnlist')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: '#F2A900' }} />
                {t('military.legendDischarge')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#E8555E]" />
                {t('common.today')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
            {monthsWithEvents.map(([key, evs], idx) => (
              <div key={key} className="animate-fade-in" style={{ animationDelay: `${idx * 0.04}s` }}>
                <MiniCalendar monthKey={key} events={evs} now={now} />
              </div>
            ))}
          </div>
        </div>

        {/* ── 已退伍 ── */}
        {discharged.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="text-xl">🎖️</span>
              <h3 className="text-lg font-bold">{t('military.groupDischarged')}</h3>
              <span className="text-xs text-muted-foreground">{t('military.groupDischargedDesc', { n: discharged.length })}</span>
              <div className="flex-1 h-px bg-gradient-to-r from-[#F2A900]/50 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {discharged.map((r, i) => (
                <MemberCountdownCard key={r.memberId} rec={r} now={now} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* ── 服役中 ── */}
        {serving.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="text-xl">🪖</span>
              <h3 className="text-lg font-bold">{t('military.groupServing')}</h3>
              <span className="text-xs text-muted-foreground">{t('military.groupServingDesc', { n: serving.length })}</span>
              <div className="flex-1 h-px bg-gradient-to-r from-[#92A8D1]/60 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {serving.map((r, i) => (
                <MemberCountdownCard key={r.memberId} rec={r} now={now} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* ── 即将入伍 ── */}
        {upcoming.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="text-xl">⏳</span>
              <h3 className="text-lg font-bold">{t('military.groupUpcoming')}</h3>
              <span className="text-xs text-muted-foreground">{t('military.groupUpcomingDesc', { n: upcoming.length })}</span>
              <div className="flex-1 h-px bg-gradient-to-r from-[#E8555E]/50 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {upcoming.map((r, i) => (
                <MemberCountdownCard key={r.memberId} rec={r} now={now} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* ── 即将退伍（服役中成员距退伍不足 100 天时自动出现，与「即将入伍」可同时展示）── */}
        {dischargeSoon.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-2.5 mb-5">
              <span className="text-xl">🎖️</span>
              <h3 className="text-lg font-bold">{t('military.groupDischarge')}</h3>
              <span className="text-xs text-muted-foreground">{t('military.groupDischargeDesc', { n: dischargeSoon.length })}</span>
              <div className="flex-1 h-px bg-gradient-to-r from-[#F2A900]/50 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {dischargeSoon.map((r, i) => (
                <MemberCountdownCard key={r.memberId} rec={r} now={now} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* ── 免服兵役 ── */}
        <div>
          <div className="flex items-center gap-2.5 mb-5">
            <span className="text-xl">🛡️</span>
            <h3 className="text-lg font-bold">{t('military.groupExempt')}</h3>
            <span className="text-xs text-muted-foreground">{t('military.groupExemptDesc', { n: exempt.length })}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-[#06D6A0]/50 to-transparent" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {exempt.map((r, i) => {
              const member = members.find((m) => m.id === r.memberId);
              const accent = member?.representativeColor || '#06D6A0';
              return (
                <div
                  key={r.memberId}
                  className="rounded-3xl border border-border bg-card p-5 flex gap-4 hover:shadow-lg transition-all hover:-translate-y-0.5 animate-fade-in"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div
                    className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center shrink-0 overflow-hidden self-start"
                    style={{ boxShadow: `0 0 0 3px ${accent}55` }}
                  >
                    <img
                      src={miniteenSrc(member?.miniteenImage)}
                      alt={L(r.cnName)}
                      loading="lazy"
                      decoding="async"
                      className="w-[88%] h-[88%] object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold">{L(r.cnName)}</h4>
                      <span className="text-xs text-muted-foreground">{L(r.stageName)}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-[#06D6A0]/15 text-[#0E8F6E] border-[#06D6A0]/30">
                        🛡️ {L(r.exemptReason)}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted-foreground mt-2">{L(r.exemptDetail)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 底部说明 */}
        <p className="text-center text-[11px] text-muted-foreground/80 mt-10 leading-relaxed">
          {t('military.source1')}<br />
          {t('military.source2')}
        </p>
      </div>
    </section>
  );
}
