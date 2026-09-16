import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/LanguageContext';
import {
  deleteBgmFile,
  makeTrack,
  canDeleteTrack,
  uploadBgmFile,
  type BgmTrack,
  type BgmScene,
} from '@/lib/bgmCloud';
import type { RepeatMode } from '@/components/caratsay/bgm';

export interface BgmPlayerProps {
  tracks: BgmTrack[];
  loadingTracks: boolean;
  usingCloud: boolean;
  enabled: boolean;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  selectTrack: (i: number) => void;
  addTracks: (t: BgmTrack[]) => Promise<void>;
  removeTrack: (id: string) => Promise<BgmTrack | undefined>;
  isPlaying: boolean;
  current: BgmTrack | null;
  currentIndex: number;
  duration: number;
  currentTime: number;
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
  repeat: RepeatMode;
  cycleRepeat: () => void;
  shuffle: boolean;
  toggleShuffle: () => void;
  blocked: boolean;
  error: string | null;
  usingPad: boolean;
}

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/* ── 小图标 ───────────────────────────────────────── */
const IconPlay = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const IconPause = ({ s = 18 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);
const IconPrev = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
  </svg>
);
const IconNext = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
  </svg>
);
const IconMusic = ({ s = 16 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);
const IconList = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
const IconVolume = ({ s = 14, off = false }: { s?: number; off?: boolean }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 5L6 9H2v6h4l5 4z" />
    {off ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />}
  </svg>
);
const IconRepeat = ({ s = 14, one = false }: { s?: number; one?: boolean }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11v-1a4 4 0 014-4h14M7 22l-4-4 4-4" />
    <path d="M21 13v1a4 4 0 01-4 4H3" />
    {one && <text x="12" y="15" fontSize="9" fill="currentColor" stroke="none" textAnchor="middle">1</text>}
  </svg>
);
const IconShuffle = ({ s = 14 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
);
const IconTrash = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);
const IconPlus = ({ s = 13 }: { s?: number }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const SCENES: Array<{ id: BgmScene | 'none'; key: string }> = [
  { id: 'none', key: 'caratsay.bgm.sceneNone' },
  { id: 'grid', key: 'caratsay.view.grid' },
  { id: 'book', key: 'caratsay.view.book' },
  { id: 'slideshow', key: 'caratsay.view.slideshow' },
];

export default function BgmPlayer(props: BgmPlayerProps) {
  const { t } = useI18n();
  const {
    tracks, loadingTracks, usingCloud, enabled, toggle, play, pause, next, prev, seek,
    selectTrack, addTracks, removeTrack, isPlaying, current, currentIndex, duration,
    currentTime, volume, setVolume, muted, toggleMute, repeat, cycleRepeat, shuffle,
    toggleShuffle, blocked, error, usingPad,
  } = props;

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkScene, setLinkScene] = useState<BgmScene | 'none'>('none');
  const [notice, setNotice] = useState<{ msg: string; bad?: boolean } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* 点击面板外部关闭 */
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const flash = useCallback((msg: string, bad = false) => {
    setNotice({ msg, bad });
    window.setTimeout(() => setNotice(null), 2600);
  }, []);

  /* ---------- 上传本地音频 ---------- */
  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    const added: BgmTrack[] = [];
    for (const file of Array.from(files)) {
      try {
        const { url } = await uploadBgmFile(file);
        const baseName = file.name.replace(/\.[^.]+$/, '');
        added.push(makeTrack({ title: baseName, url, source: 'cloud' }));
      } catch (e) {
        flash(`${t('caratsay.bgm.uploadFail')}: ${file.name}`, true);
      }
    }
    setBusy(false);
    if (added.length) {
      try {
        await addTracks(added);
        flash(t('caratsay.bgm.added', { n: added.length }));
      } catch {
        flash(t('caratsay.bgm.saveFail'), true);
      }
    }
  };

  /* ---------- 添加外链 ---------- */
  const submitLink = async () => {
    const url = linkUrl.trim();
    if (!linkTitle.trim()) return flash(t('caratsay.bgm.needName'), true);
    if (!/^https?:\/\//i.test(url)) return flash(t('caratsay.bgm.needUrl'), true);
    const track = makeTrack({
      title: linkTitle.trim(),
      url,
      source: 'link',
      scene: linkScene === 'none' ? undefined : linkScene,
    });
    try {
      await addTracks([track]);
      setLinkTitle('');
      setLinkUrl('');
      setLinkScene('none');
      setShowAdd(false);
      flash(t('caratsay.bgm.added', { n: 1 }));
    } catch {
      flash(t('caratsay.bgm.saveFail'), true);
    }
  };

  /* ---------- 移除曲目 ---------- */
  const handleRemove = async (track: BgmTrack) => {
    if (!window.confirm(t('caratsay.bgm.confirmRemove', { name: track.title }))) return;
    const removed = await removeTrack(track.id);
    if (removed) void deleteBgmFile(removed.url);
  };

  const repeatLabel =
    repeat === 'one' ? t('caratsay.bgm.repeatOne') : repeat === 'all' ? t('caratsay.bgm.repeatAll') : t('caratsay.bgm.repeatOff');

  return (
    <div ref={wrapRef} className="relative">
      {/* ── 胶囊按钮组 ── */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggle}
          className={`touch-manipulation group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all ${
            enabled
              ? 'bg-gradient-to-r from-[#F7CAC9] to-[#E08E9D] text-white shadow-sm'
              : 'bg-muted text-foreground/60 hover:text-foreground'
          }`}
          aria-label={t('caratsay.bgmAria')}
          title={t('caratsay.bgmTitle')}
        >
          <span className={enabled && isPlaying ? 'bgm-eq' : ''}>
            <IconMusic />
          </span>
          {enabled ? t('caratsay.bgmOn') : t('caratsay.bgmOff')}
        </button>

        {enabled && (
          <button
            onClick={() => setOpen((o) => !o)}
            className={`touch-manipulation flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all max-w-[190px] ${
              open ? 'bg-[#E08E9D] text-white shadow-sm' : 'bg-white/80 shadow-sm text-[#9c5563] hover:bg-white'
            }`}
            title={t('caratsay.bgm.playlist')}
          >
            {usingPad ? (
              <span className="truncate">♪ {t('caratsay.bgm.pad')}</span>
            ) : current ? (
              <span className="truncate">♪ {current.title}</span>
            ) : (
              <span className="truncate opacity-70">{t('caratsay.bgm.empty')}</span>
            )}
            <span className="shrink-0">
              <IconList />
            </span>
          </button>
        )}
      </div>

      {/* ── 展开面板 ── */}
      {open && enabled && (
        <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-2 z-50 w-[min(92vw,360px)] rounded-2xl border border-[#F7CAC9]/60 bg-white/97 backdrop-blur-md shadow-xl overflow-hidden">
          {/* 顶部：当前曲目 */}
          <div className="px-4 pt-3.5 pb-3 bg-gradient-to-r from-[#F7CAC9]/25 to-[#E08E9D]/15">
            <p className="text-[10px] font-bold tracking-wider text-[#C77DFF] mb-1">
              {t('caratsay.bgm.nowPlaying')}
            </p>
            {usingPad ? (
              <p className="text-sm font-semibold text-[#5a4a4a] truncate">
                {t('caratsay.bgm.pad')}
                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                  {t('common.example')}
                </span>
              </p>
            ) : current ? (
              <>
                <p className="text-sm font-semibold text-[#5a4a4a] truncate">{current.title}</p>
                {current.artist && (
                  <p className="text-[11px] text-muted-foreground truncate">{current.artist}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('caratsay.bgm.empty')}</p>
            )}
          </div>

          {/* 进度条 */}
          {!usingPad && current && (
            <div className="px-4 pt-3">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(e) => seek(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-[#F7CAC9]/40 accent-[#E08E9D] cursor-pointer"
                style={{ accentColor: '#E08E9D' }}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1 tabular-nums">
                <span>{fmtTime(currentTime)}</span>
                <span>{fmtTime(duration)}</span>
              </div>
            </div>
          )}

          {/* 控制区 */}
          <div className="px-4 py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => void prev()}
                className="touch-manipulation w-8 h-8 flex items-center justify-center rounded-full text-[#9c5563] hover:bg-[#F7CAC9]/30 transition"
                title={t('caratsay.bgm.prev')}
              >
                <IconPrev />
              </button>

              <button
                onClick={() => (isPlaying ? pause() : void play())}
                className="touch-manipulation w-10 h-10 flex items-center justify-center rounded-full bg-gradient-to-r from-[#F7CAC9] to-[#E08E9D] text-white shadow-md hover:shadow-lg active:scale-95 transition"
                title={isPlaying ? t('caratsay.bgm.pause') : t('caratsay.bgm.play')}
              >
                {isPlaying ? <IconPause s={20} /> : <IconPlay s={20} />}
              </button>

              <button
                onClick={() => void next()}
                className="touch-manipulation w-8 h-8 flex items-center justify-center rounded-full text-[#9c5563] hover:bg-[#F7CAC9]/30 transition"
                title={t('caratsay.bgm.next')}
              >
                <IconNext />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={cycleRepeat}
                className={`touch-manipulation w-7 h-7 flex items-center justify-center rounded-full transition ${
                  repeat !== 'off' ? 'bg-[#C77DFF]/15 text-[#C77DFF]' : 'text-muted-foreground hover:bg-muted'
                }`}
                title={repeatLabel}
              >
                <IconRepeat one={repeat === 'one'} />
              </button>
              <button
                onClick={toggleShuffle}
                className={`touch-manipulation w-7 h-7 flex items-center justify-center rounded-full transition ${
                  shuffle ? 'bg-[#C77DFF]/15 text-[#C77DFF]' : 'text-muted-foreground hover:bg-muted'
                }`}
                title={t('caratsay.bgm.shuffle')}
              >
                <IconShuffle />
              </button>
            </div>
          </div>

          {/* 音量 */}
          <div className="px-4 pb-3 flex items-center gap-2">
            <button
              onClick={toggleMute}
              className={`touch-manipulation w-7 h-7 flex items-center justify-center rounded-full shrink-0 ${
                muted ? 'text-[#E8555E]' : 'text-[#9c5563]'
              } hover:bg-muted transition`}
              title={muted ? t('caratsay.bgm.unmute') : t('caratsay.bgm.mute')}
            >
              <IconVolume off={muted || volume === 0} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none bg-[#F7CAC9]/40 cursor-pointer"
              style={{ accentColor: '#E08E9D' }}
              title={t('caratsay.bgm.volume')}
            />
            <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
              {Math.round((muted ? 0 : volume) * 100)}
            </span>
          </div>

          {/* 提示条 */}
          {(blocked || error || notice || !usingCloud) && (
            <div className="px-4 pb-2 space-y-1">
              {blocked && (
                <p className="text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700">
                  ⚠️ {t('caratsay.bgm.blocked')}
                </p>
              )}
              {error === 'ERR_LOAD' && (
                <p className="text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700">
                  ⚠️ {t('caratsay.bgm.errLoad')}
                </p>
              )}
              {error === 'ERR_PLAY' && (
                <p className="text-[11px] px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-700">
                  ⚠️ {t('caratsay.bgm.errPlay')}
                </p>
              )}
              {!usingCloud && (
                <p className="text-[11px] px-2.5 py-1.5 rounded-lg bg-muted/60 text-muted-foreground">
                  💾 {t('caratsay.bgm.localMode')}
                </p>
              )}
              {notice && (
                <p
                  className={`text-[11px] px-2.5 py-1.5 rounded-lg ${
                    notice.bad ? 'bg-rose-50 text-[#E8555E]' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {notice.bad ? '⚠️' : '✓'} {notice.msg}
                </p>
              )}
            </div>
          )}

          {/* 播放列表 */}
          <div className="border-t border-[#F7CAC9]/40">
            <div className="px-4 py-2 flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-wider text-muted-foreground">
                {t('caratsay.bgm.playlist')}
                <span className="ml-1 font-normal">({tracks.length})</span>
              </p>
              <button
                onClick={() => setShowAdd((s) => !s)}
                className="touch-manipulation flex items-center gap-1 text-[11px] font-medium text-[#C77DFF] hover:underline"
              >
                <IconPlus />
                {t('caratsay.bgm.add')}
              </button>
            </div>

            {/* 添加区 */}
            {showAdd && (
              <div className="px-4 pb-3 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.ogg"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="touch-manipulation w-full py-2 rounded-xl bg-gradient-to-r from-[#F7CAC9] to-[#E08E9D] text-white text-xs font-semibold shadow-sm hover:shadow disabled:opacity-60"
                >
                  {busy ? t('caratsay.bgm.uploading') : t('caratsay.bgm.upload')}
                </button>
                <p className="text-[10px] text-muted-foreground">{t('caratsay.bgm.uploadHint')}</p>

                <div className="pt-1 space-y-1.5">
                  <input
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder={t('caratsay.bgm.linkTitle')}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#F7CAC9]/60"
                  />
                  <input
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder={t('caratsay.bgm.linkPlaceholder')}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#F7CAC9]/60"
                  />
                  <div className="flex items-center gap-1.5">
                    <select
                      value={linkScene}
                      onChange={(e) => setLinkScene(e.target.value as BgmScene | 'none')}
                      className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#F7CAC9]/60"
                    >
                      {SCENES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {t(s.key)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => void submitLink()}
                      className="touch-manipulation px-3 py-1.5 rounded-lg bg-[#C77DFF] text-white text-xs font-semibold hover:opacity-90"
                    >
                      {t('caratsay.bgm.addLink')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 曲目列表 */}
            <div className="max-h-56 overflow-y-auto pb-2">
              {loadingTracks ? (
                <p className="px-4 py-4 text-center text-[11px] text-muted-foreground">
                  {t('common.loading')}
                </p>
              ) : tracks.length === 0 ? (
                <div className="px-4 py-5 text-center">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t('caratsay.bgm.emptyHint')}
                  </p>
                </div>
              ) : (
                tracks.map((track, i) => {
                  const active = i === Math.min(currentIndex, tracks.length - 1) && !usingPad;
                  const removable = canDeleteTrack(track);
                  return (
                    <div
                      key={track.id}
                      className={`group flex items-center gap-2 px-4 py-2 text-xs transition ${
                        active ? 'bg-[#F7CAC9]/25' : 'hover:bg-muted/50'
                      }`}
                    >
                      <button
                        onClick={() => void selectTrack(i)}
                        className="flex-1 text-left min-w-0"
                        title={track.url}
                      >
                        <span
                          className={`block truncate ${
                            active ? 'text-[#9c5563] font-semibold' : 'text-foreground/80'
                          }`}
                        >
                          {active && <span className="mr-1">♪</span>}
                          {track.title}
                        </span>
                        <span className="block text-[10px] text-muted-foreground truncate">
                          {[
                            track.scene ? t(`caratsay.view.${track.scene}`) : null,
                            track.source === 'cloud'
                              ? t('caratsay.bgm.srcCloud')
                              : track.source === 'link'
                                ? t('caratsay.bgm.srcLink')
                                : t('caratsay.bgm.srcBuiltin'),
                            removable ? null : t('caratsay.bgm.byOthers'),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </button>
                      {removable && (
                        <button
                          onClick={() => void handleRemove(track)}
                          className="touch-manipulation shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-[#E8555E] hover:bg-rose-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
                          title={t('caratsay.bgm.remove')}
                        >
                          <IconTrash />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
