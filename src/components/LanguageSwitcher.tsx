import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/LanguageContext';
import { LANGS, type Lang } from '@/i18n/translations';

/* 语言切换器
 * 位置：导航栏右上角（移动端亦可点）
 * 主题：💎 CARAT（克拉）应援色 + 钻石图标
 */
export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  const pick = (code: Lang) => {
    setLang(code);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('lang.title')}
        title={t('lang.title')}
        className="group flex items-center gap-1.5 rounded-full border border-[#F7CAC9]/70 bg-white/70 backdrop-blur-sm px-3 py-1.5 shadow-sm hover:shadow-md hover:border-[#E8555E]/50 transition-all"
      >
        <span className="text-[15px] leading-none drop-shadow-sm">💎</span>
        <span className="text-sm font-bold tracking-wide text-[#C2410C] group-hover:text-[#E8555E] transition-colors">
          {current.flag} {current.label}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className={`text-[#C2410C] transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-2xl bg-white/95 backdrop-blur-md border border-[#F7CAC9]/70 shadow-xl p-1.5 animate-fade-in z-[70]">
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#E8555E]/80 flex items-center gap-1">
            💎 CARAT · {t('lang.label')}
          </p>
          {LANGS.map((l) => {
            const active = l.code === lang;
            return (
              <button
                key={l.code}
                onClick={() => pick(l.code)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-[#F7CAC9] text-[#5a4a4a] shadow-sm'
                    : 'text-foreground/75 hover:bg-muted'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none">{l.flag}</span>
                  {l.label}
                </span>
                {active && <span className="text-[#E8555E]">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
