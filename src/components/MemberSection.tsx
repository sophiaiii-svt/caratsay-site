import { useEffect, useRef, useState } from 'react';
import { members } from '@/data';
import type { Member } from '@/types';
import SectionTitle from './SectionTitle';
import { useI18n } from '../i18n/LanguageContext';

interface MemberSectionProps {
  highlightMemberId?: string | null;
}

export default function MemberSection({ highlightMemberId }: MemberSectionProps) {
  const { t, L } = useI18n();
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (highlightMemberId && cardRefs.current[highlightMemberId]) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        const card = cardRefs.current[highlightMemberId];
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlighted(highlightMemberId);
          // Remove highlight after 3 seconds
          setTimeout(() => setHighlighted(null), 3000);
        }
      }, 300);
    }
  }, [highlightMemberId]);

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-[#E08E9D] tracking-[0.25em] mb-2">MEET THE MEMBERS</p>
          <SectionTitle tKey="section.member" />
          <p className="text-muted-foreground">{t('member.desc')}</p>
        </div>

        {/* Member cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {members.map((member: Member, idx: number) => (
            <div
              key={member.id}
              ref={(el) => { cardRefs.current[member.id] = el; }}
              className={`group bg-card rounded-3xl p-5 border-2 hover:shadow-xl transition-all hover:-translate-y-1 animate-slide-up ${
                highlighted === member.id
                  ? 'ring-4 ring-primary/40 border-primary scale-105 shadow-xl'
                  : 'border-border'
              }`}
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              {/* Top: emoji avatar + basic info */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-16 h-16 rounded-2xl shadow-sm flex-shrink-0 border-2 flex items-center justify-center text-4xl"
                  style={{
                    borderColor: member.representativeColor + '55',
                    background: `linear-gradient(135deg, ${member.representativeColor}15 0%, ${member.representativeColor}05 100%)`,
                  }}
                >
                  <span className="group-hover:scale-125 transition-transform duration-300">{member.emoji}</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-lg truncate">{L(member.stageName)}</h3>
                  <p className="text-xs text-muted-foreground truncate">{L(member.koreanName)}</p>
                  <span
                    className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ backgroundColor: member.representativeColor + '20', color: member.representativeColor }}
                  >
                    {L(member.color)}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">{t('member.birthday')}</span>
                  <span className="font-medium">{member.birthday}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">{t('member.height')}</span>
                  <span className="font-medium">{member.details.height}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">{t('member.blood')}</span>
                  <span className="font-medium">{L(member.details.bloodType)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">MBTI</span>
                  <span className="font-medium">{L(member.details.mbti)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-xs">{t('member.nationality')}</span>
                  <span className="font-medium">{L(member.details.nationality)}</span>
                </div>
              </div>

              {/* Role & TMI */}
              <div className="mt-4 pt-4 border-t border-border/60">
                <p className="text-xs font-medium mb-1">{L(member.details.role)}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{L(member.details.tmi)}</p>
              </div>

              {/* Social links */}
              <div className="mt-4 flex flex-wrap gap-2">
                {member.instagram && (
                  <a
                    href={`https://www.instagram.com/${member.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    IG @{member.instagram}
                  </a>
                )}
                {member.weibo && (
                    <a
                      href={`https://weibo.com/${member.weibo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      {t('member.weibo')}
                    </a>
                )}
                {member.xiaohongshu && (
                  <a
                    href={member.xiaohongshu.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] px-2.5 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                    title={L(member.xiaohongshu.description)}
                  >
                    {t('member.xiaohongshu')} {member.xiaohongshu.handle}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
