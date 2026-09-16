import { useI18n } from '@/i18n/LanguageContext';

/* 区块标题：统一接入多语言
 * 用法：<SectionTitle tKey="section.album" />
 * 需要不同样式时传入 className 覆盖。 */
export default function SectionTitle({
  tKey,
  className,
}: {
  tKey: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <h2 className={className ?? 'text-3xl sm:text-4xl font-bold mb-3 svt-gradient-text'}>
      {t(tKey)}
    </h2>
  );
}
