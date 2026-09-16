import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { varietyShows } from '@/data';
import type { VarietyShow } from '@/types';
import SectionTitle from './SectionTitle';
import { useI18n } from '../i18n/LanguageContext';
import {
  listResLinks,
  uploadResLink,
  deleteResLink,
  detectLinkPlatform,
  resLinkPublisherId,
  type ResLink,
} from '@/lib/linkCloud';
import {
  listVarietyLinks,
  uploadVarietyLink,
  findVarietyLink,
  type VarietyLink,
} from '@/lib/varietyLinkCloud';

const PAGE_SIZE = 24;

const PLATFORM_META: Record<string, { emoji: string; cls: string }> = {
  youtube: { emoji: '▶', cls: 'bg-red-500/12 text-red-600' },
  bilibili: { emoji: '📺', cls: 'bg-[#FB7299]/12 text-[#FB7299]' },
  instagram: { emoji: '📷', cls: 'bg-pink-500/12 text-pink-600' },
  xiaohongshu: { emoji: '📕', cls: 'bg-red-500/10 text-red-500' },
  weibo: { emoji: '🌐', cls: 'bg-orange-500/12 text-orange-600' },
  tiktok: { emoji: '🎵', cls: 'bg-slate-500/12 text-slate-600' },
  douyin: { emoji: '🎵', cls: 'bg-slate-500/12 text-slate-600' },
  weverse: { emoji: '💎', cls: 'bg-[#7C3AED]/12 text-[#7C3AED]' },
  x: { emoji: '𝕏', cls: 'bg-slate-700/12 text-slate-700' },
  other: { emoji: '🔗', cls: 'bg-muted text-foreground/70' },
};

const YEAR_OF = (s: VarietyShow) => s.year.split('-')[0].split(' ')[0];
const isGSEpisode = (s: VarietyShow) => s.id.startsWith('going-seventeen-');
// 从 id 中提取首个集数数字，用于集数排序（如 ep150-151 → 150）
// Opening 季首固定排到该年最前（-1）；其余无编号条目沉到末尾（9999）
const EP_NUM = (s: VarietyShow) => {
  if (/opening/i.test(s.id)) return -1;
  const m = s.id.match(/ep(\d+)/);
  return m ? parseInt(m[1], 10) : 9999;
};

type TabId = 'going' | 'official' | 'kr' | 'cn' | 'music' | 'community';

const TABS: { id: TabId; emoji: string; labelKey: string }[] = [
  { id: 'going', emoji: '📺', labelKey: 'variety.secGoing' },
  { id: 'official', emoji: '🎬', labelKey: 'variety.secOfficial' },
  { id: 'kr', emoji: '🇰🇷', labelKey: 'variety.secKr' },
  { id: 'cn', emoji: '🌏', labelKey: 'variety.secCn' },
  { id: 'music', emoji: '🎵', labelKey: 'variety.secMusic' },
  { id: 'community', emoji: '🔗', labelKey: 'variety.secCommunity' },
];

/* ────────────────────── 折叠年份（可展开/收起）────────────────────── */
function YearAccordion({
  year,
  count,
  open,
  onToggle,
  innerRef,
  children,
}: {
  year: string;
  count: number;
  open: boolean;
  onToggle: (y: string) => void;
  innerRef?: (el: HTMLDivElement | null) => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div ref={innerRef} className="border border-border rounded-2xl bg-card overflow-hidden scroll-mt-24">
      <button
        onClick={() => onToggle(year)}
        className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-muted/40 transition-colors"
      >
        <span className="text-sm font-black text-[#E08E9D] tabular-nums">{year}</span>
        <span className="text-xs text-muted-foreground">
          {count} {t('variety.episodes')}
        </span>
        <div className="flex-1 h-px bg-gradient-to-r from-[#F7CAC9]/30 to-transparent" />
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`text-muted-foreground transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out ${
          open ? 'max-h-[9999px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-5 pt-2">{children}</div>
      </div>
    </div>
  );
}

/* ────────────────────── 空结果提示 ────────────────────── */
function EmptyTip({ text }: { text: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-2xl">
      <p className="text-3xl mb-3">🔍</p>
      <p className="text-sm">{text}</p>
    </div>
  );
}

/* ────────────────────── 综艺真实链接上传按钮组 ────────────────────── */
function LinkButtonGroup({
  varietyId,
  platform,
  defaultUrl,
  defaultLabel,
  realLink,
  onUploaded,
}: {
  varietyId: string;
  platform: 'youtube' | 'bilibili';
  defaultUrl: string;
  defaultLabel: string;
  realLink?: VarietyLink;
  onUploaded: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [posting, setPosting] = useState(false);
  const [tip, setTip] = useState<string | null>(null);

  const isYoutube = platform === 'youtube';
  const activeUrl = realLink?.url || defaultUrl;
  const hasReal = !!realLink;

  const baseWrap = isYoutube
    ? 'bg-primary/10 text-primary'
    : 'bg-[#FB7299]/10 text-[#FB7299]';
  const hoverCls = isYoutube ? 'hover:bg-primary/20' : 'hover:bg-[#FB7299]/20';

  const handleSubmit = async () => {
    const m = url.trim().match(/https?:\/\/[^\s，。、\n\r]+/i);
    const real = m ? m[0] : '';
    if (!real) {
      setTip(t('variety.needValidLink'));
      return;
    }
    setPosting(true);
    setTip(null);
    try {
      await uploadVarietyLink(varietyId, platform, real);
      setUrl('');
      setOpen(false);
      onUploaded();
    } catch (e) {
      setTip((e as Error).message || t('variety.uploadFailed'));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`flex items-center gap-1 rounded-full overflow-hidden ${baseWrap}`}>
        <a
          href={activeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 font-medium ${hoverCls} transition-colors`}
        >
          {isYoutube ? '' : '📺 '}
          {defaultLabel}
          {hasReal && (
            <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-white/40">
              {t('variety.userSupplied')}
            </span>
          )}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        </a>
        <button
          onClick={() => setOpen((v) => !v)}
          title={hasReal ? t('variety.replaceRealLink') : t('variety.addRealLink')}
          className={`inline-flex items-center justify-center w-7 h-7 transition-colors ${hoverCls}`}
        >
          {hasReal ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{t('variety.realLinkDesc')}</p>
          <div className="flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('variety.realLinkPlaceholder')}
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={handleSubmit}
              disabled={posting}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#E08E9D] text-white disabled:opacity-60 hover:bg-[#d97f90] transition-colors shrink-0"
            >
              {posting ? t('variety.uploading') : t('variety.upload')}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-foreground/70 hover:text-foreground transition-colors shrink-0"
            >
              {t('updates.cancel')}
            </button>
          </div>
          {tip && <p className="text-xs text-red-600">{tip}</p>}
        </div>
      )}
    </div>
  );
}

/* ────────────────────── 分页卡片网格 ────────────────────── */
function CardGrid<T>({
  items,
  renderItem,
  pageSize = PAGE_SIZE,
  resetKey,
}: {
  items: T[];
  renderItem: (item: T, i: number) => ReactNode;
  pageSize?: number;
  resetKey?: string;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(pageSize);
  useEffect(() => {
    setVisible(pageSize);
  }, [resetKey, pageSize]);

  const shown = items.slice(0, visible);
  const hasMore = visible < items.length;
  if (items.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{shown.map((it, i) => renderItem(it, i))}</div>
      {hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setVisible((v) => v + pageSize)}
            className="px-6 py-2.5 rounded-full text-sm font-medium bg-[#F7CAC9] text-[#5a4a4a] shadow-md hover:shadow-lg transition-all"
          >
            {t('variety.loadMore')}（{items.length - visible}）
          </button>
        </div>
      )}
    </>
  );
}

export default function VarietySection() {
  const { t, L } = useI18n();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('going');
  const [gsOrder, setGsOrder] = useState<'asc' | 'desc'>('asc');
  const [cloudLinks, setCloudLinks] = useState<ResLink[]>([]);
  const [varietyLinks, setVarietyLinks] = useState<VarietyLink[]>([]);
  const [loading, setLoading] = useState(true);

  // 补充链接表单
  const [formOpen, setFormOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [posting, setPosting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const myId = useRef(resLinkPublisherId());
  const yearRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const pillRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const barRef = useRef<HTMLDivElement | null>(null);
  const [openYears, setOpenYears] = useState<Set<string>>(new Set());
  const [activeYear, setActiveYear] = useState<string | null>(null);
  // 回到顶部浮动按钮：滚动超过一屏后显示
  const [showTop, setShowTop] = useState(false);

  const refreshResLinks = async () => {
    try {
      const list = await listResLinks();
      setCloudLinks(list);
    } catch {
      setCloudLinks([]);
    }
  };

  const refreshVarietyLinks = async () => {
    try {
      const list = await listVarietyLinks();
      setVarietyLinks(list);
    } catch {
      setVarietyLinks([]);
    }
  };

  const refresh = async () => {
    setLoading(true);
    await Promise.all([refreshResLinks(), refreshVarietyLinks()]);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const q = query.trim().toLowerCase();
  const matchesShow = (s: VarietyShow) =>
    !q || [s.name, s.description, s.platform].some((v) => L(v).toLowerCase().includes(q));
  const matchesLink = (l: ResLink) =>
    !q || [l.title, l.note ?? '', l.url].some((v) => v.toLowerCase().includes(q));

  /* ── Going Seventeen：总览卡 + 按年份分区 ── */
  const gsOverview = useMemo(() => varietyShows.find((s) => s.id === 'going-seventeen'), []);
  const gsEpisodes = useMemo(
    () => varietyShows.filter((s) => isGSEpisode(s) && matchesShow(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q]
  );
  const gsYears = useMemo(
    () => Array.from(new Set(gsEpisodes.map(YEAR_OF))).sort((a, b) => b.localeCompare(a)),
    [gsEpisodes]
  );
  // 年份折叠状态：查询变化或年份集合变化时全部展开（保持原有默认展开行为）
  useEffect(() => {
    setOpenYears(new Set(gsYears));
  }, [gsYears, q]);

  // 滚动联动：高亮「当前正在浏览」的年份（取最后一个顶部越过基准线的年份分区）
  useEffect(() => {
    if (activeTab !== 'going' || !gsYears.length) return;
    let raf = 0;
    const compute = () => {
      raf = 0;
      let current: string | null = null;
      for (const y of gsYears) {
        const el = yearRefs.current[y];
        if (!el) continue;
        if (el.getBoundingClientRect().top - 120 <= 0) current = y;
      }
      setActiveYear(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [gsYears, activeTab, openYears]);

  // 当前高亮的年份胶囊自动滚入索引栏可视区（横向）
  useEffect(() => {
    if (!activeYear) return;
    const bar = barRef.current;
    const pill = pillRefs.current[activeYear];
    if (!bar || !pill) return;
    const pl = pill.offsetLeft;
    const pr = pl + pill.offsetWidth;
    const bl = bar.scrollLeft;
    const br = bl + bar.clientWidth;
    if (pl < bl + 8) bar.scrollTo({ left: Math.max(0, pl - 8), behavior: 'smooth' });
    else if (pr > br - 8) bar.scrollTo({ left: pr - bar.clientWidth + 8, behavior: 'smooth' });
  }, [activeYear]);

  // 回到顶部按钮的显隐：滚动超过 600px 显示
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const gsByYear = (year: string) => {
    const items = gsEpisodes.filter((s) => YEAR_OF(s) === year);
    return items
      .slice()
      .sort((a, b) => (gsOrder === 'asc' ? EP_NUM(a) - EP_NUM(b) : EP_NUM(b) - EP_NUM(a)));
  };
  const gsOverviewMatch = gsOverview ? matchesShow(gsOverview) : false;

  /* ── 其它分类 ── */
  const official = useMemo(
    () => varietyShows.filter((s) => s.category === 'official' && !isGSEpisode(s) && matchesShow(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q]
  );
  const kr = useMemo(
    () => varietyShows.filter((s) => s.category === 'kr' && matchesShow(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q]
  );
  const cn = useMemo(
    () => varietyShows.filter((s) => s.category === 'cn' && matchesShow(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q]
  );
  const music = useMemo(
    () => varietyShows.filter((s) => s.category === 'music' && matchesShow(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q]
  );
  const community = useMemo(() => cloudLinks.filter(matchesLink), [cloudLinks, q]);

  /* ── 卡片渲染 ── */
  const renderVariety = (s: VarietyShow, i: number, featured = false) => (
    <div
      key={s.id}
      className={`group bg-card rounded-2xl p-6 border transition-all hover:-translate-y-0.5 animate-fade-in ${
        featured ? 'border-[#F7CAC9] ring-2 ring-[#F7CAC9]/30 hover:shadow-lg' : 'border-border hover:shadow-lg'
      }`}
      style={{ animationDelay: `${(i % PAGE_SIZE) * 0.03}s` }}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-14 h-14 rounded-2xl svt-gradient flex flex-col items-center justify-center text-white shadow-md">
            <span className="text-[10px] font-medium opacity-80">{YEAR_OF(s)}</span>
            <span className="text-xs font-bold">{t('variety.badge')}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base mb-1.5 truncate">{L(s.name)}</h3>
          <div className="flex items-center gap-3 mb-2 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              {L(s.platform)}
            </span>
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              {s.episodes}
              {typeof s.episodes === 'number' ? t('variety.episodes') : ''}
            </span>
            <span className="flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {s.year}
            </span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{L(s.description)}</p>
          <div className="flex items-start gap-2 flex-wrap">
            <LinkButtonGroup
              varietyId={s.id}
              platform="youtube"
              defaultUrl={s.link}
              defaultLabel={L(s.linkLabel)}
              realLink={findVarietyLink(varietyLinks, s.id, 'youtube')}
              onUploaded={refreshVarietyLinks}
            />
            {s.biliLink && (
              <LinkButtonGroup
                varietyId={s.id}
                platform="bilibili"
                defaultUrl={s.biliLink}
                defaultLabel={s.biliLabel ? L(s.biliLabel) : t('variety.biliDefault')}
                realLink={findVarietyLink(varietyLinks, s.id, 'bilibili')}
                onUploaded={refreshVarietyLinks}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderLink = (l: ResLink, i: number) => {
    const mine = l.publisherId === myId.current;
    const meta = PLATFORM_META[l.platform] || PLATFORM_META.other;
    return (
      <div
        key={l.id}
        className="group bg-card rounded-2xl p-6 border border-border hover:shadow-lg transition-all hover:-translate-y-0.5 animate-fade-in"
        style={{ animationDelay: `${(i % PAGE_SIZE) * 0.03}s` }}
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl ${meta.cls}`}>{meta.emoji}</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="font-bold text-base truncate">{l.title}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#F7CAC9]/30 text-[#9c5563] shrink-0">
                {t('resources.userAdded')}
              </span>
            </div>
            {l.note && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{l.note}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
              >
                {t('updates.view')}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M7 17l9.2-9.2M17 17V7H7" />
                </svg>
              </a>
              {mine && (
                <button
                  onClick={() => handleDelete(l.id)}
                  className="text-xs px-3 py-1.5 rounded-full bg-muted text-foreground/60 hover:text-red-600 transition-colors"
                >
                  {t('resources.delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ── 发布 / 删除 ── */
  const handlePublish = async () => {
    const raw = url.trim();
    const m = raw.match(/https?:\/\/[^\s，。、\n\r]+/i);
    const realUrl = m ? m[0] : '';
    if (!realUrl) {
      setMsg({ type: 'err', text: t('resources.needValidLink') });
      return;
    }
    setPosting(true);
    setMsg(null);
    try {
      await uploadResLink({
        title: title.trim() || realUrl,
        url: realUrl,
        note: note.trim() || undefined,
        platform: detectLinkPlatform(realUrl),
        publisherId: myId.current,
        timestamp: Date.now(),
      });
      setUrl('');
      setTitle('');
      setNote('');
      setFormOpen(false);
      setMsg({ type: 'ok', text: t('resources.published') });
      await refresh();
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message || t('resources.failed') });
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteResLink(id);
      await refresh();
    } catch (e) {
      setMsg({ type: 'err', text: (e as Error).message });
    }
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-xs font-bold text-[#E08E9D] tracking-[0.25em] mb-2">VARIETY</p>
          <SectionTitle tKey="section.variety" />
          <p className="text-muted-foreground">{t('variety.desc')}</p>
        </div>

        {/* 搜索 */}
        <div className="flex justify-center mb-10">
          <div className="relative w-full max-w-md">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('variety.searchPlaceholder')}
              className="w-full pl-9 pr-4 py-2.5 rounded-full border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-[#F7CAC9] shadow-sm"
            />
          </div>
        </div>

        {/* 胶囊 Tab 切换（模仿 Days Matter） */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all shadow-sm border ${
                  active
                    ? 'bg-gradient-to-r from-[#F7CAC9] to-[#E08E9D] text-white border-transparent shadow-md'
                    : 'bg-card text-foreground/80 border-border hover:border-[#F7CAC9]/60 hover:bg-[#F7CAC9]/10'
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{t(tab.labelKey)}</span>
              </button>
            );
          })}
        </div>

        {/* 当前 Tab 内容区 */}
        <div className="min-h-[240px]">
          {activeTab === 'going' && (
            <section>
              {gsOverviewMatch && gsOverview && renderVariety(gsOverview, -1, true)}
              <div className="flex items-center justify-end gap-2 mt-2 mb-1">
                <span className="text-xs text-muted-foreground">{t('variety.sortLabel')}</span>
                <button
                  onClick={() => setGsOrder('asc')}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    gsOrder === 'asc'
                      ? 'bg-gradient-to-r from-[#F7CAC9] to-[#E08E9D] text-white border-transparent'
                      : 'bg-card text-foreground/70 border-border hover:border-[#F7CAC9]/60'
                  }`}
                >
                  {t('variety.orderAsc')}
                </button>
                <button
                  onClick={() => setGsOrder('desc')}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    gsOrder === 'desc'
                      ? 'bg-gradient-to-r from-[#F7CAC9] to-[#E08E9D] text-white border-transparent'
                      : 'bg-card text-foreground/70 border-border hover:border-[#F7CAC9]/60'
                  }`}
                >
                  {t('variety.orderDesc')}
                </button>
              </div>
              <div className="space-y-6 mt-2">
                {/* 年份快速索引栏（横向可滑动 · 点击跳转并展开 · 滚动联动高亮当前年份） */}
                {gsYears.length > 1 && (() => {
                  const allOpen = gsYears.length > 0 && gsYears.every((y) => openYears.has(y));
                  return (
                    <div className="flex items-start gap-3 mb-2">
                      <div
                        ref={barRef}
                        className="flex-1 flex gap-2 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                      >
                        {gsYears.map((year) => {
                          const cnt = gsByYear(year).length;
                          const viewing = activeYear === year;
                          return (
                            <button
                              key={year}
                              ref={(el) => {
                                pillRefs.current[year] = el;
                              }}
                              onClick={() => {
                                setOpenYears((prev) => new Set(prev).add(year));
                                requestAnimationFrame(() => {
                                  yearRefs.current[year]?.scrollIntoView({
                                    behavior: 'smooth',
                                    block: 'start',
                                  });
                                });
                              }}
                              className={`shrink-0 snap-start px-3 py-1.5 rounded-full text-xs font-medium border transition-all shadow-sm ${
                                viewing
                                  ? 'bg-gradient-to-r from-[#F7CAC9] to-[#E08E9D] text-white border-transparent shadow-md scale-[1.04]'
                                  : 'bg-card text-foreground/70 border-border hover:border-[#F7CAC9]/60 hover:bg-[#F7CAC9]/10'
                              }`}
                            >
                              {year}
                              <span className="opacity-70 ml-1">{cnt}</span>
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setOpenYears(allOpen ? new Set() : new Set(gsYears))}
                        className="shrink-0 mt-0.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors bg-card text-foreground/70 border-border hover:border-[#F7CAC9]/60 hover:bg-[#F7CAC9]/10"
                      >
                        {allOpen ? t('variety.collapseAll') : t('variety.expandAll')}
                      </button>
                    </div>
                  );
                })()}
                {gsYears.map((year) => {
                  const items = gsByYear(year);
                  return (
                    <YearAccordion
                      key={year}
                      year={year}
                      count={items.length}
                      open={openYears.has(year)}
                      onToggle={(y) =>
                        setOpenYears((prev) => {
                          const n = new Set(prev);
                          if (n.has(y)) n.delete(y);
                          else n.add(y);
                          return n;
                        })
                      }
                      innerRef={(el) => {
                        yearRefs.current[year] = el;
                      }}
                    >
                      <CardGrid items={items} renderItem={(s, i) => renderVariety(s, i)} resetKey={query} />
                    </YearAccordion>
                  );
                })}
              </div>
              {gsYears.length === 0 && !gsOverviewMatch && (
                <EmptyTip text={t('variety.noResult')} />
              )}
            </section>
          )}

          {activeTab === 'official' && (
            <section>
              <CardGrid items={official} renderItem={(s, i) => renderVariety(s, i)} resetKey={query} />
              {official.length === 0 && <EmptyTip text={t('variety.noResult')} />}
            </section>
          )}

          {activeTab === 'kr' && (
            <section>
              <CardGrid items={kr} renderItem={(s, i) => renderVariety(s, i)} resetKey={query} />
              {kr.length === 0 && <EmptyTip text={t('variety.noResult')} />}
            </section>
          )}

          {activeTab === 'cn' && (
            <section>
              <CardGrid items={cn} renderItem={(s, i) => renderVariety(s, i)} resetKey={query} />
              {cn.length === 0 && <EmptyTip text={t('variety.noResult')} />}
            </section>
          )}

          {activeTab === 'music' && (
            <section>
              <CardGrid items={music} renderItem={(s, i) => renderVariety(s, i)} resetKey={query} />
              {music.length === 0 && <EmptyTip text={t('variety.noResult')} />}
            </section>
          )}

          {activeTab === 'community' && (
            <section>
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setFormOpen((v) => !v)}
                  className="px-4 py-1.5 rounded-full text-xs font-medium bg-gradient-to-r from-[#F7CAC9] to-[#E08E9D] text-white shadow-sm hover:shadow-md transition-all"
                >
                  ＋ {t('resources.supplement')}
                </button>
              </div>
              {formOpen && (
                <div className="w-full max-w-xl bg-card border border-border rounded-2xl p-5 mb-5 text-left space-y-3">
                  <p className="text-xs text-muted-foreground">{t('resources.supplementDesc')}</p>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t('resources.linkPlaceholder')}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('resources.titlePlaceholder')}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('resources.notePlaceholder')}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  {msg && (
                    <p className={`text-xs ${msg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handlePublish}
                      disabled={posting}
                      className="px-4 py-2 rounded-full text-sm font-medium bg-[#E08E9D] text-white disabled:opacity-60 hover:bg-[#d97f90] transition-colors"
                    >
                      {posting ? t('resources.publishing') : t('resources.publish')}
                    </button>
                    <button
                      onClick={() => setFormOpen(false)}
                      className="px-4 py-2 rounded-full text-sm font-medium bg-muted text-foreground/70 hover:text-foreground transition-colors"
                    >
                      {t('updates.cancel')}
                    </button>
                  </div>
                </div>
              )}
              <CardGrid items={community} renderItem={(l, i) => renderLink(l, i)} resetKey={query} />
              {loading && <p className="text-center text-sm text-muted-foreground mt-6">{t('resources.syncing')}</p>}
              {!loading && community.length === 0 && <EmptyTip text={t('variety.noResult')} />}
            </section>
          )}
        </div>

        {/* 说明 */}
        <div className="mt-12 max-w-2xl mx-auto p-6 rounded-2xl bg-card border border-border text-center">
          <p className="text-sm text-muted-foreground">
            {t('variety.goingDesc')}
            <br />
            {t('variety.moreDesc')}
          </p>
        </div>

      </div>

      {/* 回到顶部浮动按钮 */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title={t('variety.backToTop')}
          aria-label={t('variety.backToTop')}
          className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-gradient-to-r from-[#F7CAC9] to-[#E08E9D] text-white shadow-lg flex items-center justify-center hover:shadow-xl hover:-translate-y-0.5 transition-all"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      )}
    </section>
  );
}
