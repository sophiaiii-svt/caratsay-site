import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DICTS, DEFAULT_LANG, type Lang } from './translations';
import { DATA_DICTS } from './dataDicts';

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** 取文案：当前语言缺失时回退中文，再回退键名。支持 {name} 占位符插值 */
  t: (key: string, params?: Record<string, string | number | undefined>) => string;
  /** 数据层内容翻译：以中文原文为键查数据字典，未命中回退原文 */
  L: (value?: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = 'svt_lang';

function readInitial(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && saved in DICTS) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitial);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    // 同步 <html lang> 属性，利于无障碍与 SEO
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang: setLangState,
      t: (key: string, params?: Record<string, string | number | undefined>) => {
        let s = DICTS[lang][key] ?? DICTS.zh[key] ?? key;
        if (params) {
          for (const [k, v] of Object.entries(params)) {
            s = s.split('{' + k + '}').join(v == null ? '' : String(v));
          }
        }
        return s;
      },
      L: (value?: string) => {
        if (value == null || value === '') return value ?? '';
        if (lang === 'zh') return value;
        return DATA_DICTS[lang][value] ?? value;
      },
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}
