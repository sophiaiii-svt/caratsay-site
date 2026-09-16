import { useCallback, useEffect, useRef, useState } from 'react';
import LazyImage from './LazyImage';
import { formatDate, type Photo } from './types';
import { useI18n } from '../../i18n/LanguageContext';

const STACK = 4; // 可见的叠牌层数
const FLING_DIST = 110; // 触发飞牌的水平/垂直阈值
const DOUBLE_TAP_MS = 280; // 双击判定间隔

/** 由 id 派生的不规则叠放偏移（确定性，同一张图永远同一姿态） */
function deckStyle(id: string, rank: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const r1 = (h % 100) / 100;
  const r2 = ((h >> 7) % 100) / 100;
  const r3 = ((h >> 13) % 100) / 100;
  // 不规则旋转 + 交替偏移，越往后越小越上移
  const rot = (r1 - 0.5) * 9 + (rank % 2 ? 2.4 : -2.4);
  const dx = (r2 - 0.5) * 20;
  const dy = -rank * 12 - (rank > 0 ? r3 * 5 : 0);
  const scale = 1 - rank * 0.045;
  return { rot, dx, dy, scale };
}

/** 判断文本是否以中文为主 */
function isChinese(text: string) {
  return /[\u4e00-\u9fa5]/.test(text);
}

/** 签名卡背图片映射（团体 → 13 位成员） */
const SIG_MAP: Record<string, string> = {
  group: '/signatures/group.png',
  scoups: '/signatures/scoups.png',
  jeonghan: '/signatures/jeonghan.png',
  joshua: '/signatures/joshua.png',
  jun: '/signatures/jun.png',
  hoshi: '/signatures/hoshi.png',
  wonwoo: '/signatures/wonwoo.png',
  woozi: '/signatures/woozi.png',
  the8: '/signatures/the8.png',
  mingyu: '/signatures/mingyu.png',
  dk: '/signatures/dk.png',
  seungkwan: '/signatures/seungkwan.png',
  vernon: '/signatures/vernon.png',
  dino: '/signatures/dino.png',
};

function signatureOf(section: string) {
  return SIG_MAP[section] || '/signatures/group.png';
}

export default function MemoryBook({
  photos,
  labelOf,
  onOpen,
}: {
  photos: Photo[];
  labelOf: (section: string) => string;
  onOpen: (photo: Photo) => void;
}) {
  const n = photos.length;
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [fly, setFly] = useState<null | 'left' | 'right'>(null);
  const [lastDir, setLastDir] = useState<null | 'next' | 'prev'>(null);
  const [flipped, setFlipped] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const { t } = useI18n();

  useEffect(() => {
    setIndex((t) => Math.min(t, Math.max(0, n - 1)));
    setFlipped(false);
  }, [n]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
    };
  }, []);

  const resetFlip = useCallback(() => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
    setFlipped(false);
  }, []);

  const go = useCallback(
    (dir: 'next' | 'prev') => {
      if (fly || drag || n <= 1) return;
      const next = dir === 'next' ? Math.min(index + 1, n - 1) : Math.max(index - 1, 0);
      if (next === index) return;
      resetFlip();
      setLastDir(dir);
      setIndex(next);
      timer.current = setTimeout(() => setLastDir(null), 520);
    },
    [fly, drag, n, index, resetFlip]
  );

  // 拖拽飞牌手势（鼠标 + 触屏）
  const onDown = (e: React.PointerEvent) => {
    if (flipped || fly || n <= 1) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = 0;
    setDrag({ x: 0, y: 0 });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag || !start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    moved.current = Math.max(moved.current, Math.hypot(x, y));
    setDrag({ x, y });
  };
  const onUp = () => {
    if (!drag || !start.current) return;
    const { x, y } = drag;
    start.current = null;
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (moved.current < 6) {
      // 轻点：单击翻转看卡背，双击放大查看原图
      const now = Date.now();
      const since = now - lastTap.current;
      lastTap.current = now;
      setDrag(null);

      if (since < DOUBLE_TAP_MS) {
        // 双击：放大查看原图
        if (tapTimer.current) {
          clearTimeout(tapTimer.current);
          tapTimer.current = null;
        }
        onOpen(photos[index]);
        return;
      }

      if (flipped) {
        // 已翻到背面：单击即刻翻回正面
        resetFlip();
      } else {
        // 单击：延迟翻转到卡背，避免与双击冲突
        tapTimer.current = setTimeout(() => {
          tapTimer.current = null;
          setFlipped(true);
        }, 160);
      }
      return;
    }

    if (absX > FLING_DIST || absY > FLING_DIST * 1.4) {
      // 沿主方向飞出
      const dir: 'left' | 'right' = absX >= absY ? (x >= 0 ? 'right' : 'left') : y >= 0 ? 'right' : 'left';
      resetFlip();
      setFly(dir);
      setDrag(null);
      timer.current = setTimeout(() => {
        setIndex((t) => (dir === 'right' ? Math.min(t + 1, n - 1) : Math.max(t - 1, 0)));
        setFly(null);
      }, 460);
    } else {
      setDrag(null); // 回弹
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go('next');
      else if (e.key === 'ArrowLeft') go('prev');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  if (n === 0) return null;

  const visible = photos.slice(index, index + STACK + 1);

  return (
    <div className="select-none">
      <div className="relative mx-auto w-full max-w-md sm:max-w-xl" style={{ perspective: '1600px' }}>
        {/* 桌面阴影 */}
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[4%] w-[60%] h-8 rounded-full bg-black/20 blur-2xl" />

        <div className="relative" style={{ height: 'min(78vh, 580px)' }}>
          {visible.map((p, k) => {
            const rank = k;
            const st = deckStyle(p.id, rank);
            const isTop = k === 0;

            // 飞出的那张
            if (fly && isTop) {
              const dirX = fly === 'right' ? 168 : -168;
              const rot = fly === 'right' ? 22 : -22;
              return (
                <div
                  key={p.id}
                  className="absolute inset-0 z-30 flex items-center justify-center"
                  style={{
                    transform: `translateX(${dirX}%) translateY(-10%) rotate(${rot}deg)`,
                    opacity: 0,
                    transition: 'transform .46s cubic-bezier(.4,.1,.2,1), opacity .46s ease-in',
                    transformOrigin: 'center',
                  }}
                >
                  <CardInner photo={p} label={labelOf(p.section)} />
                  <div
                    key={`fl-${index}`}
                    className="pointer-events-none absolute right-[20%] top-[20%] caratsay-sparkle text-[#F7CAC9]"
                  >
                    ✦
                  </div>
                </div>
              );
            }

            let transform = `translate(${st.dx}px, ${st.dy}px) rotate(${st.rot}deg) scale(${st.scale})`;
            let transition = 'transform .32s ease-out, box-shadow .32s ease-out';
            if (isTop && drag) {
              transform = `translate(${st.dx + drag.x}px, ${st.dy + drag.y}px) rotate(${st.rot + drag.x * 0.06}deg) scale(1)`;
              transition = 'none';
            }
            const entrance = isTop && lastDir === 'prev' && !drag ? 'caratsay-stack-prev' : '';

            return (
              <div
                key={p.id}
                className={`absolute inset-0 flex items-center justify-center ${isTop ? 'cursor-grab active:cursor-grabbing' : ''} ${entrance}`}
                style={{
                  transform,
                  transition,
                  zIndex: STACK - rank,
                  transformOrigin: 'center',
                  touchAction: isTop ? 'none' : 'auto',
                  pointerEvents: isTop ? 'auto' : 'none',
                  willChange: 'transform',
                }}
                onPointerDown={isTop ? onDown : undefined}
                onPointerMove={isTop ? onMove : undefined}
                onPointerUp={isTop ? onUp : undefined}
                onPointerCancel={isTop ? onUp : undefined}
              >
                <CardInner photo={p} label={labelOf(p.section)} dim={rank > 0} flipped={isTop ? flipped : false} />
              </div>
            );
          })}
        </div>

        {/* 控制 */}
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => go('prev')}
            disabled={fly !== null || drag !== null || n <= 1}
            className="touch-manipulation w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center text-[#8a6a72] hover:bg-[#F7CAC9] hover:text-white active:scale-95 transition-colors disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-[#8a6a72]"
            aria-label={t('common.prev')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="px-4 py-2 rounded-full bg-white/80 shadow-sm text-xs font-medium text-[#8a6a72] tabular-nums">
            {t('memory.photoCount', { n: index + 1, m: n })}
          </div>

          <button
            onClick={() => go('next')}
            disabled={fly !== null || drag !== null || n <= 1}
            className="touch-manipulation w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center text-[#8a6a72] hover:bg-[#F7CAC9] hover:text-white active:scale-95 transition-colors disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-[#8a6a72]"
            aria-label={t('common.next')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* 进度滑块 */}
        {n > 1 && (
          <div className="max-w-sm mx-auto mt-4 px-4">
            <input
              type="range"
              min={0}
              max={n - 1}
              value={index}
              onChange={(e) => {
                if (timer.current) clearTimeout(timer.current);
                if (tapTimer.current) clearTimeout(tapTimer.current);
                setFly(null);
                setDrag(null);
                setLastDir(null);
                setFlipped(false);
                setIndex(Number(e.target.value));
              }}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[#E08E9D] bg-[#F0DDE0]"
              aria-label={t('common.quickPage')}
            />
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground/70 mt-3">
          {t('memory.hint')}
        </p>
      </div>
    </div>
  );
}

/* ---------- 单张照片卡（三寸拍立得 · 正反面翻转） ---------- */
function CardInner({
  photo,
  label,
  dim,
  flipped,
}: {
  photo: Photo;
  label: string;
  dim?: boolean;
  flipped?: boolean;
}) {
  const { t } = useI18n();
  const cn = isChinese(label);
  const handClass = cn ? 'font-hand-cn' : 'font-hand';
  const signatureSrc = signatureOf(photo.section);

  return (
    <div
      className={`flip-card relative w-[88%] sm:w-[74%] mx-auto aspect-[5/6] rounded-[14px] shadow-[0_24px_50px_-16px_rgba(90,60,70,0.55)] ${
        dim ? 'brightness-[0.96]' : ''
      }`}
    >
      <div className={`flip-card-inner ${flipped ? 'is-flipped' : ''}`}>
        {/* 正面：照片 + 手写式说明条 */}
        <div className="flip-front bg-white rounded-[14px] overflow-hidden">
          <div className="absolute inset-x-3 top-3 bottom-[16%] overflow-hidden rounded-md bg-muted/40 ring-1 ring-black/5">
            <LazyImage src={photo.src} alt={`${label} ${t('memory.recall')}`} className="w-full h-full object-cover object-center" />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[16%] flex items-center justify-center gap-2 px-3">
            <span className={`text-[15px] sm:text-[17px] text-[#8a5a65] truncate ${handClass}`}>{label}</span>
            <span className={`text-[13px] sm:text-[14px] text-[#b38e96] shrink-0 ${handClass}`}>
              · {formatDate(photo.timestamp)}
            </span>
          </div>
          {photo.origin === 'local' && (
            <span className="absolute top-2 right-2 text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
              {t('common.localOnly')}
            </span>
          )}
        </div>

        {/* 背面：拍立得背面备注（真实签名卡背图片） */}
        <div
          className="flip-back rounded-[14px] overflow-hidden"
          style={{
            backgroundColor: '#fffdf9',
            backgroundImage: 'radial-gradient(rgba(0,0,0,0.045) 1px, transparent 1px)',
            backgroundSize: '12px 12px',
          }}
        >
          <div className="absolute inset-x-3 top-5 bottom-10 flex items-center justify-center">
            <img
              src={signatureSrc}
              alt={`${label} ${t('memory.signedBack')}`}
              className="max-w-full max-h-full object-contain drop-shadow-sm"
              draggable={false}
            />
          </div>

          <div className={`absolute left-5 bottom-3 text-[14px] sm:text-[15px] text-[#9a7a82] ${handClass}`}>
            {formatDate(photo.timestamp)}
          </div>
        </div>
      </div>
    </div>
  );
}
