import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { memberBirthdays } from '@/data/daysMatter';
import { isCloudEnabled } from '@/config/cloud';
import SectionTitle from './SectionTitle';
import {
  listCloudQuotes,
  uploadCloudQuote,
  deleteCloudQuote,
  type CloudQuote,
} from '@/lib/quoteCloud';
import { useI18n } from '@/i18n/LanguageContext';

/* ────────────────────── 本地存储 Hook（兜底 / 云端关闭时） ────────────────────── */
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
  const set = (v: T | ((prev: T) => T)) => {
    setVal((prev) => {
      const next = typeof v === 'function' ? (v as (prev: T) => T)(prev) : v;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  return [val, set] as const;
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

interface Quote {
  id: string;
  memberId: string;
  text: string;
  publisherId: string;
  createdAt: number;
  origin: 'cloud' | 'local';
}

const genLocalQuote = (
  memberId: string,
  text: string,
  publisherId: string
): Quote => ({
  id: uid(),
  memberId,
  text,
  publisherId,
  createdAt: Date.now(),
  origin: 'local',
});

export default function QuotesSection() {
  const cloudOn = isCloudEnabled();
  const { t, L } = useI18n();

  const [cloudQuotes, setCloudQuotes] = useState<CloudQuote[]>([]);
  const [localQuotes, setLocalQuotes] = useLocalStorage<Quote[]>('dm_quotes', []);
  const [publisherId] = useLocalStorage('dm_publisher', () => uid());
  const [builder, setBuilder] = useLocalStorage('dm_builder', false);

  const [filter, setFilter] = useState<string>('all');
  const [memberId, setMemberId] = useState('scoups');
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingCloud, setLoadingCloud] = useState(cloudOn);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- 初始加载：云端 or 本地 ---------- */
  useEffect(() => {
    if (!cloudOn) {
      setLoadingCloud(false);
      return;
    }
    const ac = new AbortController();
    setLoadingCloud(true);
    setCloudError(null);
    listCloudQuotes(ac.signal)
      .then((list) => setCloudQuotes(list))
      .catch((e: unknown) => setCloudError(e instanceof Error ? e.message : t('quotes.readFail')))
      .finally(() => setLoadingCloud(false));
    return () => ac.abort();
  }, [cloudOn]);

  /* ---------- toast ---------- */
  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => {
    setToast({ msg, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  /* ---------- 数据源：云端开启优先云端，关闭时回退本地 ---------- */
  const source: Quote[] = useMemo(() => {
    if (cloudOn) {
      return cloudQuotes.map<Quote>((c) => ({
        id: c.id,
        memberId: c.memberId,
        text: c.text,
        publisherId: c.publisherId,
        createdAt: c.timestamp,
        origin: 'cloud',
      }));
    }
    return localQuotes;
  }, [cloudOn, cloudQuotes, localQuotes]);

  const visible = useMemo(
    () => (filter === 'all' ? source : source.filter((q) => q.memberId === filter)),
    [source, filter]
  );

  /* ---------- 发布（可连续添加多条） ---------- */
  const add = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (cloudOn) {
      setPosting(true);
      try {
        const cq = await uploadCloudQuote({
          memberId,
          text: trimmed,
          publisherId,
          timestamp: Date.now(),
        });
        setCloudQuotes((prev) => [cq, ...prev]);
        showToast(t('quotes.publishedCloud'));
      } catch {
        const lq = genLocalQuote(memberId, trimmed, publisherId);
        setLocalQuotes((prev) => [lq, ...prev]);
        showToast(t('quotes.cloudFailLocal'), 'err');
      } finally {
        setPosting(false);
      }
    } else {
      setLocalQuotes((prev) => [genLocalQuote(memberId, trimmed, publisherId), ...prev]);
      showToast(t('quotes.savedLocal'));
    }
    setText('');
    if (taRef.current) taRef.current.focus();
  }, [text, memberId, publisherId, cloudOn, showToast, setLocalQuotes]);

  /* ---------- 删除（仅自己发布或建设者） ---------- */
  const del = useCallback(
    (q: Quote) => {
      if (q.publisherId !== publisherId && !builder) return;
      if (q.origin === 'cloud' && cloudOn) {
        deleteCloudQuote(q.id)
          .then(() => setCloudQuotes((prev) => prev.filter((c) => c.id !== q.id)))
          .then(() => showToast(t('quotes.deletedCloud')))
          .catch(() => showToast(t('quotes.delCloudFail'), 'err'));
      } else {
        setLocalQuotes((prev) => prev.filter((x) => x.id !== q.id));
      }
    },
    [publisherId, builder, cloudOn, showToast, setLocalQuotes]
  );

  /* ---------- 把本地旧语录同步到云端 ---------- */
  const handleSync = useCallback(async () => {
    if (!cloudOn) {
      showToast(t('quotes.noCloudConfig'), 'err');
      return;
    }
    if (localQuotes.length === 0) {
      showToast(t('quotes.noSync'));
      return;
    }
    setSyncing(true);
    let ok = 0;
    const failed: string[] = [];
    for (const lq of localQuotes) {
      try {
        const cq = await uploadCloudQuote({
          memberId: lq.memberId,
          text: lq.text,
          publisherId: lq.publisherId,
          timestamp: lq.createdAt,
        });
        setCloudQuotes((prev) => [cq, ...prev]);
        setLocalQuotes((prev) => prev.filter((x) => x.id !== lq.id));
        ok += 1;
      } catch {
        failed.push(lq.id);
      }
    }
    setSyncing(false);
    showToast(
      t('quotes.syncedOk', { ok }) +
        (failed.length ? t('quotes.syncedFail', { fail: failed.length }) : ''),
      failed.length ? 'err' : 'ok'
    );
  }, [cloudOn, localQuotes, showToast, setLocalQuotes, t]);

  const canDel = (q: Quote) => q.publisherId === publisherId || builder;

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden svt-gradient-soft">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold text-[#E08E9D] tracking-[0.25em] mb-2">MEMBER QUOTES</p>
          <SectionTitle tKey="section.quotes" />
          <p className="text-muted-foreground text-sm">
            {cloudOn
              ? t('quotes.descCloud')
              : t('quotes.descLocal')}
          </p>
        </div>

        {/* 云端状态条 */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6 text-xs">
          {cloudOn ? (
            <span className="px-3 py-1.5 rounded-full bg-[#E08E9D]/15 text-[#9c5563] font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              🌐 {t('quotes.cloudConnected', { n: cloudQuotes.length })}
              {loadingCloud && `（${t('common.loading')}）`}
              {cloudError && ` · ⚠️ ${cloudError}`}
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              {t('quotes.localMode')}
            </span>
          )}
          {cloudOn && localQuotes.length > 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 rounded-full bg-[#F7CAC9] text-[#5a4a4a] font-medium hover:shadow-sm transition-all disabled:opacity-60"
            >
              {syncing ? t('quotes.syncing') : t('quotes.syncBtn', { n: localQuotes.length })}
            </button>
          )}
        </div>

        {/* 建设者模式 + 筛选 */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                filter === 'all'
                  ? 'bg-[#E8555E] text-white'
                  : 'bg-white/70 text-foreground/70 hover:bg-[#F7CAC9]/40 border border-border'
              }`}
            >
              {t('common.all')}
            </button>
            {memberBirthdays.map((b) => (
              <button
                key={b.id}
                onClick={() => setFilter(b.memberId)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 ${
                  filter === b.memberId
                    ? 'text-white'
                    : 'bg-white/70 text-foreground/70 hover:bg-[#F7CAC9]/40 border border-border'
                }`}
                style={filter === b.memberId ? { background: b.accent } : undefined}
              >
                <span>{b.emoji}</span>
                {b.stageName}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={builder}
              onChange={(e) => setBuilder(e.target.checked)}
              className="accent-[#E8555E]"
            />
            🛠 {t('updates.builderMode')}
            {builder && <span className="text-[10px] font-bold text-[#E8555E]">{t('quotes.builderOn')}</span>}
          </label>
        </div>

        {/* 发布表单（可连续添加多条） */}
        <div className="rounded-3xl border border-border bg-card p-4 mb-6">
          <div className="flex flex-wrap gap-2 mb-2">
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F7CAC9]"
            >
              {memberBirthdays.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.emoji} {b.stageName} {L(b.cnName)}
                </option>
              ))}
            </select>
            <span className="self-center text-[11px] text-muted-foreground">
              {t('quotes.hint')}
            </span>
          </div>
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add();
            }}
            placeholder={t('quotes.placeholder')}
            rows={2}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#F7CAC9]"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground">{t('quotes.hintQuick')}</span>
            <button
              onClick={add}
              disabled={posting}
              className="rounded-xl svt-gradient text-white px-5 py-2 text-sm font-bold shadow-sm hover:opacity-90 transition disabled:opacity-60"
            >
              {posting ? t('quotes.publishing') : t('quotes.publishLabel')}
            </button>
          </div>
        </div>

        {/* 语录列表 */}
        {loadingCloud ? (
          <p className="text-center text-xs text-muted-foreground py-8">{t('quotes.loadingCloud')}</p>
        ) : visible.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">
            {cloudOn ? t('quotes.emptyCloud') : t('quotes.empty')}
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visible.map((q) => {
              const b = memberBirthdays.find((x) => x.memberId === q.memberId);
              const accent = b?.accent ?? '#E8555E';
              const delable = canDel(q);
              const mine = q.publisherId === publisherId;
              return (
                <div
                  key={q.id}
                  className="relative rounded-2xl border border-border bg-card p-4 animate-fade-in"
                  style={{ boxShadow: `inset 4px 0 0 ${accent}` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">{b?.emoji ?? '💬'}</span>
                    <span className="text-xs font-bold">{b?.stageName}</span>
                    <span className="text-[10px] text-muted-foreground">{L(b?.cnName)}</span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{q.text}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {mine ? t('quotes.mine') : q.origin === 'cloud' ? t('quotes.fromCloud') : t('quotes.local')}
                      {q.origin === 'local' && cloudOn && (
                        <span className="text-amber-600 ml-1">{t('quotes.notSynced')}</span>
                      )}
                    </span>
                    {delable && (
                      <button
                        onClick={() => del(q)}
                        className="text-[10px] text-[#E8555E] hover:underline"
                        title={t('quotes.deleteAria')}
                      >
                        {t('common.delete')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground/80 mt-10 leading-relaxed">
          {cloudOn
            ? t('quotes.foot1')
            : t('quotes.foot2')}
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] px-5 py-2.5 rounded-full text-sm font-medium shadow-lg animate-fade-in ${
            toast.type === 'ok' ? 'bg-[#F7CAC9] text-[#5a4a4a]' : 'bg-red-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </section>
  );
}
