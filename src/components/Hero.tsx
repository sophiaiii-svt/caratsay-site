import { officialAccounts, members } from '@/data';
import type { Member } from '@/types';
import { useI18n } from '@/i18n/LanguageContext';

interface HeroProps {
  onMemberClick?: (memberId: string) => void;
}

export default function Hero({ onMemberClick }: HeroProps) {
  const { t } = useI18n();
  // Display order matching reference image: first 11 in one row, Vernon & Dino centered below
  const mainRow = members.slice(0, 11);
  const secondRow = members.slice(11);

  const handleMemberClick = (memberId: string) => {
    if (onMemberClick) {
      onMemberClick(memberId);
    }
  };

  const renderMemberIcon = (member: Member, idx: number) => (
    <button
      key={member.id}
      onClick={() => handleMemberClick(member.id)}
      className="group flex flex-col items-center animate-slide-up cursor-pointer"
      style={{ animationDelay: `${idx * 0.04}s` }}
    >
      <div
        className="w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] rounded-full shadow-md hover:shadow-xl hover:scale-110 transition-all duration-300 border-2 flex items-center justify-center text-3xl sm:text-4xl"
        style={{
          borderColor: member.representativeColor + '55',
          background: `linear-gradient(135deg, ${member.representativeColor}15 0%, ${member.representativeColor}05 100%)`,
        }}
      >
        <span className="group-hover:scale-125 transition-transform duration-300">{member.emoji}</span>
      </div>
      <p className="text-[10px] sm:text-xs text-center mt-2 font-bold text-foreground/85 group-hover:text-primary transition-colors">{member.stageName}</p>
    </button>
  );

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-20 pb-12">
      {/* Background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full bg-[#F7CAC9] opacity-40 blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-[450px] h-[450px] rounded-full bg-[#92A8D1] opacity-35 blur-3xl" />
        <div className="absolute -bottom-20 left-1/4 w-[400px] h-[400px] rounded-full bg-[#F7CAC9] opacity-30 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full text-center">
        {/* Tag */}
        <p className="text-xs sm:text-sm font-bold text-[#E08E9D] tracking-[0.35em] mb-4">{t('hero.tag')}</p>

        {/* Title */}
        <h1 className="text-6xl sm:text-8xl md:text-9xl font-black mb-4 svt-gradient-text tracking-tight leading-none">
          SEVENTEEN
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-1">
          {t('hero.subtitle')}
        </p>
        <p className="text-sm text-muted-foreground mb-12">
          {t('hero.debut')}
        </p>

        {/* Member emoji icons */}
        <div className="flex flex-col items-center gap-4 mb-8">
          {/* Main row */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {mainRow.map((member, idx) => renderMemberIcon(member, idx))}
          </div>
          {/* Second row: Vernon & Dino */}
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            {secondRow.map((member, idx) => renderMemberIcon(member, idx + 11))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mb-10">{t('hero.clickHint')}</p>

        {/* Official SNS */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-16">
          {officialAccounts.map((acc) => (
            <a
              key={acc.platform}
              href={acc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-full bg-white/70 backdrop-blur-sm border border-border/60 text-xs sm:text-sm font-medium hover:border-primary hover:text-primary transition-all flex items-center gap-1.5 shadow-sm"
            >
              <span>{acc.icon}</span>
              <span>{acc.platform}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground/70">
          <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
        </svg>
      </div>
    </section>
  );
}
