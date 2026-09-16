import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { members } from '@/data';
import { isCloudEnabled } from '@/config/cloud';
import SectionTitle from './SectionTitle';
import {
  listCloudPhotos,
  uploadCloudPhoto,
  deleteCloudPhoto,
  type CloudPhoto,
} from '@/lib/caratCloud';
import {
  compressImage,
  loadLocal,
  saveLocal,
  loadMine,
  saveMine,
  localStorageSize,
  MAX_IMAGES,
} from '@/components/caratsay/storage';
import MemoryBook from '@/components/caratsay/MemoryBook';
import LazyImage from '@/components/caratsay/LazyImage';
import { useBgm } from '@/components/caratsay/bgm';
import BgmPlayer from '@/components/caratsay/BgmPlayer';
import { type Photo, type LocalImage } from '@/components/caratsay/types';
import { useI18n } from '@/i18n/LanguageContext';
import { fmtDateTime } from '@/i18n/format';

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

/** dataURL → Blob（用于把本地旧图同步到云端） */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

type ViewMode = 'grid' | 'book' | 'slideshow';

export default function CaratSaySection() {
  const cloudOn = isCloudEnabled();
  const { lang, t } = useI18n();

  const [activeTab, setActiveTab] = useState('group');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const bgm = useBgm(viewMode);

  const [cloudPhotos, setCloudPhotos] = useState<CloudPhoto[]>([]);
  const [localImages, setLocalImages] = useState<LocalImage[]>([]);
  const [mine, setMine] = useState<Set<string>>(() => loadMine());

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingCloud, setLoadingCloud] = useState(cloudOn);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- 初始加载 ---------- */
  useEffect(() => {
    setLocalImages(loadLocal());
  }, []);

  useEffect(() => {
    if (!cloudOn) return;
    const ac = new AbortController();
    setLoadingCloud(true);
    setCloudError(null);
    listCloudPhotos(ac.signal)
      .then((list) => setCloudPhotos(list))
      .catch((e: unknown) => setCloudError(e instanceof Error ? e.message : t('caratsay.readFail')))
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

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m.stageName])),
    []
  );
  const labelOf = useCallback(
    (section: string) => (section === 'group' ? 'SEVENTEEN' : memberMap[section] || 'SEVENTEEN'),
    [memberMap]
  );

  const tabs = useMemo(
    () => [
      { id: 'group', label: 'SEVENTEEN', emoji: '💎' },
      ...members.map((m) => ({ id: m.id, label: m.stageName, emoji: m.emoji })),
    ],
    []
  );

  /* ---------- 合并云端 + 本地（去重后按时间倒序） ---------- */
  const merged = useMemo<Photo[]>(() => {
    const cloud: Photo[] = cloudPhotos.map((cp) => ({
      id: cp.id,
      section: cp.section,
      src: cp.url,
      timestamp: cp.timestamp,
      origin: 'cloud',
      mine: mine.has(cp.id),
    }));
    const local: Photo[] = localImages.map((li) => ({
      id: li.id,
      section: li.section,
      src: li.data,
      timestamp: li.timestamp,
      origin: 'local',
      mine: mine.has(li.id),
    }));
    return [...cloud, ...local].sort((a, b) => b.timestamp - a.timestamp);
  }, [cloudPhotos, localImages, mine]);

  const filtered = useMemo(
    () => merged.filter((p) => p.section === activeTab),
    [merged, activeTab]
  );

  /* ---------- 「我的」标记 ---------- */
  const addToMine = useCallback((id: string) => {
    setMine((prev) => {
      if (prev.has(id)) return prev;
      const n = new Set(prev);
      n.add(id);
      saveMine(n);
      return n;
    });
  }, []);
  const removeFromMine = useCallback((id: string) => {
    setMine((prev) => {
      if (!prev.has(id)) return prev;
      const n = new Set(prev);
      n.delete(id);
      saveMine(n);
      return n;
    });
  }, []);

  /* ---------- 上传 ---------- */
  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (!file.type.startsWith('image/')) {
        showToast(t('caratsay.errImageType'), 'err');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast(t('caratsay.errImageSize'), 'err');
        return;
      }

      setUploading(true);
      try {
        const { data, blob } = await compressImage(file);
        if (cloudOn) {
          try {
            const cp = await uploadCloudPhoto(activeTab, blob);
            setCloudPhotos((prev) => [cp, ...prev]);
            addToMine(cp.id);
            showToast(t('caratsay.uploadedCloud'));
          } catch {
            // 云端失败 → 兜底存本地
            const li: LocalImage = { id: genId(), section: activeTab, data, timestamp: Date.now() };
            const updated = [li, ...localImages].slice(0, MAX_IMAGES);
            const r = saveLocal(updated);
            if (r.ok) setLocalImages(updated);
            addToMine(li.id);
            showToast(r.ok ? t('caratsay.cloudFailLocal') : t('caratsay.allFail'), 'err');
          }
        } else {
          const li: LocalImage = { id: genId(), section: activeTab, data, timestamp: Date.now() };
          const updated = [li, ...localImages].slice(0, MAX_IMAGES);
          const r = saveLocal(updated);
          if (r.ok) {
            setLocalImages(updated);
            addToMine(li.id);
            showToast(t('caratsay.savedLocal'));
          } else {
            showToast(r.error || t('caratsay.saveFail'), 'err');
          }
        }
      } catch {
        showToast(t('caratsay.processFail'), 'err');
      } finally {
        setUploading(false);
      }
    },
    [activeTab, cloudOn, addToMine, showToast, localImages]
  );

  /* ---------- 删除（仅自己上传的） ---------- */
  const handleDelete = useCallback(
    (photo: Photo) => {
      if (!photo.mine) {
        showToast(t('caratsay.onlyOwn'), 'err');
        return;
      }
      if (photo.origin === 'cloud') {
        deleteCloudPhoto(photo.id)
          .then(() => {
            setCloudPhotos((prev) => prev.filter((c) => c.id !== photo.id));
            showToast(t('caratsay.deletedCloud'));
          })
          .catch(() => showToast(t('caratsay.delCloudFail'), 'err'));
      } else {
        setLocalImages((prev) => {
          const updated = prev.filter((i) => i.id !== photo.id);
          saveLocal(updated);
          return updated;
        });
      }
      removeFromMine(photo.id);
      if (selectedIdx !== null) setSelectedIdx(null);
    },
    [removeFromMine, selectedIdx, showToast]
  );

  /* ---------- 把本地旧图同步到云端 ---------- */
  const handleSync = useCallback(async () => {
    if (!cloudOn) {
      showToast(t('caratsay.noCloudConfig'), 'err');
      return;
    }
    if (localImages.length === 0) {
      showToast(t('caratsay.noSync'));
      return;
    }
    setSyncing(true);
    let ok = 0;
    const failedIds: string[] = [];
    for (const li of localImages) {
      try {
        const blob = await dataUrlToBlob(li.data);
        const cp = await uploadCloudPhoto(li.section, blob);
        setLocalImages((prev) => {
          const updated = prev.filter((i) => i.id !== li.id);
          saveLocal(updated);
          return updated;
        });
        addToMine(cp.id);
        ok += 1;
      } catch {
        failedIds.push(li.id);
      }
    }
    setSyncing(false);
    showToast(
      t('caratsay.syncedOk', { ok }) +
        (failedIds.length ? t('caratsay.syncedFail', { fail: failedIds.length }) : ''),
      failedIds.length ? 'err' : 'ok'
    );
  }, [cloudOn, localImages, addToMine, showToast, t]);

  /* ---------- 大图查看器键盘导航 ---------- */
  const showPrev = useCallback(() => {
    setSelectedIdx((prev) =>
      prev === null ? null : prev > 0 ? prev - 1 : filtered.length - 1
    );
  }, [filtered.length]);

  const showNext = useCallback(() => {
    setSelectedIdx((prev) =>
      prev === null ? null : prev < filtered.length - 1 ? prev + 1 : 0
    );
  }, [filtered.length]);

  useEffect(() => {
    if (selectedIdx === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedIdx(null);
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [selectedIdx, showPrev, showNext]);

  const selectedImage = selectedIdx !== null ? filtered[selectedIdx] : null;

  const viewTabs: { id: ViewMode; label: string; icon: string }[] = [
    { id: 'grid', label: t('caratsay.view.grid'), icon: '▦' },
    { id: 'book', label: t('caratsay.view.book'), icon: '📖' },
    { id: 'slideshow', label: t('caratsay.view.slideshow'), icon: '▶' },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-pink-50/50 to-white/50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-[#C77DFF] tracking-[0.25em] mb-2">CARAT SAY</p>
          <SectionTitle tKey="section.caratsay" />
          <p className="text-muted-foreground">
            {cloudOn
              ? t('caratsay.descCloud')
              : t('caratsay.descLocal')}
          </p>
        </div>

        {/* 云端状态条 */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6 text-xs">
          {cloudOn ? (
            <span className="px-3 py-1.5 rounded-full bg-[#E08E9D]/15 text-[#9c5563] font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              🌐 {t('caratsay.cloudConnected', { n: cloudPhotos.length })}
              {loadingCloud && `（${t('common.loading')}）`}
              {cloudError && ` · ⚠️ ${cloudError}`}
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              {t('caratsay.localMode')}
            </span>
          )}
          {cloudOn && localImages.length > 0 && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-3 py-1.5 rounded-full bg-[#F7CAC9] text-[#5a4a4a] font-medium hover:shadow-sm transition-all disabled:opacity-60"
            >
              {syncing ? t('caratsay.syncing') : t('caratsay.syncBtn', { n: localImages.length })}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedIdx(null);
              }}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#F7CAC9] text-[#5a4a4a] shadow-sm'
                  : 'bg-muted text-foreground/70 hover:bg-muted/80'
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* 视图模式 + 上传 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            {/* 背景音乐播放器（曲目列表 / 进度 / 音量 / 上传） */}
            <BgmPlayer {...bgm} />

            <div className="flex items-center gap-1 p-1 rounded-full bg-muted/70">
            {viewTabs.map((vt) => (
              <button
                key={vt.id}
                onClick={() => setViewMode(vt.id)}
                className={`touch-manipulation flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  viewMode === vt.id
                    ? 'bg-white text-[#9c5563] shadow-sm'
                    : 'text-foreground/60 hover:text-foreground'
                }`}
              >
                <span>{vt.icon}</span>
                {vt.label}
              </button>
            ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="touch-manipulation px-5 py-2.5 rounded-full bg-gradient-to-r from-[#F7CAC9] to-[#E08E9D] text-white font-bold text-sm shadow-md hover:shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-wait disabled:hover:scale-100"
            >
              {uploading ? t('caratsay.processing') : t('caratsay.upload')}
            </button>
          </div>
        </div>

        {/* Storage info */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs text-muted-foreground">
          {cloudOn ? (
            <span>
              {t('caratsay.storageCloud', { n: cloudPhotos.length, m: localImages.length, size: localStorageSize() })}
            </span>
          ) : (
            <span>{t('caratsay.storageLocal', { n: localImages.length, size: localStorageSize() })}</span>
          )}
        </div>

        {/* 内容区 */}
        {filtered.length > 0 ? (
          viewMode === 'grid' ? (
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-sm text-[#9c5563] font-semibold flex items-center gap-1.5">
                  {labelOf(activeTab)} · {t('caratsay.count', { n: filtered.length })}
                </p>
                <p className="text-xs text-muted-foreground">{t('common.viewLarge')}</p>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 sm:gap-2">
                {filtered.map((photo, idx) => (
                  <div
                    key={photo.id}
                    className="group relative aspect-square overflow-hidden rounded-md sm:rounded-lg bg-muted/30 cursor-pointer ring-1 ring-black/5 hover:ring-2 hover:ring-[#E08E9D]/70 transition-transform transition-shadow duration-200 ease-out will-change-transform active:scale-[0.96] active:ring-[#E08E9D] touch-manipulation"
                    onClick={() => setSelectedIdx(idx)}
                  >
                    <div className="w-full h-full transition-transform duration-300 ease-out group-hover:scale-105 will-change-transform">
                      <LazyImage src={photo.src} alt={labelOf(photo.section)} />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <span className="text-[10px] text-white font-medium truncate drop-shadow">
                        {labelOf(photo.section)}
                      </span>
                    </div>
                    {photo.origin === 'local' && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                        {t('common.localOnly')}
                      </span>
                    )}
                    {photo.mine && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(photo);
                        }}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs hover:bg-red-500/80"
                        aria-label={t('common.delete')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : viewMode === 'book' ? (
            <MemoryBook
              photos={filtered}
              labelOf={labelOf}
              onOpen={(p) => setSelectedIdx(filtered.findIndex((f) => f.id === p.id))}
            />
          ) : (
            <SlideshowView photos={filtered} labelOf={labelOf} onOpen={(p) => setSelectedIdx(filtered.findIndex((f) => f.id === p.id))} />
          )
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-5xl mb-4">📸</p>
            <p className="text-sm">
              {loadingCloud ? t('caratsay.loadingCloud') : t('caratsay.empty')}
            </p>
          </div>
        )}

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

        {/* 大图查看器 */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelectedIdx(null)}
          >
            {filtered.length > 1 && (
              <button
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30 transition-colors z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  showPrev();
                }}
                aria-label={t('common.prev')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
            )}

            <img
              key={selectedImage.id}
              src={selectedImage.src}
              alt={t('caratsay.bigAlt')}
              className="max-w-[92vw] max-h-[88vh] rounded-xl shadow-2xl object-contain animate-fade-in"
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />

            {filtered.length > 1 && (
              <button
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30 transition-colors z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  showNext();
                }}
                aria-label={t('common.next')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}

            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors"
              onClick={() => setSelectedIdx(null)}
              aria-label={t('common.close')}
            >
              ✕
            </button>

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/15 text-white text-xs font-medium">
              <span>{labelOf(selectedImage.section)}</span>
              <span className="opacity-60">·</span>
              <span>{fmtDateTime(lang, new Date(selectedImage.timestamp))}</span>
              {selectedImage.origin === 'local' && <span className="text-amber-300">· {t('common.localOnly')}</span>}
              {filtered.length > 1 && <span className="opacity-60">· {selectedIdx! + 1}/{filtered.length}</span>}
            </div>

            {selectedImage.mine && (
              <button
                onClick={() => handleDelete(selectedImage)}
                className="absolute bottom-5 right-5 px-3 py-1.5 rounded-full bg-red-500/80 text-white text-xs font-medium hover:bg-red-500 transition-colors"
              >
                {t('common.delete')}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- 放映模式 · Apple「回忆」风格 ---------- */
function SlideshowView({
  photos,
  labelOf,
  onOpen,
}: {
  photos: Photo[];
  labelOf: (section: string) => string;
  onOpen: (p: Photo) => void;
}) {
  const { t, lang } = useI18n();
  const KB = 5200; // 每张停留毫秒（与 Ken Burns 时长一致）
  const [idx, setIdx] = useState(0);
  const [outgoing, setOutgoing] = useState<number | null>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    setIdx(0);
    setOutgoing(null);
    setPlaying(true);
  }, [photos.length]);

  const advance = useCallback(
    (dir: 1 | -1 = 1) => {
      setIdx((prev) => {
        const next = (prev + dir + photos.length) % photos.length;
        setOutgoing(prev);
        return next;
      });
    },
    [photos.length]
  );

  useEffect(() => {
    if (!playing || photos.length <= 1) return;
    const t = setInterval(() => advance(1), KB);
    return () => clearInterval(t);
  }, [playing, photos.length, advance]);

  // 旧照在交叉淡入完成后移除
  useEffect(() => {
    if (outgoing === null) return;
    const t = setTimeout(() => setOutgoing(null), 1100);
    return () => clearTimeout(t);
  }, [outgoing]);

  if (photos.length === 0) return null;
  const cur = photos[idx];

  return (
    <div className="relative mx-auto max-w-3xl">
      {/* 漂浮光斑，营造回忆的氛围 */}
      <span className="svt-bokeh block absolute -top-6 -left-6 w-24 h-24 bg-[#F7CAC9] z-0" style={{ animationDelay: '0s' }} />
      <span className="svt-bokeh block absolute top-10 -right-8 w-28 h-28 bg-[#92A8D1] z-0" style={{ animationDelay: '-3s' }} />
      <span className="svt-bokeh block absolute -bottom-8 left-10 w-20 h-20 bg-[#E08E9D] z-0" style={{ animationDelay: '-6s' }} />

      <div className="relative aspect-[4/3] sm:aspect-[16/10] rounded-3xl overflow-hidden bg-black shadow-2xl svt-glow">
        {/* 点击查看大图 */}
        <button className="absolute inset-0 w-full h-full z-30" onClick={() => onOpen(cur)} aria-label={t('common.viewLarge')} />

        {/* 图层：旧照垫底，新照淡入覆盖（交叉淡入） */}
        <div className="absolute inset-0 overflow-hidden">
          {outgoing !== null && outgoing !== idx && (
            <div className="absolute inset-0 z-0">
              <LazyImage
                src={photos[outgoing].src}
                alt={labelOf(photos[outgoing].section)}
                eager
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div key={idx} className="absolute inset-0 z-10 animate-fade-in">
            <div
              className={`w-full h-full ${idx % 2 === 0 ? 'ken-burns-a' : 'ken-burns-b'}`}
              style={{ ['--kb-dur' as string]: `${KB}ms` } as React.CSSProperties}
            >
              <LazyImage src={cur.src} alt={labelOf(cur.section)} eager className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        {/* 暗角 */}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.6)] z-20" />

        {/* 柔光色调，让画面更和谐 */}
        <div
          className="pointer-events-none absolute inset-0 z-[15] mix-blend-soft-light opacity-60"
          style={{ background: 'radial-gradient(120% 90% at 30% 20%, rgba(247,202,201,0.55), transparent 55%), radial-gradient(120% 90% at 80% 90%, rgba(146,168,209,0.5), transparent 55%)' }}
        />

        {/* 回忆标题卡（每次切片升起、停留、淡出） */}
        <div
          key={`title-${idx}`}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center px-6 pointer-events-none"
        >
          <p className="memory-title-rise text-white font-black text-3xl sm:text-5xl drop-shadow-[0_2px_14px_rgba(0,0,0,0.55)]">
            {labelOf(cur.section)}
          </p>
          <p
            className="memory-title-rise text-white/85 text-sm sm:text-base mt-2 tracking-[0.25em]"
            style={{ animationDelay: '0.15s' }}
          >
            {fmtDateTime(lang, new Date(cur.timestamp))}
          </p>
        </div>

        {/* 顶部进度条 */}
        <div className="absolute top-0 left-0 right-0 h-1 z-30 bg-white/15">
          <div
            key={idx}
            className="h-full bg-white/80"
            style={{ animation: `memBar ${KB}ms linear forwards` }}
          />
        </div>

        {/* 底部信息条 */}
        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 flex items-center justify-between text-white text-xs bg-gradient-to-t from-black/70 to-transparent z-30">
          <span className="font-medium drop-shadow">
            {labelOf(cur.section)} · {fmtDateTime(lang, new Date(cur.timestamp))}
            {cur.origin === 'local' && <span className="text-amber-300 ml-1">· {t('common.localOnly')}</span>}
          </span>
          <span className="opacity-85 tabular-nums">
            {idx + 1} / {photos.length}
          </span>
        </div>

        {/* 控制 */}
        {photos.length > 1 && (
          <>
            <button
              onClick={() => advance(-1)}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30 transition-colors z-30"
              aria-label={t('common.prev')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              onClick={() => advance(1)}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30 transition-colors z-30"
              aria-label={t('common.next')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <button
              onClick={() => setPlaying((v) => !v)}
              className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/30 transition-colors z-30"
              aria-label={playing ? t('common.pause') : t('common.play')}
            >
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
