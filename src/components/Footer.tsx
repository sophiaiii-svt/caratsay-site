import { members, officialAccounts } from '@/data';
import { useI18n } from '@/i18n/LanguageContext';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-border bg-card">
      <div className="max-w-7xl mx-auto">
        {/* Member Instagram links */}
        <div className="mb-8">
          <h3 className="text-center text-sm font-bold mb-4 text-muted-foreground">{t('footer.memberIg')}</h3>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {members.map((member) => (
              <a
                key={member.id}
                href={member.instagram ? `https://www.instagram.com/${member.instagram}` : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-all text-xs font-medium flex items-center gap-1.5"
              >
                <span className="text-base">{member.emoji}</span>
                <span>{member.stageName}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Official platforms */}
        <div className="mb-8">
          <h3 className="text-center text-sm font-bold mb-4 text-muted-foreground">{t('footer.official')}</h3>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {officialAccounts.map((acc) => (
              <a
                key={acc.platform}
                href={acc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-full bg-muted/60 hover:bg-primary hover:text-primary-foreground transition-all text-xs font-medium flex items-center gap-1.5"
              >
                <span>{acc.icon}</span>
                <span>{acc.platform}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px svt-gradient opacity-20 mb-8" />

        {/* Info */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-8 h-8 svt-gradient rounded-full flex items-center justify-center text-white font-bold text-xs">
              17
            </div>
            <span className="font-bold svt-gradient-text">SEVENTEEN Fan Blog</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
            {t('footer.desc')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('footer.slogan')}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-4">
            {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}
