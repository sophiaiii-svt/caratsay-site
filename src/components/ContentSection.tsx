import { useState } from 'react';
import { members, wvsContent, tiktokContent, instagramContent, twitterContent, groupContent, fansiteGuide } from '@/data';
import type { ContentSource } from '@/types';
import { useI18n } from '../i18n/LanguageContext';

type Platform = 'wvs' | 'tiktok' | 'instagram' | 'twitter' | 'group';

function getContent(platform: Platform): ContentSource[] {
  switch (platform) {
    case 'wvs': return wvsContent;
    case 'tiktok': return tiktokContent;
    case 'instagram': return instagramContent;
    case 'twitter': return twitterContent;
    case 'group': return groupContent;
  }
}

export default function ContentSection() {
  const { t, L } = useI18n();
  const [activePlatform, setActivePlatform] = useState<Platform>('wvs');
  const [activeMember, setActiveMember] = useState<string>('all');
  const [showFansiteGuide, setShowFansiteGuide] = useState(false);

  const allContent = getContent(activePlatform);
  const memberContent = activeMember === 'all'
    ? allContent
    : allContent.filter((c) => !c.memberId || c.memberId === activeMember || (activePlatform === 'group' && !c.memberId));

  const platformTabs: { id: Platform; label: string; icon: string; color: string }[] = [
    { id: 'wvs', label: 'WVS (Weverse)', icon: '💬', color: '#00C7AE' },
    { id: 'tiktok', label: t('content.platform.tiktok'), icon: '🎵', color: '#FF0050' },
    { id: 'instagram', label: 'Instagram', icon: '📷', color: '#E4405F' },
    { id: 'twitter', label: t('content.platform.twitter'), icon: '𝕏', color: '#1D1D1D' },
    { id: 'group', label: t('content.platform.group'), icon: '🌟', color: '#92A8D1' },
  ];

  const platformInfo = platformTabs.find((tab) => tab.id === activePlatform)!;

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-4xl font-bold mb-3 svt-gradient-text">{t('content.title')}</h2>
          <p className="text-muted-foreground">{t('content.desc')}</p>
        </div>

        {/* Platform tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          {platformTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActivePlatform(tab.id); setActiveMember('all'); }}
              className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                activePlatform === tab.id
                  ? 'text-white shadow-lg scale-105'
                  : 'bg-card border border-border hover:border-primary/50'
              }`}
              style={activePlatform === tab.id ? { backgroundColor: tab.color } : {}}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Member filter - for non-group platforms */}
        {activePlatform !== 'group' && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-8">
            <button
              onClick={() => setActiveMember('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeMember === 'all' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border hover:border-primary/50'
              }`}
            >
              {t('content.filter.all')}
            </button>
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => setActiveMember(member.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  activeMember === member.id
                    ? 'text-white shadow-md'
                    : 'bg-card border border-border hover:border-primary/50'
                }`}
                style={activeMember === member.id ? { backgroundColor: member.representativeColor } : {}}
              >
                <span>{member.emoji}</span>
                <span>{L(member.stageName)}</span>
              </button>
            ))}
          </div>
        )}

        {/* Content cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {memberContent.map((item, idx) => {
            const member = item.memberId ? members.find((m) => m.id === item.memberId) : null;
            return (
              <a
                key={idx}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-card rounded-2xl p-5 border border-border hover:shadow-lg transition-all hover:-translate-y-0.5 animate-fade-in"
                style={{ animationDelay: `${idx * 0.03}s` }}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: (member?.representativeColor || platformInfo.color) + '22' }}
                  >
                    {member ? member.emoji : platformInfo.icon}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{L(item.title)}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{L(item.description)}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: platformInfo.color + '22', color: platformInfo.color }}
                      >
                        {platformInfo.label.split(' ')[0]}
                      </span>
                      {member && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: member.representativeColor + '22', color: member.representativeColor }}
                        >
                          {member.stageName}
                        </span>
                      )}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground ml-auto group-hover:text-primary transition-colors">
                        <path d="M7 17l9.2-9.2M17 17V7H7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Group platform: fansite guide */}
        {activePlatform === 'group' && (
          <div className="mt-8">
            <button
              onClick={() => setShowFansiteGuide(!showFansiteGuide)}
              className="w-full text-left bg-card rounded-2xl p-6 border border-border hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base mb-1">📸 {L(fansiteGuide.title)}</h3>
                  <p className="text-sm text-muted-foreground">{L(fansiteGuide.description)}</p>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showFansiteGuide ? 'rotate-180' : ''}`}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </button>
            {showFansiteGuide && (
              <div className="mt-4 p-6 rounded-2xl bg-card border border-border animate-fade-in">
                <div className="mb-4 p-3 rounded-xl bg-yellow-50 border border-yellow-200 text-xs text-yellow-800">
                  {L(fansiteGuide.note)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {fansiteGuide.platforms.map((p) => (
                    <a
                      key={p.name}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 rounded-xl border border-border hover:border-primary/50 transition-all group"
                    >
                      <h4 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">{L(p.name)}</h4>
                      <p className="text-xs text-muted-foreground">{L(p.description)}</p>
                    </a>
                  ))}
                </div>
                {/* Member fansite quick links */}
                <h4 className="font-bold text-sm mt-6 mb-3">{t('content.fansiteSearch')}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {members.map((member) => (
                    <a
                      key={member.id}
                      href={`https://twitter.com/search?q=${encodeURIComponent(`#${member.stageName} #세븐틴`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center p-3 rounded-xl border border-border hover:shadow-md transition-all group"
                      style={{ borderColor: member.representativeColor + '44' }}
                    >
                      <span className="text-2xl mb-1">{member.emoji}</span>
                      <span className="text-xs font-medium group-hover:text-primary transition-colors">{member.stageName}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
