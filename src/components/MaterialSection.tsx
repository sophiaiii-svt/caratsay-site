import { useState, useMemo } from 'react';
import { members, materialItems } from '@/data';
import type { MaterialItem } from '@/types';
import SectionTitle from './SectionTitle';
import { useI18n } from '../i18n/LanguageContext';

const categoryColors: Record<MaterialItem['category'], string> = {
  official: 'bg-rose-100 text-rose-700',
  fansite: 'bg-blue-100 text-blue-700',
  video: 'bg-purple-100 text-purple-700',
  info: 'bg-green-100 text-green-700',
  photo: 'bg-amber-100 text-amber-700',
};

export default function MaterialSection() {
  const { t, L } = useI18n();
  const [activeCategory, setActiveCategory] = useState<MaterialItem['category'] | 'all'>('all');

  const categoryLabels: Record<MaterialItem['category'], string> = {
    official: t('material.type.official'),
    fansite: t('material.type.fansite'),
    video: t('material.type.video'),
    info: t('material.type.info'),
    photo: t('material.type.photo'),
  };

  const filteredItems = useMemo(() => {
    if (activeCategory === 'all') return materialItems;
    return materialItems.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  const categories: { id: MaterialItem['category'] | 'all'; label: string }[] = [
    { id: 'all', label: t('material.filter.all') },
    { id: 'official', label: t('material.type.official') },
    { id: 'fansite', label: t('material.type.fansite') },
    { id: 'video', label: t('material.type.video') },
    { id: 'info', label: t('material.type.info') },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-[#E08E9D] tracking-[0.25em] mb-2">MATERIALS</p>
          <SectionTitle tKey="section.material" />
          <p className="text-muted-foreground">{t('material.desc')}</p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? 'bg-[#F7CAC9] text-[#5a4a4a] shadow-sm'
                  : 'bg-card border border-border hover:border-primary/50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Member material cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {members.map((member) => {
            const items = filteredItems.filter((item) => item.memberId === member.id);
            if (items.length === 0) return null;
            return (
              <div
                key={member.id}
                className="bg-card rounded-2xl p-5 border border-border hover:shadow-lg transition-all"
              >
                {/* Member header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-full overflow-hidden bg-white shadow-sm border-2"
                    style={{ borderColor: member.representativeColor + '55' }}
                  >
                    <img
                      src={member.miniteenImage}
                      alt={member.stageName}
                      className="w-full h-full object-contain p-0.5"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{L(member.stageName)}</h3>
                    <p className="text-[10px] text-muted-foreground">{member.koreanName}</p>
                  </div>
                  {member.xiaohongshu && (
                    <a
                      href={member.xiaohongshu.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={L(member.xiaohongshu.description)}
                      className="ml-auto text-[10px] px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors whitespace-nowrap"
                    >
                      📕 {member.xiaohongshu.handle}
                    </a>
                  )}
                </div>

                {/* Material list */}
                <div className="space-y-2">
                  {items.map((item) => (
                    <a
                      key={item.id}
                      href={item.url || '#'}
                      target={item.url ? '_blank' : undefined}
                      rel={item.url ? 'noopener noreferrer' : undefined}
                      className="group block p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${categoryColors[item.category]}`}>
                          {categoryLabels[item.category]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">
                            {L(item.title)}
                          </p>
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {L(item.description)}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fansite note */}
        <div className="mt-12 max-w-2xl mx-auto p-5 rounded-2xl bg-muted/50 text-center">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('material.copyright')}
            <br />
            {t('material.alsoSearch')}{' '}
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Twitter</a>、
            <a href="https://weibo.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Weibo</a>、
            <a href="https://www.xiaohongshu.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{t('material.xiaohongshu')}</a>
            {' '}{t('material.xiaohongshuSearch')}
          </p>
        </div>
      </div>
    </section>
  );
}
