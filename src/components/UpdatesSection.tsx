import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  updates,
  PLATFORM_META,
  KIND_META,
  type UpdateItem,
  type UpdateCategory,
  type Platform,
  type UpdateKind,
  type MediaItem,
} from '@/data/updates';
import { members, officialAccounts } from '@/data/members';
import { fetchLiveFeeds } from '@/lib/liveFeeds';
import {
  listCloudUpdates,
  uploadCloudUpdate,
  updateCloudUpdate,
  deleteCloudUpdate,
  detectPlatform,
  publisherId,
  localStore,
  listFeedEdits,
  saveFeedEdit,
  deleteFeedEdit,
  uploadMediaFile,
  listAllMediaOverlays,
  saveMyMedia,
  encodeItemKey,
  type CloudUpdate,
  type FeedEdit,
  type MediaOverlayMap,
} from '@/lib/updateCloud';
import { resolveLink } from '@/lib/cloudFn';
import SectionTitle from './SectionTitle';
import { useI18n } from '@/i18n/LanguageContext';
import { fmtDate, fmtDateTime, fmtRelative } from '@/i18n/format';

/* ── 工具 ─────────────────────────────────────────────── */
const memberMap = Object.fromEntries(members.map((m) => [m.id, m]));

/* 「所属」选项（团体 / 官方 / 13 成员 / 其他），补充表单与卡片编辑共用 */
type WhoOption = {
  value: string;
  label: string;
  category: 'group' | 'official' | 'member' | 'variety' | 'other';
  memberId: string | null;
};
function buildWhoOptions(t: (k: string) => string, L: (v?: string) => string): WhoOption[] {
  return [
    { value: 'group', label: t('updates.whoGroup'), category: 'group', memberId: null },
    { value: 'official', label: t('updates.srcOfficial'), category: 'official', memberId: null },
    ...members.map((m) => ({
      value: m.id,
      label: L(m.stageName),
      category: 'member' as const,
      memberId: m.id,
    })),
    { value: 'other', label: t('updates.srcOther'), category: 'other', memberId: null },
  ];
}

/* 编辑覆盖层本机缓存（云端不可用时兜底，联网后与云端合并） */
const EDITS_KEY = 'feed_edits';
function loadLocalEdits(): Record<string, FeedEdit> {
  try {
    const r = localStorage.getItem(EDITS_KEY);
    return r ? (JSON.parse(r) as Record<string, FeedEdit>) : {};
  } catch {
    return {};
  }
}
function saveLocalEdits(m: Record<string, FeedEdit>): void {
  try {
    localStorage.setItem(EDITS_KEY, JSON.stringify(m));
  } catch {
    /* 容量满忽略 */
  }
}

/** 该条动态的来源展示名 + 主题色 */
function sourceOf(item: UpdateItem, t: (k: string) => string, L: (v?: string) => string): { name: string; emoji: string; color: string } {
  if (item.category === 'member' && item.memberId && memberMap[item.memberId]) {
    const m = memberMap[item.memberId];
    return { name: L(m.stageName), emoji: m.emoji, color: m.representativeColor };
  }
  switch (item.category) {
    case 'group':
      return { name: 'SEVENTEEN', emoji: '💎', color: '#7C3AED' };
    case 'official':
      return { name: t('updates.srcOfficial'), emoji: '📣', color: '#2563EB' };
    case 'variety':
      return { name: t('updates.srcVariety'), emoji: '🎬', color: '#FF8C42' };
    default:
      return { name: t('updates.srcOther'), emoji: '📌', color: '#8A8A8A' };
  }
}

/* ── 整段分享文案解析（小红书 / 各平台通用） ───────────────────
   用户通常复制的是一段「标题 + 链接 + 引导语」的文本，例如：
     悄悄话🤫 听完再睡~ https://xhslink.cn/o/A0PytZk8F1
     去【小红书】看看这篇宝藏笔记吧！
   目标是把「标题」和「链接」拆出来，自动回填到表单。 */
const TITLE_GUIDE_RE =
  /^(先复制|复制内容|复制文本并|内容复制后|复制这段|复制后|复制一下文字|去【小红书】|去小红书|前往|打开|进入|点击|长按|直达|这篇笔记在|存下口令|看看|快来|速览|候着你|一键|跳转|直接就能阅读|直接打开).*$/i;
const GUIDE_KEYWORDS = [
  '去小红书', '复制', '前往', '打开', '看看', '笔记就', '候着你', '一键', '速览', '快来',
  '内容复制', '先复制', '直达', '进入', '存下口令', '这段', '点击', '跳转', '长按',
];

/** 判断一段文字是否「引导语」（只含动作/平台词，没有实质标题内容） */
function looksLikeGuide(t: string): boolean {
  const pure = t.replace(/[，。、！!？?\s【】()。.]/g, '');
  return GUIDE_KEYWORDS.some((k) => pure.includes(k));
}

/** 从一段文本里取出标题：按句末标点切分后取最后一段，并剥离开头的引导语前缀 */
function extractTitleFromText(s: string): string | undefined {
  const parts = s.split(/[。！!？?\n]/).map((x) => x.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    let t = parts[i].replace(TITLE_GUIDE_RE, '').trim();
    t = t.replace(/[，,、\s]+$/, '').trim();
    if (t && !looksLikeGuide(t)) return t;
  }
  return undefined;
}

/** 解析整段分享文案，返回识别到的链接与标题 */
function parseSharedText(raw: string): { url?: string; title?: string } {
  const text = raw.trim();
  const urlMatch = text.match(/https?:\/\/[^\s，。、\n\r]+/i);
  if (!urlMatch) {
    // 没有链接：整段去掉引导语后作为标题候选
    const t = extractTitleFromText(text);
    return { url: undefined, title: t };
  }
  const url = urlMatch[0];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const urlLineIdx = lines.findIndex((l) => l.includes(url));
  const candidates: string[] = [];
  if (urlLineIdx !== -1) {
    const urlLine = lines[urlLineIdx];
    const before = urlLine.slice(0, urlLine.indexOf(url)).trim();
    if (before) candidates.push(before);
    for (let i = urlLineIdx - 1; i >= 0; i--) {
      candidates.push(lines[i]);
      break;
    }
  }
  for (const c of candidates) {
    const t = extractTitleFromText(c);
    if (t) return { url, title: t };
  }
  return { url, title: undefined };
}

/** 从任意文本中提取第一个合法 http(s) 链接 */
function extractFirstUrl(text: string): string | undefined {
  const m = text.trim().match(/https?:\/\/[^\s，。、\n\r]+/i);
  return m ? m[0] : undefined;
}

/** 去除链接后多余的中文文案/平台引导语，返回可供标题使用的文本 */
function cleanUrlTail(text: string, url: string): string {
  return text
    .replace(url, '')
    .replace(/^\s*[：:：]\s*/, '')
    .replace(/[，。、！!？?\s]+$/, '')
    .trim();
}

/* ── 组件 ─────────────────────────────────────────────── */
export default function UpdatesSection() {
  const { lang, t, L } = useI18n();

  /* 平台筛选维度 */
  const PLATFORM_TABS: { key: Platform | 'all'; label: string; icon: string }[] = [
    { key: 'all', label: t('updates.filterAllPlatforms'), icon: '🌐' },
    ...(Object.keys(PLATFORM_META) as Platform[]).map((k) => ({
      key: k,
      label: L(PLATFORM_META[k].label),
      icon: PLATFORM_META[k].icon,
    })),
  ];

  /* Instagram 二级账号：官号 + 13 位成员 */
  const IG_ACCOUNTS: { key: 'all' | 'official' | string; label: string; emoji: string; color?: string }[] = [
    { key: 'all', label: t('updates.filterAllIG'), emoji: '🌐' },
    { key: 'official', label: t('updates.igOfficial'), emoji: '📷', color: '#7C3AED' },
    ...members.map((m) => ({
      key: m.id,
      label: L(m.stageName),
      emoji: m.emoji,
      color: m.representativeColor,
    })),
  ];

  /* 小红书二级账号：尹净汉 / 洪知秀 / 文俊辉（仅此三位成员开通） */
  const XHS_MEMBER_IDS = ['jeonghan', 'joshua', 'jun'];
  const XHS_ACCOUNTS: { key: 'all' | string; label: string; emoji: string; color?: string }[] = [
    { key: 'all', label: t('updates.filterAllXHS'), emoji: '📕' },
    ...members
      .filter((m) => XHS_MEMBER_IDS.includes(m.id))
      .map((m) => ({ key: m.id, label: L(m.stageName), emoji: m.emoji, color: m.representativeColor })),
  ];

  /* Weverse 二级账号：官方公告 + 13 位成员（帖子 / 直播） */
  const WEVERSE_ACCOUNTS: { key: 'all' | 'official' | string; label: string; emoji: string; color?: string }[] = [
    { key: 'all', label: t('updates.filterAllWeverse'), emoji: '🌐' },
    { key: 'official', label: t('updates.weverseOfficial'), emoji: '📢', color: '#2D6CDF' },
    ...members.map((m) => ({
      key: m.id,
      label: L(m.stageName),
      emoji: m.emoji,
      color: m.representativeColor,
    })),
  ];

  /* 微博二级账号：团体官号 + 文俊辉 + 徐明浩 */
  const WEIBO_ACCOUNTS: { key: 'all' | 'official' | string; label: string; emoji: string; color?: string }[] = [
    { key: 'all', label: t('updates.filterAllWeibo'), emoji: '🌐' },
    { key: 'official', label: t('updates.weiboGroupOfficial'), emoji: '🌐', color: '#E6162D' },
    { key: 'jun', label: L(memberMap['jun']?.stageName), emoji: memberMap['jun']?.emoji ?? '🐱', color: memberMap['jun']?.representativeColor },
    { key: 'the8', label: L(memberMap['the8']?.stageName), emoji: memberMap['the8']?.emoji ?? '🐸', color: memberMap['the8']?.representativeColor },
  ];

  /* 补充动态表单：「所属」选项（团体 / 官方 / 13 成员 / 其他） */
  const WHO_OPTIONS = buildWhoOptions(t, L);

  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [igAccount, setIgAccount] = useState<'all' | 'official' | string>('all');
  const [xhsAccount, setXhsAccount] = useState<'all' | string>('all');
  const [wvAccount, setWvAccount] = useState<'all' | 'official' | string>('all');
  const [weiboAccount, setWeiboAccount] = useState<'all' | 'official' | string>('all');
  const [asc, setAsc] = useState(false); // false = 倒序（最新在前）
  const [liveItems, setLiveItems] = useState<UpdateItem[]>([]);
  const [liveAt, setLiveAt] = useState<number | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveSource, setLiveSource] = useState<'cloud' | 'live' | 'mixed' | null>(null);
  const [visible, setVisible] = useState(24); // 列表分页：初始渲染条数，切筛选时重置

  /* 云端手动补充动态（人人可见、合并展示、按 URL 去重） */
  const [cloudUpdates, setCloudUpdates] = useState<CloudUpdate[]>([]);
  const [localUpdates, setLocalUpdates] = useState<CloudUpdate[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formWho, setFormWho] = useState('');
  const [formKind, setFormKind] = useState<UpdateKind>('post');
  const [formDate, setFormDate] = useState(() => toDatetimeLocal(new Date().toISOString()));
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formRaw, setFormRaw] = useState(''); // 整段分享文案（AI 辅助识别标题+链接）
  const [formPublishedAt, setFormPublishedAt] = useState<string | undefined>(undefined);
  const [formMedia, setFormMedia] = useState<MediaItem[]>([]);
  /* 多人共创：勾选多位成员，内容一起展示 */
  const [multiMode, setMultiMode] = useState(false);
  const [formMembers, setFormMembers] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveHint, setResolveHint] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const myId = publisherId();
  const [builderMode, setBuilderMode] = useState(false);
  /* 全量编辑覆盖层：{ itemId: { title?, description?, date?, publishedAt? } }，渲染时套用 */
  const [edits, setEdits] = useState<Record<string, FeedEdit>>(() => loadLocalEdits());
  /* 媒体叠加层：{ safeItemId: { publisherId: MediaItem[] } }，多位访客各自累积、互不覆盖 */
  const [mediaOverlays, setMediaOverlays] = useState<MediaOverlayMap>({});

  /* 进入页面：先读本地兜底，再拉云端共享补充 */
  useEffect(() => {
    setLocalUpdates(localStore.loadLocal());
    const ctrl = new AbortController();
    setCloudLoading(true);
    listCloudUpdates(ctrl.signal)
      .then((list) => setCloudUpdates(list))
      .catch(() => {
        /* 云端不可用不影响基础数据 */
      })
      .finally(() => setCloudLoading(false));
    /* 同步编辑覆盖层（云端优先，覆盖本机缓存） */
    listFeedEdits()
      .then((cloud) => setEdits((prev) => ({ ...prev, ...cloud })))
      .catch(() => {
        /* 云端不可用则用本机缓存 */
      });
    /* 同步媒体叠加层：一次拉回所有访客给所有动态上传的媒体 */
    listAllMediaOverlays()
      .then((cloud) => setMediaOverlays(cloud))
      .catch(() => {
        /* 云端不可用则不叠加媒体 */
      });
    return () => ctrl.abort();
  }, []);

  /* 某访客保存自己给某动态上传的媒体（乐观更新本地，再持久化云端） */
  const handleMyMediaChange = useCallback(
    async (safeId: string, media: MediaItem[]) => {
      setMediaOverlays((prev) => ({
        ...prev,
        [safeId]: { ...(prev[safeId] || {}), [myId]: media },
      }));
      try {
        await saveMyMedia(safeId, myId, media);
      } catch (e) {
        /* 云端失败不影响本机预览，但必须让用户知道：否则会出现「我传了别人看不到」 */
        window.alert(
          `${t('updates.mediaSaveFail')}${e instanceof Error ? `（${e.message}）` : ''}`
        );
      }
    },
    [myId, t]
  );

  const loadLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const r = await fetchLiveFeeds();
      setLiveItems(r.items);
      setLiveAt(r.at);
      setLiveSource(r.source);
    } catch {
      /* 抓取失败不影响精选数据 */
    } finally {
      setLiveLoading(false);
    }
  }, []);

  /* 进入页面先拉一次；之后每 60s 自动轮询（让 YouTube/B站/云端同步数据回流），
     切回标签页时立即刷新 —— 解决「手动复制链接不及时更新」之外，实时源也能自走 */
  useEffect(() => {
    let timer: number | undefined;
    const start = () => {
      loadLive();
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(() => {
        // 仅当页面可见时轮询，省流量
        if (!document.hidden) loadLive();
      }, 60_000);
    };
    start();
    const onVisible = () => {
      if (!document.hidden) loadLive();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadLive]);

  /* 打开补充表单时：上传时间复位为今天，并清空上次识别到的发布时间 / 媒体 */
  useEffect(() => {
    if (showForm) {
      setFormDate(toDatetimeLocal(new Date().toISOString()));
      setFormPublishedAt(undefined);
      setFormMedia([]);
      setMultiMode(false);
      setFormMembers([]);
    }
  }, [showForm]);

  /* 链接自动识别：粘贴链接后，自动抓取文案与发布时间。
     识别到的「原帖发布时间」(publishedAt) 会回填为这条动态的主时间（即发布帖子的人发布的时间，
     而不是你补链接的时间）；识别不到的平台则保留表单里的日期时间让你手动填真实时分。 */
  const resolveTimer = useRef<number | undefined>(undefined);
  const onUrlChange = (v: string) => {
    const raw = v.trim();
    const clean = extractFirstUrl(raw) || raw;
    const trimmedChanged = clean !== raw && /^https?:\/\//i.test(clean);
    setFormUrl(clean);
    // 如果用户把整段文案误贴进链接框，自动拆出链接并把剩余文字回填到标题
    if (trimmedChanged && !formTitle && !formRaw) {
      const tail = cleanUrlTail(raw, clean);
      const t = extractTitleFromText(tail);
      if (t) setFormTitle(t);
    }
    setResolveHint('');
    setFormPublishedAt(undefined);
    if (!/^https?:\/\//i.test(clean)) {
      setResolving(false);
      return;
    }
    setResolving(true);
    if (resolveTimer.current) window.clearTimeout(resolveTimer.current);
    resolveTimer.current = window.setTimeout(async () => {
      const platform = detectPlatform(clean);
      const meta = await resolveLink(clean);
      setResolving(false);
      if (meta?.ok && meta.platform === 'instagram' && meta.igMemberId) {
        // 离线文案库命中：自动识别成员 + 文案（描述）+ 发布时间
        const who = WHO_OPTIONS.find((o) => o.memberId === meta.igMemberId);
        if (who && formWho !== who.value) setFormWho(who.value);
        if (!formDesc.trim() && meta.igCaption) setFormDesc(meta.igCaption);
        const baseTitle = who ? who.label : meta.igName || '';
        if (!formTitle.trim()) setFormTitle(`${baseTitle} ${t('updates.igUpdate')}`);
        if (meta.publishedAt) {
          setFormPublishedAt(meta.publishedAt);
          setFormDate(meta.publishedAt.slice(0, 16)); // 原帖发布时间回填为主时间
        }
        const cap = (meta.igCaption || '').trim();
        setResolveHint(
          `✅ ${t('updates.igRecognized', { name: meta.igName || '' })}${
            cap ? `：${cap}` : ''
          }${meta.publishedAt ? `（${t('updates.origPublished')} ${fmtDate(lang, new Date(meta.publishedAt))}）` : ''}`,
        );
      } else if (meta?.ok) {
        if (!formTitle && meta.title) setFormTitle(meta.title);
        // 链接识别到原帖发布时间 → 回填为主时间（发布帖子的人发布的时间，而非补链接的时间）
        if (meta.publishedAt) {
          setFormPublishedAt(meta.publishedAt);
          setFormDate(meta.publishedAt.slice(0, 16));
        }
        setResolveHint(
          `${t('updates.autoIdentified', { title: meta.title ? L(meta.title) : '' })}${
            meta.publishedAt ? `（${t('updates.origPublished')} ${fmtDate(lang, new Date(meta.publishedAt))}）` : ''
          }`,
        );
      } else if (platform === 'instagram') {
        const opt = WHO_OPTIONS.find((o) => o.value === formWho);
        if (opt && !formTitle) setFormTitle(`${opt.label} ${t('updates.igUpdate')}`);
        setResolveHint(t('updates.igAutoTitle'));
      } else {
        setResolveHint(t('updates.resolveFailed'));
      }
    }, 700);
  };

  /* 整段文案一键识别：粘贴小红书等分享文案后，自动拆出标题 + 链接并回填表单 */
  const parseRaw = () => {
    const raw = formRaw.trim();
    if (!raw) return;
    const { url, title } = parseSharedText(raw);
    if (title && !formTitle) setFormTitle(title);
    if (url) {
      // 触发链接自动识别（标题 / 发布时间），与单填链接行为一致
      onUrlChange(url);
    } else {
      setResolveHint(t('updates.noLink'));
    }
  };

  /* 发布一条补充动态：先尝试云端，失败则存本机（联网后自动同步） */
  const submitForm = async () => {
    setFormMsg('');
    const rawUrl = formUrl.trim();
    const url = extractFirstUrl(rawUrl) || rawUrl;
    if (url !== rawUrl) setFormUrl(url);
    if (!/^https?:\/\//i.test(url)) {
      setFormMsg(t('updates.needValidLink'));
      return;
    }
    // 已有同链接 → 提示而不是静默去重，避免用户以为没发布成功
    const dup = allItems.find((it) => it.url === url);
    if (dup) {
      setFormMsg(t('updates.duplicateUrl', { title: String(dup.title).slice(0, 30) }));
      return;
    }
    const platform = detectPlatform(url);
    const kind: UpdateKind = formKind;

    /* 多人共创：勾选多位成员，内容一起展示 */
    let category: UpdateCategory;
    let memberId: string | null;
    let memberIds: string[] | null = null;
    let defaultTitle: string;
    if (multiMode) {
      if (formMembers.length === 0) {
        setFormMsg(t('updates.needMembers'));
        return;
      }
      category = 'member';
      memberId = formMembers[0];
      memberIds = formMembers;
      const names = formMembers
        .map((id) => memberMap[id]?.stageName)
        .filter(Boolean)
        .map((s) => L(s as string));
      defaultTitle = `${names.join(' · ')} ${t('updates.coopLabel')}`;
    } else {
      const opt = WHO_OPTIONS.find((o) => o.value === formWho);
      if (!opt) {
        setFormMsg(t('updates.needBelong'));
        return;
      }
      category = opt.category;
      memberId = opt.memberId;
      defaultTitle =
        platform === 'instagram'
          ? `${opt.label} ${t('updates.igUpdate')}`
          : `${opt.label} ${L(PLATFORM_META[platform].label)} ${t('updates.dynamic')}`;
    }
    const title = formTitle.trim() || defaultTitle;
    // 主时间优先采用「链接识别出的原帖发布时间」(formPublishedAt)；否则用表单填写的时间（默认=现在）
    const date = formPublishedAt
      ? formPublishedAt.length === 16
        ? `${formPublishedAt}:00`
        : formPublishedAt.slice(0, 19)
      : formDate
        ? `${formDate}:00`
        : new Date().toISOString().slice(0, 16);
    const payload: Omit<CloudUpdate, 'id'> = {
      category,
      memberId,
      memberIds,
      platform,
      kind,
      title,
      description: formDesc.trim() || undefined,
      date,
      publishedAt: formPublishedAt,
      url,
      media: formMedia.length ? formMedia : undefined,
      publisherId: myId,
      timestamp: Date.now(),
    };
    setSubmitting(true);
    try {
      const saved = await uploadCloudUpdate(payload);
      setCloudUpdates((prev) => [saved, ...prev]);
      setLocalUpdates((prev) => {
        const next = [saved, ...prev.filter((x) => x.url !== saved.url)];
        localStore.saveLocal(next);
        return next;
      });
      setFormMsg(t('updates.publishedCloud'));
      setHighlightId(saved.id);
      window.setTimeout(() => setHighlightId((id) => (id === saved.id ? null : id)), 4000);
      setFormUrl('');
      setFormTitle('');
      setFormDesc('');
      setFormRaw('');
      setFormPublishedAt(undefined);
      setFormMedia([]);
      setResolving(false);
      setResolveHint('');
      window.setTimeout(() => setShowForm(false), 1200);
    } catch {
      // 云端不可用 → 仅存本机，联网后重新提交即可（注意：媒体文件上传必须先成功，因此本地兜底不带媒体文件）
      const local: CloudUpdate = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ...payload,
        media: undefined,
      };
      setLocalUpdates((prev) => {
        const next = [local, ...prev];
        localStore.saveLocal(next);
        return next;
      });
      setFormMsg(t('updates.cloudUnavailable'));
      setFormUrl('');
      setFormTitle('');
      setFormDesc('');
      setFormPublishedAt(undefined);
      setFormMedia([]);
    } finally {
      setSubmitting(false);
    }
  };

  /* 删除自己发布的补充动态（不影响官方同步数据） */
  const onDeleteUser = async (u: CloudUpdate) => {
    try {
      if (!u.id.startsWith('local_')) await deleteCloudUpdate(u.id);
    } catch {
      /* 忽略删除失败 */
    }
    setCloudUpdates((prev) => prev.filter((x) => x.id !== u.id));
    setLocalUpdates((prev) => {
      const next = prev.filter((x) => x.id !== u.id);
      localStore.saveLocal(next);
      return next;
    });
  };

  /* 编辑（更新）一条补充动态：发布者自己或建设者均可修改时间 / 备注 / 标题 */
  const onUpdateUser = async (u: CloudUpdate) => {
    try {
      if (!u.id.startsWith('local_')) await updateCloudUpdate(u);
    } catch {
      /* 云端更新失败不阻断本地展示 */
    }
    setCloudUpdates((prev) => prev.map((x) => (x.id === u.id ? u : x)));
    setLocalUpdates((prev) => {
      const next = prev.map((x) => (x.id === u.id ? u : x));
      localStore.saveLocal(next);
      return next;
    });
  };

  /* 保存一条「覆盖层」编辑（硬编码 / 云端同步项没有自己的文件，走覆盖层） */
  const saveOverlay = async (id: string, fields: FeedEdit) => {
    const next = { ...edits, [id]: fields };
    setEdits(next);
    saveLocalEdits(next);
    try {
      await saveFeedEdit(id, fields);
    } catch {
      /* 云端失败不影响本机展示 */
    }
  };

  /* 统一编辑入口：
   *  - 本人或建设者编辑社区项 → 直接改原文件
   *  - 其他访客（含同步 / 硬编码项）→ 走覆盖层叠加，绝不覆盖原发布者内容
   *  这样「所有人可上传照片 / 视频」时，任何访客给任意卡片加的媒体都安全共享、可回退 */
  const handleEdit = async (item: UpdateItem, fields: FeedEdit) => {
    const cu = userItemMap.get(item.id);
    const isOwn = cu && cu.publisherId === myId;
    if (cu && (isOwn || builderMode)) {
      await onUpdateUser({ ...cu, ...fields });
    } else {
      await saveOverlay(item.id, fields);
    }
  };

  /* 还原一条覆盖层编辑（恢复为原始内容） */
  const handleRevert = async (item: UpdateItem) => {
    const next = { ...edits };
    delete next[item.id];
    setEdits(next);
    saveLocalEdits(next);
    try {
      await deleteFeedEdit(item.id);
    } catch {
      /* 忽略 */
    }
  };

  /* 删除一条动态：社区补充项直接删云端文件；硬编码 / 同步项走「软删除覆盖层」 */
  const handleDelete = async (item: UpdateItem) => {
    const cu = userItemMap.get(item.id);
    if (cu) {
      await onDeleteUser(cu);
    } else {
      await saveOverlay(item.id, { ...(edits[item.id] || {}), deleted: true });
    }
  };

  /* 云端 + 本地手动补充：按 URL 去重合并为一份（重复的只留一个） */
  const userUpdates = useMemo<CloudUpdate[]>(() => {
    const map = new Map<string, CloudUpdate>();
    [...localUpdates, ...cloudUpdates]
      // 仅隐藏自动同步的旧数据：尹净汉 / 洪知秀小红书在 2026-08-21 前由脚本抓取的冗余条目
      // 用户手动补充的内容始终可见
      .filter(
        (u) =>
          !(
            u.platform === 'xiaohongshu' &&
            (u.memberId === 'jeonghan' || u.memberId === 'joshua') &&
            u.publisherId.startsWith('auto-')
          ),
      )
      .forEach((u) => {
        const k = u.url || u.id;
        if (!map.has(k)) map.set(k, u);
      });
    return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
  }, [cloudUpdates, localUpdates]);

  const userItemMap = useMemo(() => {
    const m = new Map<string, CloudUpdate>();
    userUpdates.forEach((u) => m.set(u.id, u));
    return m;
  }, [userUpdates]);

  /* 所有动态：基础同步 + 实时 + 云端手动补充，三者合并、按 URL 去重（不覆盖） */
  const allItems = useMemo<UpdateItem[]>(() => {
    const seen = new Set<string>();
    const out: UpdateItem[] = [];
    const push = (it: UpdateItem) => {
      const key = it.url || it.id;
      if (key) {
        if (seen.has(key)) return; // 重复链接只出现一次
        seen.add(key);
      }
      out.push(it);
    };
    updates.forEach(push);
    liveItems.forEach(push);
    userUpdates.forEach((u) =>
      push({
        id: u.id,
        category: u.category,
        memberId: u.memberId,
        memberIds: u.memberIds,
        platform: u.platform,
        kind: u.kind,
        title: u.title,
        description: u.description,
        date: u.date,
        publishedAt: u.publishedAt,
        timestamp: u.timestamp,
        url: u.url,
        media: u.media,
      }),
    );
    return out;
  }, [liveItems, userUpdates]);

  /* 套用编辑覆盖层 + 媒体叠加层：
     所有项按 id 叠加 title/description/date/publishedAt/url；
     媒体则合并「原媒体 + 各访客上传的媒体（互不覆盖）+ 旧覆盖层里的媒体」，按 url 去重；
     软删除（deleted）项在非建设者模式下彻底隐藏，建设者模式下保留以便恢复 */
  const displayItems = useMemo<UpdateItem[]>(() => {
    if (Object.keys(edits).length === 0 && Object.keys(mediaOverlays).length === 0) return allItems;
    return allItems
      .filter((it) => {
        const e = edits[it.id];
        if (e && e.deleted) return builderMode; // 软删项：仅建设者可见用于恢复
        return true;
      })
      .map((it) => {
        const e = edits[it.id];
        const overlayMedia = Object.values(mediaOverlays[encodeItemKey(it.id)] || {}).flat();
        // 合并媒体：原媒体 + 各访客叠加 + 旧覆盖层里的媒体，按 url 去重
        const seen = new Set<string>();
        const merged: MediaItem[] = [];
        for (const list of [it.media, overlayMedia, e?.media]) {
          if (!Array.isArray(list)) continue;
          for (const m of list) {
            if (m?.url && !seen.has(m.url)) {
              seen.add(m.url);
              merged.push(m);
            }
          }
        }
        if (!e && merged.length === 0) return it;
        return {
          ...it,
          title: e?.title ?? it.title,
          description: e?.description ?? it.description,
          date: e?.date ?? it.date,
          publishedAt: e?.publishedAt ?? it.publishedAt,
          url: e?.url ?? it.url,
          /* 编辑时改「所属 / 多人共创」成员归属，覆盖层也一并套用 */
          category: e?.category ?? it.category,
          memberId: e?.memberId ?? it.memberId,
          memberIds: e?.memberIds ?? it.memberIds,
          media: merged.length ? merged : it.media,
        };
      });
  }, [allItems, edits, mediaOverlays, builderMode]);

  const igCounts = useMemo(() => {
    const igItems = allItems.filter((u) => u.platform === 'instagram');
    const counts: Record<string, number> = {
      all: igItems.length,
      official: igItems.filter((u) => !u.memberId && !u.memberIds).length,
    };
    members.forEach((m) => {
      counts[m.id] = igItems.filter((u) => u.memberIds?.includes(m.id) || u.memberId === m.id).length;
    });
    return counts;
  }, [allItems]);

  const xhsCounts = useMemo(() => {
    const xhsItems = allItems.filter((u) => u.platform === 'xiaohongshu');
    const counts: Record<string, number> = { all: xhsItems.length };
    members.forEach((m) => {
      counts[m.id] = xhsItems.filter((u) => u.memberIds?.includes(m.id) || u.memberId === m.id).length;
    });
    return counts;
  }, [allItems]);

  const wvCounts = useMemo(() => {
    const wvItems = allItems.filter((u) => u.platform === 'weverse');
    const counts: Record<string, number> = {
      all: wvItems.length,
      // 官方公告 = 全部「公告」类（含官号与成员入伍预告等官方内容）
      official: wvItems.filter((u) => u.kind === 'announcement' && !u.memberIds).length,
    };
    // 各成员 = 帖子 + 直播（不含公告）
    members.forEach((m) => {
      counts[m.id] = wvItems.filter(
        (u) =>
          (u.memberIds?.includes(m.id) || u.memberId === m.id) && u.kind !== 'announcement',
      ).length;
    });
    return counts;
  }, [allItems]);

  const weiboCounts = useMemo(() => {
    const wbItems = allItems.filter((u) => u.platform === 'weibo');
    const counts: Record<string, number> = {
      all: wbItems.length,
      official: wbItems.filter((u) => !u.memberId && !u.memberIds).length,
    };
    members.forEach((m) => {
      counts[m.id] = wbItems.filter((u) => u.memberIds?.includes(m.id) || u.memberId === m.id).length;
    });
    return counts;
  }, [allItems]);

  const filtered = useMemo(() => {
    let list = displayItems.filter((u) => {
      if (platform !== 'all' && u.platform !== platform) return false;
      return true;
    });
    if (platform === 'instagram' && igAccount !== 'all') {
      list = list.filter((u) =>
        igAccount === 'official' ? !u.memberId && !u.memberIds : u.memberIds?.includes(igAccount) || u.memberId === igAccount,
      );
    }
    if (platform === 'xiaohongshu' && xhsAccount !== 'all') {
      list = list.filter((u) => u.memberIds?.includes(xhsAccount) || u.memberId === xhsAccount);
    }
    if (platform === 'weverse' && wvAccount !== 'all') {
      list = list.filter((u) =>
        wvAccount === 'official'
          ? u.kind === 'announcement' && !u.memberIds
          : (u.memberIds?.includes(wvAccount) || u.memberId === wvAccount) && u.kind !== 'announcement',
      );
    }
    if (platform === 'weibo' && weiboAccount !== 'all') {
      list = list.filter((u) =>
        weiboAccount === 'official' ? !u.memberId && !u.memberIds : u.memberIds?.includes(weiboAccount) || u.memberId === weiboAccount,
      );
    }
    list = [...list].sort((a, b) => {
      // 按「笔记原发布时间」排序：优先 publishedAt，其次 date；不再按上传时间(timestamp)
      const ta = new Date(pickTime(a.publishedAt, a.date)).getTime();
      const tb = new Date(pickTime(b.publishedAt, b.date)).getTime();
      return asc ? ta - tb : tb - ta;
    });
    return list;
  }, [platform, igAccount, xhsAccount, wvAccount, weiboAccount, asc, displayItems]);

  /* 切换任意筛选条件时，把列表回到首页（避免长列表残留 + 减少 DOM 节点） */
  useEffect(() => {
    setVisible(24);
  }, [platform, igAccount, xhsAccount, wvAccount, weiboAccount, asc]);

  /* 分页：仅渲染前 visible 条，点击「加载更多」追加，彻底消除长列表卡顿 */
  const paged = useMemo(() => filtered.slice(0, visible), [filtered, visible]);

  const liveCount = useMemo(
    () => allItems.filter((u) => u.kind === 'live').length,
    [allItems],
  );

  return (
    <section id="updates" className="py-14 px-4 sm:px-6 bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-5xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-2">
          <p className="text-sm text-primary font-semibold tracking-widest">LIVE UPDATES</p>
          <SectionTitle tKey="section.updates" className="text-3xl sm:text-4xl font-black tracking-tight mt-1" />
          <p className="text-muted-foreground mt-2 text-sm">
            {t('updates.intro')}
          </p>
        </div>

        {/* 概览统计 */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5 mb-6">
          <Stat label={t('updates.statTotal')} value={allItems.length} />
          <Stat label={t('updates.statLive')} value={liveCount} dot="bg-red-500" />
          <Stat label={t('updates.srcOfficial')} value={officialAccounts.length} />
          <Stat label={t('updates.statMembers')} value={members.length} />
            <button
              onClick={loadLive}
              disabled={liveLoading}
              className="flex items-center gap-1.5 bg-background border border-border rounded-full px-3 py-1.5 shadow-sm hover:bg-muted/50 transition disabled:opacity-60 touch-manipulation"
              title={t('updates.realtimeTitle')}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  liveLoading ? 'bg-amber-400 animate-pulse' : liveAt ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              />
              <span className="text-xs font-medium">
                {liveLoading
                  ? t('updates.syncing')
                  : liveAt
                    ? t('updates.realtimeCount', { n: liveItems.length })
                    : t('updates.realtimeOff')}
              </span>
              {liveAt && liveSource && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                  {liveSource === 'cloud'
                    ? t('updates.srcCloud')
                    : liveSource === 'mixed'
                      ? t('updates.srcMixed')
                      : t('updates.srcLive')}
                </span>
              )}
              <span className="text-xs text-muted-foreground">↻</span>
            </button>
        </div>

        {/* 补充动态区域：所有人可复制链接上传，信息同步、去重、按时间排序 */}
        <div className="rounded-3xl border border-primary/30 bg-card p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-bold flex items-center gap-2 text-base">📝 {t('updates.supplement')}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {t('updates.supplementDescA')}<b>{t('updates.supplementDescB')}</b>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!builderMode) {
                    const pwd = window.prompt(t('updates.builderPrompt'));
                    if (pwd === 'carat2026') setBuilderMode(true);
                    else if (pwd !== null) window.alert(t('updates.builderWrong'));
                  } else {
                    setBuilderMode(false);
                  }
                }}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                  builderMode
                    ? 'bg-[#E8555E]/10 border-[#E8555E]/30 text-[#E8555E]'
                    : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
                }`}
                title={t('updates.builderTitle')}
              >
                {builderMode ? `🔧 ${t('updates.builderMode')}：开` : `🔧 ${t('updates.builderMode')}`}
              </button>
              {cloudLoading && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="正在同步云端" />}
            </div>
          </div>
          {/* 整段粘贴识别：粘贴小红书等分享文案，自动拆出标题 + 链接 */}
          <div className="mb-3">
            <label className="text-xs text-muted-foreground">
              {t('updates.pasteLabel')}
            </label>
            <textarea
              value={formRaw}
              onChange={(e) => setFormRaw(e.target.value)}
              rows={3}
              placeholder={t('updates.pastePlaceholder')}
              className="w-full mt-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={parseRaw}
                disabled={!formRaw.trim()}
                className="text-xs rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 font-medium text-primary hover:bg-primary/10 transition disabled:opacity-50"
              >
                {t('updates.recognizeBtn')}
              </button>
              <span className="text-[11px] text-muted-foreground">{t('updates.recognizeHint')}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr,160px,auto]">
            <div className="sm:col-span-3">
              <label className="text-xs text-muted-foreground">{t('updates.fieldUrl')}</label>
              <input
                value={formUrl}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder={t('updates.urlPlaceholder')}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="mt-1 text-[11px] min-h-[14px]">
                {resolving && <span className="text-muted-foreground">{t('updates.recognizing')}</span>}
                {!resolving && resolveHint && (
                  <span className={resolveHint.startsWith('✅') ? 'text-emerald-600' : 'text-amber-600'}>
                    {resolveHint}
                  </span>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('updates.fieldBelong')}</label>
              <div className="flex items-center gap-2">
                <select
                  value={formWho}
                  onChange={(e) => setFormWho(e.target.value)}
                  className={`w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${multiMode ? 'hidden' : ''}`}
                >
                  <option value="">{t('updates.selectPlaceholder')}</option>
                  {WHO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setMultiMode((v) => !v)}
                  className={`shrink-0 text-xs rounded-xl border px-3 py-2 font-medium transition ${
                    multiMode
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title={t('updates.multiHint')}
                >
                  {multiMode ? `👥 ${t('updates.multiToggle')}：开` : `👥 ${t('updates.multiToggle')}`}
                </button>
              </div>
              {multiMode && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const on = formMembers.includes(m.id);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() =>
                          setFormMembers((prev) => (on ? prev.filter((x) => x !== m.id) : [...prev, m.id]))
                        }
                        className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                          on ? '' : 'bg-background text-muted-foreground border-border hover:bg-muted/60'
                        }`}
                        style={
                          on
                            ? { backgroundColor: m.representativeColor, borderColor: m.representativeColor, color: '#fff' }
                            : undefined
                        }
                      >
                        <span>{m.emoji}</span>
                        <span>{L(m.stageName)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {multiMode && formMembers.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formMembers
                    .map((id) => L(memberMap[id]?.stageName))
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            <div className="flex items-end">
              <button
                onClick={submitForm}
                disabled={submitting}
                className="w-full sm:w-auto rounded-xl svt-gradient text-white px-5 py-2 text-sm font-bold shadow-sm hover:opacity-90 transition disabled:opacity-60 whitespace-nowrap"
              >
                {submitting ? t('updates.publishing') : t('updates.publish')}
              </button>
            </div>
          </div>

          {formMsg && <div className="text-xs text-muted-foreground mt-3">{formMsg}</div>}

          <div className="mt-3">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="text-xs text-muted-foreground hover:underline"
            >
              {showForm ? t('updates.collapseFields') : t('updates.expandFields')}
            </button>
          </div>

          {showForm && (
            <div className="grid gap-3 sm:grid-cols-2 mt-3 animate-fade-in">
              <div>
                <label className="text-xs text-muted-foreground">{t('updates.fType')}</label>
                <select
                  value={formKind}
                  onChange={(e) => setFormKind(e.target.value as UpdateKind)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  {(Object.keys(KIND_META) as UpdateKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_META[k].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('updates.fDate')}</label>
                <input
                  type="datetime-local"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('updates.fOrigDate')}</label>
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(formPublishedAt || '')}
                  onChange={(e) => setFormPublishedAt(e.target.value ? fromDatetimeLocal(e.target.value) : undefined)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('updates.fTitle')}</label>
                <input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder={t('updates.titlePlaceholder')}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{t('updates.fNote')}</label>
                <input
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder={t('updates.notePlaceholder')}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">{t('updates.fMedia')}</label>
                <MediaUploader
                  media={formMedia}
                  mineUrls={new Set(formMedia.map((m) => m.url))}
                  onAdd={(items) => setFormMedia((prev) => [...prev, ...items])}
                  onRemoveMine={(url) => setFormMedia((prev) => prev.filter((m) => m.url !== url))}
                  uploading={uploadingMedia}
                  setUploading={setUploadingMedia}
                  t={t}
                />
              </div>
            </div>
          )}
        </div>

        {/* 平台筛选 */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-4">
          {PLATFORM_TABS.map((pt) => {
            const label = pt.label;
            return (
              <Chip
                key={pt.key}
                active={platform === pt.key}
                onClick={() => {
                  setPlatform(pt.key);
                  if (pt.key !== 'instagram') setIgAccount('all');
                  if (pt.key !== 'xiaohongshu') setXhsAccount('all');
                  if (pt.key !== 'weverse') setWvAccount('all');
                  if (pt.key !== 'weibo') setWeiboAccount('all');
                }}
                small
              >
                {pt.icon} {label}
              </Chip>
            );
          })}
        </div>

        {/* Instagram 二级账号筛选（官号 + 13 成员） */}
        {platform === 'instagram' && (
          <AccountBar
            accounts={IG_ACCOUNTS}
            active={igAccount}
            onSelect={setIgAccount}
            getCount={(k) => igCounts[k] ?? 0}
            hint={t('updates.igHint', { n: igCounts.all })}
          />
        )}

        {/* 小红书二级账号筛选（尹净汉 / 洪知秀 / 文俊辉） */}
        {platform === 'xiaohongshu' && (
          <AccountBar
            accounts={XHS_ACCOUNTS}
            active={xhsAccount}
            onSelect={setXhsAccount}
            getCount={(k) => xhsCounts[k] ?? 0}
            hint={t('updates.xhsHint', { n: xhsCounts.all })}
            emptyHint={t('updates.xhsEmpty')}
          />
        )}

        {/* Weverse 二级账号筛选（官方公告 + 13 成员） */}
        {platform === 'weverse' && (
          <AccountBar
            accounts={WEVERSE_ACCOUNTS}
            active={wvAccount}
            onSelect={setWvAccount}
            getCount={(k) => wvCounts[k] ?? 0}
            hint={t('updates.wvHint', { n: wvCounts.all })}
            emptyHint={t('updates.wvEmpty')}
          />
        )}

        {/* 微博二级账号筛选（团体官号 + 文俊辉 + 徐明浩） */}
        {platform === 'weibo' && (
          <AccountBar
            accounts={WEIBO_ACCOUNTS}
            active={weiboAccount}
            onSelect={setWeiboAccount}
            getCount={(k) => weiboCounts[k] ?? 0}
            hint={t('updates.wbHint', { n: weiboCounts.all })}
            emptyHint={t('updates.wbEmpty')}
          />
        )}

        {/* 排序 + 计数 */}
        <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-xs text-muted-foreground">
            {t('updates.count', { n: filtered.length })}
            {platform !== 'all' && ` · ${L(PLATFORM_META[platform].label)}`}
            {platform === 'instagram' && igAccount !== 'all' && ` · ${IG_ACCOUNTS.find((a) => a.key === igAccount)?.label}`}
            {platform === 'xiaohongshu' && xhsAccount !== 'all' && ` · ${XHS_ACCOUNTS.find((a) => a.key === xhsAccount)?.label}`}
            {platform === 'weverse' && wvAccount !== 'all' && ` · ${WEVERSE_ACCOUNTS.find((a) => a.key === wvAccount)?.label}`}
            {platform === 'weibo' && weiboAccount !== 'all' && ` · ${WEIBO_ACCOUNTS.find((a) => a.key === weiboAccount)?.label}`}
          </span>
          <button
            onClick={() => setAsc((v) => !v)}
            className="text-xs px-3 py-1 rounded-full border border-border bg-background hover:bg-muted/50 transition"
          >
            {asc ? t('updates.sortOldest') : t('updates.sortNewest')}
          </button>
        </div>

        {/* 动态列表 */}
        {filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-16 text-sm">{t('updates.empty')}</div>
        ) : (
          <>
            <div className="space-y-3">
              {paged.map((item) => {
                const cu = userItemMap.get(item.id);
                const isOwn = cu && cu.publisherId === myId;
                const auto = Boolean(cu && cu.publisherId && cu.publisherId.startsWith('auto-'));
                const isDeleted = Boolean(edits[item.id]?.deleted);
                // 上传照片 / 视频：对全部访客开放（所有人可上传、所有人可见）
                const canEdit = true;
                // 删除仍仅限发布者本人或建设者，避免被滥用
                const canDelete = builderMode || (cu && isOwn);
                const safeId = encodeItemKey(item.id);
                const myM = mediaOverlays[safeId]?.[myId] || [];
                /* 软删除项：仅建设者模式下可见，提供「恢复」入口 */
                if (isDeleted) {
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-3"
                    >
                      <span className="text-sm text-muted-foreground truncate">
                        🚫 {L(item.title)}{' '}
                        <span className="opacity-70">· {t('updates.hiddenNote')}</span>
                      </span>
                      <button
                        onClick={() => handleRevert(item)}
                        className="text-xs rounded-lg border border-border bg-background px-3 py-1.5 font-medium hover:bg-muted/50 transition shrink-0"
                      >
                        {t('updates.restore')}
                      </button>
                    </div>
                  );
                }
                return (
                  <UpdateCard
                    key={item.id}
                    item={item}
                    community={Boolean(cu) && !auto}
                    auto={auto}
                    highlight={highlightId === item.id}
                    onEdit={canEdit ? handleEdit : undefined}
                    onRevert={canEdit ? handleRevert : undefined}
                    myMedia={myM}
                    onAddMyMedia={(items) => handleMyMediaChange(safeId, [...myM, ...items])}
                    onRemoveMyMedia={(url) => handleMyMediaChange(safeId, myM.filter((m) => m.url !== url))}
                    footerExtra={
                      canDelete ? (
                        <button
                          onClick={() => {
                            if (window.confirm(t('updates.confirmDelete'))) {
                              if (cu) onDeleteUser(cu);
                              else handleDelete(item);
                            }
                          }}
                          className="text-xs text-[#E8555E] hover:underline shrink-0 ml-3"
                        >
                          {t('updates.delete')}
                        </button>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
            {visible < filtered.length && (
              <div className="flex justify-center mt-5">
                <button
                  onClick={() => setVisible((v) => v + 24)}
                  className="text-xs font-medium px-5 py-2 rounded-full border border-border bg-background hover:bg-muted/60 transition"
                >
                  {t('updates.loadMore')} · {filtered.length - visible}
                </button>
              </div>
            )}
          </>
        )}

        {/* 说明 */}
        <p className="text-center text-[11px] text-muted-foreground/70 mt-8 leading-relaxed">
          {t('updates.foot1')}
          <br />
          {t('updates.foot2')}
          <br />
          {t('updates.foot3a')}
          <b>{t('updates.foot3Bold')}</b>
          {t('updates.foot3b')}
          <br />
          {t('updates.foot4')}
        </p>
      </div>
    </section>
  );
}

/* ── 子组件 ───────────────────────────────────────────── */
function Stat({ label, value, dot }: { label: string; value: number; dot?: string }) {
  return (
    <div className="flex items-center gap-2 bg-background border border-border rounded-full px-4 py-1.5 shadow-sm">
      {dot && <span className={`inline-block w-2 h-2 rounded-full ${dot} animate-pulse`} />}
      <span className="text-lg font-black tabular-nums">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  small,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full font-medium transition border ${
        small ? 'text-xs px-2.5 py-1' : 'text-sm px-3.5 py-1.5'
      } ${
        active
          ? 'bg-primary text-primary-foreground border-primary shadow'
          : 'bg-background text-muted-foreground border-border hover:bg-muted/60'
      }`}
    >
      {children}
    </button>
  );
}

/* 通用二级账号选择条：可鼠标拖拽 / 触屏滑动，点击切换账号筛选 */
function AccountBar({
  accounts,
  active,
  onSelect,
  getCount,
  hint,
  emptyHint,
}: {
  accounts: { key: string; label: string; emoji: string; color?: string }[];
  active: string;
  onSelect: (key: string) => void;
  getCount: (key: string) => number;
  hint?: string;
  emptyHint?: string;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });
  const onDown = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
  };
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const onUp = () => {
    drag.current.down = false;
  };
  const onLeave = () => {
    drag.current.down = false;
  };
  const onClick = (key: string) => {
    if (drag.current.moved) {
      drag.current.moved = false;
      return; // 拖拽误触，不切换筛选
    }
    onSelect(key);
  };
  return (
    <div className="mb-5">
      {hint && <div className="text-center text-xs text-muted-foreground mb-2">{hint}</div>}
      <div
        ref={ref}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onLeave}
        className="flex gap-2 overflow-x-auto pb-2 px-1 cursor-grab active:cursor-grabbing select-none [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {accounts.map((a) => {
          const isActive = active === a.key;
          const count = getCount(a.key);
          return (
            <button
              key={a.key}
              onClick={() => onClick(a.key)}
              title={t('updates.accountTitle', { label: a.label, n: count })}
              className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition whitespace-nowrap ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow'
                  : 'bg-background text-muted-foreground border-border hover:bg-muted/60'
              }`}
              style={isActive && a.color ? { backgroundColor: a.color, borderColor: a.color } : undefined}
            >
              <span>{a.emoji}</span>
              <span>{a.label}</span>
              <span
                className={`ml-0.5 min-w-[1.25rem] rounded-full px-1 py-0 text-[10px] ${
                  isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
      {emptyHint && active !== 'all' && getCount(active) === 0 && (
        <div className="text-center text-xs text-muted-foreground mt-2">{emptyHint}</div>
      )}
    </div>
  );
}

/* 成员选择组件：单选「所属」+ 可切换「多人共创」多选成员 chip。
   补充表单与卡片编辑共用同一套交互。 */
function MemberPicker({
  who,
  multi,
  onWhoChange,
  onToggleMulti,
  selected,
  onToggleMember,
  t,
  L,
}: {
  /** 单选模式下选中的 who 值（'' = 未选） */
  who: string;
  /** 是否处于多人共创模式 */
  multi: boolean;
  onWhoChange: (v: string) => void;
  onToggleMulti: (v: boolean) => void;
  /** 多人共创模式选中的成员 id 列表 */
  selected: string[];
  onToggleMember: (id: string) => void;
  t: (k: string) => string;
  L: (v?: string) => string;
}) {
  const opts = buildWhoOptions(t, L);
  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          value={multi ? '' : who}
          onChange={(e) => onWhoChange(e.target.value)}
          className={`w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 ${
            multi ? 'hidden' : ''
          }`}
        >
          <option value="">{t('updates.selectPlaceholder')}</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onToggleMulti(!multi)}
          className={`shrink-0 text-xs rounded-xl border px-3 py-2 font-medium transition ${
            multi
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border text-muted-foreground hover:text-foreground'
          }`}
          title={t('updates.multiHint')}
        >
          {multi ? `👥 ${t('updates.multiToggle')}：开` : `👥 ${t('updates.multiToggle')}`}
        </button>
      </div>
      {multi && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {members.map((m) => {
            const on = selected.includes(m.id);
            return (
              <button
                type="button"
                key={m.id}
                onClick={() => onToggleMember(m.id)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  on ? '' : 'bg-background text-muted-foreground border-border hover:bg-muted/60'
                }`}
                style={
                  on
                    ? { backgroundColor: m.representativeColor, borderColor: m.representativeColor, color: '#fff' }
                    : undefined
                }
              >
                <span>{m.emoji}</span>
                <span>{L(m.stageName)}</span>
              </button>
            );
          })}
        </div>
      )}
      {multi && selected.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {selected
            .map((id) => L(memberMap[id]?.stageName))
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
    </div>
  );
}

/* 把 ISO 字符串转成 <input type="datetime-local"> 可接受的格式（本地时间） */
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* 把 <input type="datetime-local"> 的本地时间转回 ISO 字符串 */
function fromDatetimeLocal(s: string): string {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/* 12:00 占位符正则（旧版只有日期选择器时保存的 T12:00:00） */
const IS_PLACEHOLDER_12 = /T12:00(|:00)$/;

/* 取展示/排序用的有效时间：publishedAt 若是 12:00 占位符，则回退到用户设置的 date */
function pickTime(publishedAt?: string | null, date?: string): string {
  if (publishedAt && !IS_PLACEHOLDER_12.test(publishedAt)) return publishedAt;
  return date || publishedAt || '';
}

const UpdateCard = memo(function UpdateCard({
  item,
  footerExtra,
  community,
  auto,
  highlight,
  onEdit,
  onRevert,
  myMedia,
  onAddMyMedia,
  onRemoveMyMedia,
}: {
  item: UpdateItem;
  footerExtra?: React.ReactNode;
  community?: boolean;
  auto?: boolean;
  highlight?: boolean;
  onEdit?: (item: UpdateItem, fields: FeedEdit) => void;
  onRevert?: (item: UpdateItem) => void;
  /** 当前访客给这条动态上传的媒体（用于区分「我的 / 他人的」，仅我的可删） */
  myMedia: MediaItem[];
  /** 上传若干媒体后立即持久化（叠加，不覆盖他人） */
  onAddMyMedia: (items: MediaItem[]) => void;
  /** 删除自己上传的某条媒体（按 url） */
  onRemoveMyMedia: (url: string) => void;
}) {
  const { t, lang, L } = useI18n();
  const pm = PLATFORM_META[item.platform];
  const km = KIND_META[item.kind];
  const src = sourceOf(item, t, L);
  /* 多人共创：一条动态可关联多位成员，来源一起展示 */
  const mids =
    item.memberIds && item.memberIds.length
      ? item.memberIds
      : item.memberId
        ? [item.memberId]
        : [];
  const memberSources =
    item.category === 'member'
      ? mids
          .map((id) => memberMap[id])
          .filter(Boolean)
          .map((m) => ({ emoji: m.emoji, name: L(m.stageName), color: m.representativeColor }))
      : [];
  const sources = memberSources.length ? memberSources : [src];
  const isCoop = memberSources.length > 1;
  const isLive = item.kind === 'live';
  const isRealtime = item.id.startsWith('yt-') || item.id.startsWith('bili-');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDesc, setEditDesc] = useState(item.description || '');
  const [editDate, setEditDate] = useState(toDatetimeLocal(item.publishedAt ?? item.date));
  const [editPublishedAt, setEditPublishedAt] = useState(
    item.publishedAt && !IS_PLACEHOLDER_12.test(item.publishedAt) ? toDatetimeLocal(item.publishedAt) : '',
  );
  const [editUrl, setEditUrl] = useState(item.url || '');
  const [editUploading, setEditUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const mineUrls = useMemo(() => new Set(myMedia.map((m) => m.url)), [myMedia]);
  /* 编辑「所属 / 多人共创」成员归属 */
  const origCategory = item.category;
  const origMemberId = item.memberId;
  const [editMulti, setEditMulti] = useState(
    item.category === 'member' && !!(item.memberIds && item.memberIds.length > 1),
  );
  const [editWho, setEditWho] = useState<string>(() => {
    if (item.category === 'member' && item.memberId) return item.memberId;
    return item.category === 'group' ? 'group' : item.category === 'official' ? 'official' : 'other';
  });
  const [editMembers, setEditMembers] = useState<string[]>(
    item.memberIds && item.memberIds.length > 1
      ? item.memberIds
      : item.memberId
        ? [item.memberId]
        : [],
  );
  const [editErr, setEditErr] = useState('');

  const startEdit = () => {
    setEditTitle(item.title);
    setEditDesc(item.description || '');
    setEditDate(toDatetimeLocal(item.date));
    setEditPublishedAt(item.publishedAt && !IS_PLACEHOLDER_12.test(item.publishedAt) ? toDatetimeLocal(item.publishedAt) : '');
    setEditUrl(item.url || '');
    setEditMulti(item.category === 'member' && !!(item.memberIds && item.memberIds.length > 1));
    setEditWho(
      item.category === 'member' && item.memberId
        ? item.memberId
        : item.category === 'group'
          ? 'group'
          : item.category === 'official'
            ? 'official'
            : 'other',
    );
    setEditMembers(
      item.memberIds && item.memberIds.length > 1
        ? item.memberIds
        : item.memberId
          ? [item.memberId]
          : [],
    );
    setEditErr('');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!onEdit) return;
    setSaving(true);
    const dateIso = editDate ? `${editDate}:00` : item.date;
    // 只保留用户真正填写的「原帖发布时间」；12:00 占位符一律丢弃，避免覆盖主时间
    const publishedAtIso =
      editPublishedAt && !IS_PLACEHOLDER_12.test(editPublishedAt)
        ? fromDatetimeLocal(editPublishedAt)
        : item.publishedAt && !IS_PLACEHOLDER_12.test(item.publishedAt)
          ? item.publishedAt
          : undefined;
    /* 计算「所属 / 多人共创」成员归属 */
    let category: UpdateCategory;
    let memberId: string | null;
    let memberIds: string[] | null;
    if (editMulti) {
      if (editMembers.length === 0) {
        setEditErr(t('updates.needMembers'));
        setSaving(false);
        return;
      }
      category = 'member';
      memberId = editMembers[0];
      memberIds = editMembers;
    } else if (!editWho) {
      // 未选所属：沿用原归属，避免误清空
      category = origCategory;
      memberId = origMemberId ?? null;
      memberIds = null;
    } else {
      const opt = buildWhoOptions(t, L).find((o) => o.value === editWho);
      if (!opt) {
        category = origCategory;
        memberId = origMemberId ?? null;
      } else {
        category = opt.category;
        memberId = opt.memberId;
      }
      memberIds = null;
    }
    try {
      await onEdit(item, {
        title: editTitle.trim() || item.title,
        description: editDesc.trim() || undefined,
        date: dateIso,
        publishedAt: publishedAtIso || undefined,
        // 链接：用户留空则回退原链接（防止误清空导致卡片不可跳转）
        url: editUrl.trim() || item.url,
        // 注意：媒体不再走文字编辑覆盖层，而是由独立的「媒体叠加层」按访客累积
        category,
        memberId,
        memberIds,
      });
      setEditing(false);
      setEditErr('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <article
      className={`relative flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl bg-background border shadow-sm hover:shadow-md transition group ${
        highlight ? 'ring-2 ring-primary/50 border-primary/40 animate-pulse-once' : 'border-border'
      }`}
      style={{ borderLeft: `4px solid ${pm.color}` }}
    >
      {/* 平台色条 / 直播脉冲 */}
      <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          {isLive && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title={t('updates.liveNow')} />
          )}
        <span
          className="text-lg leading-none"
          style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.1))' }}
        >
          {pm.icon}
        </span>
      </div>

      {/* 主体 */}
      <div className="flex-1 min-w-0">
        {/* 顶部标签行：平台 + 类型 + 来源 + 实时/自动/补充标识 */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white shadow-sm"
            style={{ backgroundColor: pm.color }}
          >
            {pm.icon} {L(pm.label)}
          </span>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${km.cls}`}>
            {km.icon} {L(km.label)}
          </span>
          {sources.map((s, i) => (
            <span
              key={i}
              className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
              style={{ borderColor: `${s.color}40`, color: s.color, backgroundColor: `${s.color}10` }}
              title={t('updates.sourceTitle')}
            >
              {s.emoji} {s.name}
            </span>
          ))}
          {isCoop && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#7C3AED]/12 text-[#7C3AED]">
              👥 {t('updates.coopLabel')}
            </span>
          )}
          {isRealtime && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600">
              {t('updates.realtimeBadge')}
            </span>
          )}
          {auto && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#2D6CDF]/12 text-[#1E4FA8]">
              {t('updates.autoSync')}
            </span>
          )}
          {community && !auto && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#F7CAC9]/25 text-[#C2410C]">
              {t('updates.caratsupplement')}
            </span>
          )}
        </div>

        {editing ? (
          /* 编辑模式 */
          <div className="space-y-2 animate-fade-in">
            <div>
              <label className="text-[11px] text-muted-foreground">{t('updates.editTitle')}</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t('updates.editUrl')}</label>
              <input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://"
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t('updates.fieldBelong')}</label>
              <MemberPicker
                who={editWho}
                multi={editMulti}
                onWhoChange={setEditWho}
                onToggleMulti={setEditMulti}
                selected={editMembers}
                onToggleMember={(id) =>
                  setEditMembers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
                }
                t={t}
                L={L}
              />
              {editErr && <p className="text-[11px] text-[#E8555E] mt-1">{editErr}</p>}
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t('updates.editNote')}</label>
              <input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">{t('updates.editDate')}</label>
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">{t('updates.editOrigDate')}</label>
                <input
                  type="datetime-local"
                  value={editPublishedAt}
                  onChange={(e) => setEditPublishedAt(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground">{t('updates.editMedia')}</label>
              <MediaUploader
                media={item.media || []}
                mineUrls={mineUrls}
                onAdd={onAddMyMedia}
                onRemoveMine={onRemoveMyMedia}
                uploading={editUploading}
                setUploading={setEditUploading}
                t={t}
              />
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{t('updates.mediaShared')}</p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="text-xs rounded-lg bg-primary text-primary-foreground px-3 py-1.5 font-medium hover:opacity-90 transition disabled:opacity-60"
              >
                {saving ? t('updates.saving') : t('updates.save')}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="text-xs rounded-lg border border-border bg-background px-3 py-1.5 font-medium hover:bg-muted/50 transition disabled:opacity-60"
              >
                {t('updates.cancel')}
              </button>
              {onRevert && (
                <button
                  onClick={() => {
                    setEditing(false);
                    onRevert(item);
                  }}
                  disabled={saving}
                  className="text-xs rounded-lg border border-border bg-background px-3 py-1.5 font-medium text-muted-foreground hover:bg-muted/50 transition disabled:opacity-60"
                >
                  {t('updates.revertEdit')}
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 标题：Instagram 平台参考截图，更突出成员 + 平台 */}
            <h3
              className={`font-bold leading-snug group-hover:text-primary transition line-clamp-2 ${
                item.platform === 'instagram' ? 'text-base' : 'text-[15px]'
              }`}
            >
              {L(item.title)}
            </h3>

            {/* 描述 */}
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                {L(item.description)}
              </p>
            )}

            {/* 图片 / 视频展示 */}
            {item.media && item.media.length > 0 && (
              <ImageCarousel media={item.media} t={t} />
            )}

            {/* 底部：时间 + 链接 */}
            <div className="flex items-center justify-between mt-3 gap-3">
              <span className="text-xs text-muted-foreground shrink-0">
                {/* 对克拉补充，显示笔记原发布时间（publishedAt ?? date），不再显示上传时间 */}
                {fmtDateTime(lang, new Date(pickTime(item.publishedAt, item.date)))}
                <span className="ml-2 text-[11px] opacity-70">{fmtRelative(lang, new Date(pickTime(item.publishedAt, item.date)))}</span>
              </span>
              <div className="flex items-center justify-end shrink-0">
                {onEdit && (
                  <button
                    onClick={startEdit}
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline shrink-0"
                  >
                    {t('updates.edit')}
                  </button>
                )}
                {footerExtra}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-white rounded-full px-3.5 py-1.5 shadow-sm hover:opacity-90 transition shrink-0 ml-3"
                    style={{ backgroundColor: pm.color }}
                  >
                    {t('updates.view')}
                    <span aria-hidden>→</span>
                  </a>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
});

/* 媒体上传组件：支持选择图片 / 视频文件，上传到 Supabase，显示缩略图与删除 */
function MediaUploader({
  media,
  mineUrls,
  onAdd,
  onRemoveMine,
  uploading,
  setUploading,
  t,
}: {
  media: MediaItem[];
  /** 当前访客自己的媒体 url 集合，仅这些可删除 */
  mineUrls?: Set<string>;
  /** 上传完成（新增若干媒体），由父级负责叠加持久化 */
  onAdd?: (items: MediaItem[]) => void;
  /** 删除自己上传的某条媒体（按 url） */
  onRemoveMine?: (url: string) => void;
  uploading: boolean;
  setUploading: (v: boolean) => void;
  t: (k: string) => string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const added: MediaItem[] = [];
    for (const file of Array.from(files)) {
      try {
        const item = await uploadMediaFile(file);
        added.push(item);
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        window.alert(`${t('updates.mediaUploadFail')}: ${file.name}${detail ? '\n' + detail : ''}`);
      }
    }
    setUploading(false);
    if (added.length && onAdd) onAdd(added);
  };
  return (
    <div className="mt-1">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFile(e.target.files)}
      />
      {media.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 mb-2">
          {media.map((m, idx) => {
            const mine = mineUrls?.has(m.url);
            return (
              <div key={`${m.url}-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted group">
                {m.type === 'video' ? (
                  <video src={m.url} className="w-full h-full object-cover" preload="metadata" />
                ) : (
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                )}
                {mine && onRemoveMine && (
                  <button
                    type="button"
                    onClick={() => onRemoveMine(m.url)}
                    className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                    title={t('updates.mediaRemove')}
                  >
                    ×
                  </button>
                )}
                {m.type === 'video' && (
                  <span className="absolute bottom-1 left-1 text-[10px] px-1 rounded bg-black/60 text-white">▶</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 text-xs rounded-lg border border-border bg-background px-3 py-1.5 font-medium hover:bg-muted/50 transition disabled:opacity-60"
      >
        {uploading ? t('updates.mediaUploading') : t('updates.mediaUploadBtn')}
      </button>
      <span className="text-[11px] text-muted-foreground ml-2">{t('updates.mediaHint')}</span>
    </div>
  );
}

/* 媒体轮播：小红书/Instagram 风格，单张展示、左右滑动、计数器、圆点 */
function ImageCarousel({ media, t }: { media: MediaItem[]; t: (k: string) => string }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef({ startX: 0, currentX: 0, dragging: false });
  const count = media.length;
  if (!count) return null;

  const go = (n: number) => setIdx(() => Math.max(0, Math.min(count - 1, n)));
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { startX: e.clientX, currentX: e.clientX, dragging: true };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.dragging) return;
    drag.current.currentX = e.clientX;
  };
  const onPointerUp = () => {
    if (!drag.current.dragging) return;
    const dx = drag.current.startX - drag.current.currentX;
    if (dx > 40) next();
    else if (dx < -40) prev();
    drag.current.dragging = false;
  };

  const renderMedia = (m: MediaItem, className: string) =>
    m.type === 'video' ? (
      <video src={m.url} className={className} preload="metadata" playsInline muted />
    ) : (
      <img src={m.url} alt="" className={className} loading="lazy" />
    );

  return (
    <>
      <div
        ref={wrap}
        className="relative mt-3 w-full max-w-md mx-auto rounded-2xl overflow-hidden border border-border bg-muted select-none group"
        style={{ aspectRatio: '4 / 5' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div
          className="flex h-full transition-transform duration-300 ease-out touch-pan-y"
          style={{ transform: `translateX(-${idx * 100}%)` }}
        >
          {media.map((m, i) => (
            <button
              key={`${m.url}-${i}`}
              type="button"
              onClick={() => setLightbox(true)}
              className="relative w-full h-full shrink-0 cursor-zoom-in"
            >
              {renderMedia(m, 'w-full h-full object-cover')}
              {m.type === 'video' && (
                <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="w-12 h-12 flex items-center justify-center rounded-full bg-black/45 text-white text-xl backdrop-blur-sm">▶</span>
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 计数器 */}
        {count > 1 && (
          <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-black/50 text-white text-[11px] font-semibold tabular-nums backdrop-blur-sm">
            {idx + 1}/{count}
          </div>
        )}

        {/* 左右箭头 */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 backdrop-blur-sm"
              aria-label={t('updates.prev')}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 backdrop-blur-sm"
              aria-label={t('updates.next')}
            >
              ›
            </button>
          </>
        )}

        {/* 底部圆点 */}
        {count > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
            {media.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); go(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === idx ? 'bg-white w-3' : 'bg-white/60 hover:bg-white/80'
                }`}
                aria-label={`${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 灯箱：点击当前图后全屏查看，仍可切上一张/下一张 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            onClick={() => setLightbox(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white text-2xl z-10"
            aria-label={t('updates.close')}
          >
            ×
          </button>

          <div className="relative w-full max-w-3xl max-h-[80vh] flex items-center justify-center">
            {count > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-0 sm:-left-10 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                aria-label={t('updates.prev')}
              >
                ‹
              </button>
            )}

            <div
              className="w-full h-full transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${idx * 100}%)` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-full">
                {media.map((m, i) => (
                  <div key={`lb-${m.url}-${i}`} className="w-full shrink-0 flex items-center justify-center" style={{ maxHeight: '80vh' }}>
                    {m.type === 'video' ? (
                      <video src={m.url} controls className="max-w-full max-h-[80vh] rounded-lg" autoPlay />
                    ) : (
                      <img src={m.url} alt="" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {count > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-0 sm:-right-10 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition"
                aria-label={t('updates.next')}
              >
                ›
              </button>
            )}
          </div>

          {count > 1 && (
            <div className="mt-4 flex items-center gap-2">
              {media.map((_, i) => (
                <button
                  key={`lb-dot-${i}`}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); go(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === idx ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
