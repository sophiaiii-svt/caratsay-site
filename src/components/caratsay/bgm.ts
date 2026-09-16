import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listBgmPlaylist,
  saveBgmPlaylist,
  loadLocalTracks,
  saveLocalTracks,
  type BgmTrack,
  type BgmScene,
} from '@/lib/bgmCloud';
import { isCloudEnabled } from '@/config/cloud';

export type { BgmTrack, BgmScene };
export type RepeatMode = 'off' | 'all' | 'one';

/**
 * 内置曲目：SEVENTEEN 官方曲目，音频需放在 public/audio/ 下。
 * 加载时会探测文件是否真实存在（依据 Content-Type 而非状态码，
 * 避免静态托管的 SPA fallback 把缺失文件也返回 200），只有存在的才会进入列表。
 */
const BUILTIN_TRACKS: BgmTrack[] = [
  { id: 'builtin_general', title: '玩个够', url: '/audio/bgm-wang-ge-gou.m4a', source: 'builtin' },
  { id: 'builtin_grid', title: 'US again', url: '/audio/bgm-us-again.m4a', source: 'builtin', scene: 'grid' },
  { id: 'builtin_book', title: '青春赞歌 (Cheers)', url: '/audio/bgm-cheers.m4a', source: 'builtin', scene: 'book' },
  { id: 'builtin_slideshow', title: 'Circle', url: '/audio/bgm-circle.m4a', source: 'builtin', scene: 'slideshow' },
];

const LS = {
  on: 'caratsay_bgm',
  vol: 'caratsay_bgm_vol',
  repeat: 'caratsay_bgm_repeat',
  shuffle: 'caratsay_bgm_shuffle',
  idx: 'caratsay_bgm_idx',
};

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, val: string): void {
  try {
    localStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * 轻量环境音垫：播放列表为空时的兜底，保证开关「有声」且和谐。
 * 三个正弦波（根音 / 五度 / 八度）经缓慢 LFO 调制，音量很轻。
 */
class AmbientPad {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private oscs: OscillatorNode[] = [];
  private playing = false;

  start(root = 220) {
    if (this.playing) return;
    const Ctx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);

    const freqs = [root, root * 1.5, root * 2];
    freqs.forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx!.createGain();
      g.gain.value = 0.3 / freqs.length;
      const lfo = this.ctx!.createOscillator();
      lfo.frequency.value = 0.06 + i * 0.025;
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = 0.12;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      o.connect(g);
      g.connect(this.master!);
      o.start();
      lfo.start();
      this.oscs.push(o, lfo);
    });
    this.master.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 1.4);
    this.playing = true;
  }

  stop() {
    if (!this.ctx || !this.master) return;
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.7);
    const ctx = this.ctx;
    window.setTimeout(() => {
      this.oscs.forEach((o) => {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
      });
      void ctx.close();
    }, 800);
    this.ctx = null;
    this.master = null;
    this.oscs = [];
    this.playing = false;
  }
}

/** 探测本地音频是否真实存在（防止静态托管 fallback 返回 HTML 伪装成 200） */
async function localAudioExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-1' } });
    if (!res.ok && res.status !== 206) return false;
    const ct = res.headers.get('content-type') || '';
    return /audio|octet-stream|mpeg|mp4|video/i.test(ct);
  } catch {
    return false;
  }
}

/**
 * 克拉SAY 背景音乐播放器
 *
 * 相比旧版（单曲循环 + 静默降级）补齐：
 * - 曲目列表来自云端 bgm/playlist.json，所有访客可上传、所有人可见
 * - 播放 / 暂停、上下曲、进度拖拽、音量、循环（关/列表/单曲）、随机
 * - 换曲淡入淡出，不再硬切
 * - 自动播放被浏览器拦截时显式提示，不再静默失败
 * - 切换视图时自动切到该场景的曲目（手动选曲后暂停跟随，直到再次切视图）
 */
export function useBgm(viewMode: BgmScene, inView = true) {
  const [tracks, setTracksState] = useState<BgmTrack[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [usingCloud, setUsingCloud] = useState(isCloudEnabled());

  // 默认开启：只有用户明确关过（值为 '0'）才保持关闭
  const [enabled, setEnabled] = useState<boolean>(() => lsGet(LS.on) !== '0');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(() => {
    const n = Number(lsGet(LS.idx));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolumeState] = useState<number>(() => {
    const v = Number(lsGet(LS.vol));
    return Number.isFinite(v) && v >= 0 && v <= 1 ? v : 0.6;
  });
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>(() => {
    const r = lsGet(LS.repeat);
    return r === 'all' || r === 'one' ? r : 'off';
  });
  const [shuffle, setShuffleState] = useState<boolean>(() => lsGet(LS.shuffle) === '1');
  const [blocked, setBlocked] = useState(false); // 自动播放被浏览器拦截
  const [error, setError] = useState<string | null>(null);
  const [usingPad, setUsingPad] = useState(false); // 列表为空 → 环境音兜底

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const padRef = useRef<AmbientPad | null>(null);
  const enabledRef = useRef(enabled);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  const repeatRef = useRef(repeat);
  const shuffleRef = useRef(shuffle);
  const idxRef = useRef(currentIndex);
  const tracksRef = useRef<BgmTrack[]>([]);
  const manualPickRef = useRef(false); // 用户手动选曲后，暂停「跟随场景换歌」
  const fadeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const switchingRef = useRef(false);
  /** 供 audio 事件回调取用最新版本的 loadAndPlay（避免闭包捕获到旧实例） */
  const loadAndPlayRef = useRef<((index: number, autoplay: boolean) => Promise<void>) | null>(null);
  /** 用户手动暂停过 → 不再自动恢复，直到用户自己点播放 */
  const userPausedRef = useRef(false);
  /** 进入视口的自动播放只触发一次，避免反复打断 */
  const autoStartedRef = useRef(false);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);
  useEffect(() => {
    idxRef.current = currentIndex;
  }, [currentIndex]);
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  /* ---------- 加载曲目：本地兜底 → 云端 → 探测内置 ---------- */
  useEffect(() => {
    let alive = true;
    const localFirst = loadLocalTracks();
    if (localFirst.length) setTracksState(localFirst);

    Promise.all([
      listBgmPlaylist(),
      Promise.all(BUILTIN_TRACKS.map((t) => localAudioExists(t.url).then((ok) => (ok ? t : null)))),
    ])
      .then(([cloud, builtins]) => {
        if (!alive) return;
        const found = builtins.filter((t): t is BgmTrack => t !== null);
        // 按标题去重：同一首歌可能同时存在于云端与 public/audio，只保留一份
        const norm = (s: string) => s.trim().toLowerCase();
        if (cloud) {
          setUsingCloud(true);
          const titles = new Set(cloud.map((t) => norm(t.title)));
          setTracksState([...cloud, ...found.filter((t) => !titles.has(norm(t.title)))]);
        } else {
          setUsingCloud(false);
          setTracksState((prev) => {
            const titles = new Set(prev.map((t) => norm(t.title)));
            return [...prev, ...found.filter((t) => !titles.has(norm(t.title)))];
          });
        }
      })
      .catch(() => {
        if (alive) setUsingCloud(false);
      })
      .finally(() => {
        if (alive) setLoadingTracks(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  /* ---------- 持久化曲目列表 ---------- */
  const persistTracks = useCallback(async (next: BgmTrack[]) => {
    setTracksState(next);
    saveLocalTracks(next);
    if (!isCloudEnabled()) return;
    try {
      await saveBgmPlaylist(next);
    } catch {
      /* 云端失败已本地兜底 */
    }
  }, []);

  /* ---------- audio 单例 ---------- */
  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'metadata';
      a.crossOrigin = 'anonymous';
      a.volume = mutedRef.current ? 0 : volumeRef.current;

      a.addEventListener('loadedmetadata', () => setDuration(a.duration || 0));
      a.addEventListener('timeupdate', () => setCurrentTime(a.currentTime));
      a.addEventListener('play', () => setIsPlaying(true));
      a.addEventListener('pause', () => setIsPlaying(false));
      a.addEventListener('ended', () => {
        // 单曲循环由 audio.loop 处理；走到这里说明是列表结束
        if (repeatRef.current === 'one') {
          a.currentTime = 0;
          void a.play();
          return;
        }
        const list = tracksRef.current;
        if (!list.length) return;
        if (repeatRef.current === 'all' || idxRef.current < list.length - 1) {
          const nextIdx = shuffleRef.current
            ? Math.floor(Math.random() * list.length)
            : (idxRef.current + 1) % list.length;
          idxRef.current = nextIdx;
          setCurrentIndex(nextIdx);
          lsSet(LS.idx, String(nextIdx));
          void loadAndPlayRef.current?.(nextIdx, true);
        } else {
          setIsPlaying(false);
        }
      });
      a.addEventListener('error', () => {
        if (!a.src) return;
        setError('ERR_LOAD');
        // 自动跳下一首，避免整条列表卡死
        const list = tracksRef.current;
        if (list.length > 1) {
          const nextIdx = (idxRef.current + 1) % list.length;
          idxRef.current = nextIdx;
          setCurrentIndex(nextIdx);
          window.setTimeout(() => void loadAndPlayRef.current?.(nextIdx, true), 600);
        }
      });

      audioRef.current = a;
    }
    return audioRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 淡入淡出 ---------- */
  const fade = useCallback((target: number, ms: number, done?: () => void) => {
    const a = audioRef.current;
    if (!a) {
      done?.();
      return;
    }
    if (fadeTimer.current) clearInterval(fadeTimer.current);
    const from = a.volume;
    const to = clamp01(target);
    if (Math.abs(to - from) < 0.01) {
      a.volume = to;
      done?.();
      return;
    }
    const steps = Math.max(4, Math.round(ms / 40));
    let i = 0;
    fadeTimer.current = setInterval(() => {
      i += 1;
      a.volume = clamp01(from + ((to - from) * i) / steps);
      if (i >= steps) {
        if (fadeTimer.current) clearInterval(fadeTimer.current);
        fadeTimer.current = null;
        a.volume = to;
        done?.();
      }
    }, ms / steps);
  }, []);

  const targetVolume = useCallback(() => (mutedRef.current ? 0 : clamp01(volumeRef.current)), []);

  /* ---------- 载入并播放指定曲目 ---------- */
  const loadAndPlay = useCallback(
    async (index: number, autoplay: boolean) => {
      const list = tracksRef.current;
      if (!list.length) {
        setUsingPad(true);
        return;
      }
      const safeIdx = ((index % list.length) + list.length) % list.length;
      const track = list[safeIdx];
      if (!track) return;

      setUsingPad(false);
      setError(null);

      const a = ensureAudio();
      padRef.current?.stop();
      padRef.current = null;

      // 换曲：淡出 → 换源 → 播放 → 淡入
      if (a.src && autoplay && isPlaying) {
        switchingRef.current = true;
        fade(0, 320, () => {
          a.pause();
          a.src = track.url;
          a.load();
          a.volume = 0;
          a.loop = repeatRef.current === 'one';
          a.play()
            .then(() => {
              setBlocked(false);
              fade(targetVolume(), 420);
            })
            .catch((e: DOMException) => {
              if (e?.name === 'NotAllowedError') setBlocked(true);
              else setError('ERR_PLAY');
            })
            .finally(() => {
              switchingRef.current = false;
            });
        });
        return;
      }

      a.src = track.url;
      a.load();
      a.volume = autoplay ? 0 : targetVolume();
      a.loop = repeatRef.current === 'one';
      setCurrentTime(0);
      setDuration(0);

      if (!autoplay) return;
      try {
        await a.play();
        setBlocked(false);
        fade(targetVolume(), 420);
      } catch (e) {
        if ((e as DOMException)?.name === 'NotAllowedError') setBlocked(true);
        else setError('ERR_PLAY');
      }
    },
    [ensureAudio, fade, targetVolume, isPlaying]
  );

  /* 始终让事件回调拿到最新的 loadAndPlay */
  useEffect(() => {
    loadAndPlayRef.current = loadAndPlay;
  }, [loadAndPlay]);

  /* ---------- 对外操作 ---------- */
  const play = useCallback(async () => {
    userPausedRef.current = false; // 用户主动播放 → 解除「手动暂停」锁定
    const list = tracksRef.current;
    if (!list.length) {
      // 列表为空 → 环境音兜底
      if (!padRef.current) padRef.current = new AmbientPad();
      padRef.current.start();
      setUsingPad(true);
      setIsPlaying(true);
      return;
    }
    const a = ensureAudio();
    if (!a.src) {
      await loadAndPlay(idxRef.current, true);
      return;
    }
    try {
      await a.play();
      setBlocked(false);
      fade(targetVolume(), 260);
    } catch (e) {
      if ((e as DOMException)?.name === 'NotAllowedError') setBlocked(true);
      else setError('ERR_PLAY');
    }
  }, [ensureAudio, loadAndPlay, fade, targetVolume]);

  const pause = useCallback(() => {
    userPausedRef.current = true; // 手动暂停后，切视图 / 重新进入板块都不再自动播
    fade(0, 260, () => audioRef.current?.pause());
    padRef.current?.stop();
    padRef.current = null;
    setUsingPad(false);
  }, [fade]);

  const stopAll = useCallback(() => {
    if (fadeTimer.current) clearInterval(fadeTimer.current);
    fadeTimer.current = null;
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.src = '';
    }
    padRef.current?.stop();
    padRef.current = null;
    setUsingPad(false);
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const selectTrack = useCallback(
    async (index: number) => {
      manualPickRef.current = true;
      idxRef.current = index;
      setCurrentIndex(index);
      lsSet(LS.idx, String(index));
      if (enabledRef.current) await loadAndPlay(index, true);
    },
    [loadAndPlay]
  );

  const next = useCallback(async () => {
    const list = tracksRef.current;
    if (!list.length) return;
    const idx = shuffleRef.current ? Math.floor(Math.random() * list.length) : (idxRef.current + 1) % list.length;
    await selectTrack(idx);
  }, [selectTrack]);

  const prev = useCallback(async () => {
    const list = tracksRef.current;
    if (!list.length) return;
    // 播放超过 3 秒时，「上一首」先回到本曲开头（与主流播放器一致）
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    const idx = shuffleRef.current
      ? Math.floor(Math.random() * list.length)
      : (idxRef.current - 1 + list.length) % list.length;
    await selectTrack(idx);
  }, [selectTrack]);

  const seek = useCallback((sec: number) => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(a.duration)) return;
    a.currentTime = Math.max(0, Math.min(a.duration, sec));
    setCurrentTime(a.currentTime);
  }, []);

  const setVolume = useCallback((v: number) => {
    const val = clamp01(v);
    volumeRef.current = val;
    setVolumeState(val);
    lsSet(LS.vol, String(val));
    if (val > 0) {
      setMuted(false);
      mutedRef.current = false;
    }
    const a = audioRef.current;
    if (a) a.volume = mutedRef.current ? 0 : val;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const nm = !m;
      mutedRef.current = nm;
      const a = audioRef.current;
      if (a) a.volume = nm ? 0 : volumeRef.current;
      return nm;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatState((r) => {
      const order: RepeatMode[] = ['off', 'all', 'one'];
      const nr = order[(order.indexOf(r) + 1) % order.length];
      repeatRef.current = nr;
      lsSet(LS.repeat, nr);
      if (audioRef.current) audioRef.current.loop = nr === 'one';
      return nr;
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffleState((s) => {
      const ns = !s;
      shuffleRef.current = ns;
      lsSet(LS.shuffle, ns ? '1' : '0');
      return ns;
    });
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      lsSet(LS.on, next ? '1' : '0');
      enabledRef.current = next;
      if (next) {
        manualPickRef.current = false;
        // 开启时若当前索引越界，回到第一首
        const list = tracksRef.current;
        const idx = list.length && idxRef.current < list.length ? idxRef.current : 0;
        idxRef.current = idx;
        setCurrentIndex(idx);
        void loadAndPlay(idx, true);
      } else {
        stopAll();
      }
      return next;
    });
  }, [loadAndPlay, stopAll]);

  const addTracks = useCallback(
    async (added: BgmTrack[]) => {
      const next = [...tracksRef.current, ...added];
      await persistTracks(next);
      // 若原本没有曲目，加上后自动播放第一首
      if (!tracksRef.current.length && enabledRef.current) {
        await selectTrack(0);
      }
    },
    [persistTracks, selectTrack]
  );

  const removeTrack = useCallback(
    async (id: string) => {
      const target = tracksRef.current.find((t) => t.id === id);
      const next = tracksRef.current.filter((t) => t.id !== id);
      const wasCurrent = tracksRef.current[idxRef.current]?.id === id;
      await persistTracks(next);
      if (wasCurrent) {
        const idx = Math.min(idxRef.current, Math.max(0, next.length - 1));
        idxRef.current = idx;
        setCurrentIndex(idx);
        if (enabledRef.current) {
          if (next.length) await loadAndPlay(idx, true);
          else stopAll();
        }
      }
      return target;
    },
    [persistTracks, loadAndPlay, stopAll]
  );

  /* ---------- 进入板块（滚到可见）→ 自动播放 ----------
     浏览器要求先有用户手势才允许出声。若被拦截，不会静默失败：
     置 blocked 后由下面的 effect 挂一次性手势监听，用户碰一下页面就接上。 */
  useEffect(() => {
    if (!inView) return;
    if (loadingTracks) return;
    if (!enabledRef.current) return;
    if (userPausedRef.current) return; // 用户自己按过暂停，尊重他的选择
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    void play().catch(() => setBlocked(true));
  }, [inView, loadingTracks, play]);

  /* ---------- 自动播放被拦截 → 首次手势时补播 ---------- */
  useEffect(() => {
    if (!blocked) return;
    const resume = () => {
      setBlocked(false);
      void play();
    };
    const opts = { once: true, passive: true } as const;
    window.addEventListener('pointerdown', resume, opts);
    window.addEventListener('touchstart', resume, opts);
    window.addEventListener('keydown', resume, opts);
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('touchstart', resume);
      window.removeEventListener('keydown', resume);
    };
  }, [blocked, play]);

  /* ---------- 切换视图 → 换到该场景的曲目 ---------- */
  useEffect(() => {
    if (!enabledRef.current || manualPickRef.current) return;
    const list = tracksRef.current;
    if (!list.length) return;
    const idx = list.findIndex((t) => t.scene === viewMode);
    // 用户已手动暂停 → 换视图也不擅自出声，只把曲目指针挪过去
    if (userPausedRef.current) {
      if (idx >= 0) {
        idxRef.current = idx;
        setCurrentIndex(idx);
      }
      return;
    }
    if (idx >= 0 && idx !== idxRef.current) {
      idxRef.current = idx;
      setCurrentIndex(idx);
      void loadAndPlay(idx, true);
    }
  }, [viewMode, loadAndPlay]);

  /* ---------- 卸载清理 ---------- */
  useEffect(
    () => () => {
      if (fadeTimer.current) clearInterval(fadeTimer.current);
      audioRef.current?.pause();
      audioRef.current = null;
      padRef.current?.stop();
      padRef.current = null;
    },
    []
  );

  const current: BgmTrack | null = useMemo(
    () => tracks[Math.min(currentIndex, Math.max(0, tracks.length - 1))] ?? null,
    [tracks, currentIndex]
  );

  return {
    tracks,
    loadingTracks,
    usingCloud,
    enabled,
    toggle,
    play,
    pause,
    next,
    prev,
    seek,
    selectTrack,
    addTracks,
    removeTrack,
    isPlaying,
    current,
    currentIndex,
    duration,
    currentTime,
    volume,
    setVolume,
    muted,
    toggleMute,
    repeat,
    cycleRepeat,
    shuffle,
    toggleShuffle,
    blocked,
    error,
    usingPad,
  };
}
