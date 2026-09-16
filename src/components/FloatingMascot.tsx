import { useEffect, useRef, useState, useCallback } from 'react';
import { useI18n } from '@/i18n/LanguageContext';

export default function FloatingMascot() {
  const { t } = useI18n();
  type MascotAction =
    | 'lead' | 'lie' | 'sing' | 'cool' | 'dance' | 'think' | 'heart'
    | 'chill' | 'eat' | 'jump' | 'power' | 'battery' | 'spin';

  interface ActionMeta {
    key: MascotAction;
    label: string;
    member: string;
    bubble: string;
    emoji: string;
    duration: number;
  }

  // 13 个动作 = 13 位成员，按官方成员顺序循环，标语与动作均按用户指定文案
  const actions: ActionMeta[] = [
    { key: 'lead', label: '队长开场', member: 'S.Coups 崔胜澈', bubble: 'Say the name, SEVENTEEN! 我是里兜 澈哩🍒 克拉们今天也要一起冲💎', emoji: '👋', duration: 3200 },
    { key: 'lie', label: '天使充电', member: 'Jeonghan 尹净汉', bubble: '哈尼嘿 克拉der~ 累了就躺平充个电🕊️ 克拉也要好好休息，明天见哦😴', emoji: '😴', duration: 3200 },
    { key: 'sing', label: '周日早晨', member: 'Joshua 洪知秀', bubble: 'Sunday Morning🎶🎶 宝宝蒸棒👍', emoji: '🎤', duration: 2600 },
    { key: 'cool', label: '神秘摆酷', member: 'Jun 文俊辉', bubble: '1+1 等于多少？不重要，开心最重要😎', emoji: '😎', duration: 2600 },
    { key: 'dance', label: '老虎蹦跳', member: 'Hoshi 权顺荣', bubble: '虎浪嘿🐯 我是十点十分 Hoshi！克拉们跟我一起跳！', emoji: '💃', duration: 2600 },
    { key: 'think', label: '安静陪伴', member: 'Wonwoo 全圆佑', bubble: '圆佑陪你安静待会儿，没关系的，慢慢来🌿', emoji: '🤔', duration: 3000 },
    { key: 'heart', label: '音乐之神', member: 'Woozi 李知勋', bubble: '我是音乐之神 Woozi～你做的每件事都很棒，笔芯笔芯✍️', emoji: '❤️', duration: 2800 },
    { key: 'chill', label: '小卡哲学', member: 'The8 徐明浩', bubble: '小卡自己印哪~ 你要因为一张小卡困住你的人生吗', emoji: '✌️', duration: 3000 },
    { key: 'eat', label: '投喂欧巴', member: 'Mingyu 金珉奎', bubble: '克拉der~ 今天吃了什么', emoji: '🍚', duration: 2800 },
    { key: 'jump', label: '开心病毒', member: 'DK 李硕珉', bubble: '克拉der~ happy virus来袭 今天有什么烦恼呢？没事笑一笑就好了', emoji: '😄', duration: 2400 },
    { key: 'power', label: '维他命BOO', member: 'Seungkwan 夫胜宽', bubble: '维他命BOO🍊 💪POWER BOO 克拉der 今天也要能量满满哦', emoji: '💪', duration: 2800 },
    { key: 'battery', label: '放空松弛', member: 'Vernon 崔瀚率', bubble: 'Positive vibes only✌️', emoji: '🔋', duration: 3000 },
    { key: 'spin', label: '忙内舞步', member: 'Dino 李灿', bubble: '给大家表演一下 要开心哦克拉der', emoji: '🌀', duration: 2400 },
  ];

  const [action, setAction] = useState<MascotAction>('lead');
  const [bubble, setBubble] = useState('');
  const [showBubble, setShowBubble] = useState(false);
  const [position, setPosition] = useState({ x: 18, y: 84 }); // px offset from top-left
  const [dragging, setDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMounted = useRef(false);
  // Track current action in a ref so pointer handlers always read the latest value.
  const actionRef = useRef<MascotAction>('lead');
  // Debounce guard so a single tap isn't double-fired by both pointerUp and onClick.
  const lastTapRef = useRef(0);

  const clearTimers = useCallback(() => {
    if (bubbleTimer.current) clearTimeout(bubbleTimer.current);
    if (actionTimer.current) clearTimeout(actionTimer.current);
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  const triggerAction = useCallback((nextAction: MascotAction, silent = false) => {
    clearTimers();
    actionRef.current = nextAction;
    setAction(nextAction);
    const meta = actions.find((a) => a.key === nextAction) || actions[0];
    if (!silent) {
      setBubble(nextAction);
      setShowBubble(true);
      bubbleTimer.current = setTimeout(() => setShowBubble(false), meta.duration);
    }

    // Auto-return to the leader's resting pose after high-energy transient actions
    if (nextAction !== 'lead' && nextAction !== 'lie' && nextAction !== 'cool' && nextAction !== 'think' && nextAction !== 'heart' && nextAction !== 'chill' && nextAction !== 'battery') {
      actionTimer.current = setTimeout(() => {
        actionRef.current = 'lead';
        setAction('lead');
      }, meta.duration);
    }

    // Schedule next random idle action (shorter, livelier cadence)
    idleTimer.current = setTimeout(() => {
      const pool = actions.filter((a) => a.key !== actionRef.current);
      const pick = pool[Math.floor(Math.random() * pool.length)];
      triggerAction(pick.key);
    }, meta.duration + 3000 + Math.random() * 4000);
  }, [actions, clearTimers]);

  // Initial greeting on mount
  useEffect(() => {
    if (hasMounted.current) return;
    hasMounted.current = true;
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

    const t = setTimeout(() => {
      triggerAction('lead');
    }, 700);

    return () => {
      clearTimeout(t);
      clearTimers();
    };
  }, [triggerAction, clearTimers]);

  // Advance to the next action in sequence (cycle through all moods).
  const advanceAction = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 120) return; // debounce double-fire
    lastTapRef.current = now;
    const idx = actions.findIndex((a) => a.key === actionRef.current);
    const nextIdx = (idx + 1) % actions.length;
    triggerAction(actions[nextIdx].key);
  }, [actions, triggerAction]);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    setDragging(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    // Lower threshold (4px) so a deliberate click is never misread as a drag.
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      setDragging(true);
    }
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setPosition({
        x: Math.max(8, dragRef.current.initialX + dx),
        y: Math.max(8, dragRef.current.initialY + dy),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    const start = dragRef.current;
    const moved =
      start != null &&
      (Math.abs(e.clientX - start.startX) > 4 || Math.abs(e.clientY - start.startY) > 4);
    if (target.hasPointerCapture && target.hasPointerCapture(e.pointerId)) {
      target.releasePointerCapture(e.pointerId);
    }
    if (start && !moved) {
      // Treated as a tap/click → switch the slogan immediately.
      advanceAction();
    }
    dragRef.current = null;
    setTimeout(() => setDragging(false), 60);
  };

  const getActionClass = () => {
    switch (action) {
      case 'lead':
        return 'mascot-lead';
      case 'lie':
        return 'mascot-lie';
      case 'sing':
        return 'mascot-sing';
      case 'cool':
        return 'mascot-cool';
      case 'dance':
        return 'mascot-dance';
      case 'think':
        return 'mascot-think';
      case 'heart':
        return 'mascot-heart';
      case 'chill':
        return 'mascot-chill';
      case 'eat':
        return 'mascot-eat';
      case 'jump':
        return 'mascot-jump';
      case 'power':
        return 'mascot-power';
      case 'battery':
        return 'mascot-battery';
      case 'spin':
        return 'mascot-spin';
      default:
        return 'mascot-idle';
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-[60] select-none touch-none"
      style={{ left: position.x, top: position.y }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {/* Speech bubble */}
      <div
        className={`absolute -top-[72px] left-1/2 -translate-x-1/2 w-max max-w-[220px] px-3 py-2 rounded-2xl bg-white/95 text-[13px] font-medium text-[#5a4a4a] shadow-lg border border-[#F7CAC9]/60 backdrop-blur-sm transition-all duration-200 pointer-events-none ${
          showBubble ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'
        }`}
      >
        <span className="block leading-snug">{bubble ? t(`mascot.action.${bubble}.bubble`) : ''}</span>
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white/95 rotate-45 border-r border-b border-[#F7CAC9]/60" />
      </div>

      {/* Mascot wrapper */}
      <button
        type="button"
        onClick={advanceAction}
        className={`relative w-[72px] h-[72px] sm:w-[86px] sm:h-[86px] cursor-grab active:cursor-grabbing transition-transform ${
          dragging ? 'scale-105' : 'hover:scale-105'
        } ${getActionClass()}`}
        aria-label={t('mascot.ariaLabel')}
        title={t('mascot.title')}
      >
        {/* Sparkles when full of energy / happy */}
        {(action === 'power' || action === 'jump') && (
          <>
            <span className="absolute -top-1 -left-1 text-sm animate-sparkle">✨</span>
            <span className="absolute -top-0.5 -right-1 text-sm animate-sparkle" style={{ animationDelay: '0.15s' }}>✨</span>
            <span className="absolute -bottom-0.5 right-2 text-xs animate-sparkle" style={{ animationDelay: '0.3s' }}>⭐</span>
          </>
        )}

        {/* Zzz when the angel is resting */}
        {action === 'lie' && (
          <>
            <span className="absolute -top-1 right-0 text-xs mascot-zzz">z</span>
            <span className="absolute -top-3 right-2 text-[10px] mascot-zzz" style={{ animationDelay: '0.6s' }}>z</span>
          </>
        )}

        <img
          src="/images/bongbong-3d.png"
          alt="蹦蹦"
          className="w-full h-full object-contain drop-shadow-xl"
          draggable={false}
        />
      </button>

      {/* Mood hint ring */}
      {!isMobile && (
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-[#9A7A82] opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {t('mascot.hint')}
        </div>
      )}
    </div>
  );
}
