import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/LanguageContext';

export default function LazyImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground text-[11px] bg-muted/40">
        <span className="text-lg">🖼️</span>
        <span>{t('common.loadFailed')}</span>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-pink-100/60 to-blue-100/60" />
      )}
      <img
        src={src}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        className={`${className} transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  );
}
