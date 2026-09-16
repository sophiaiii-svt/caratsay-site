import { useState } from 'react';
import { tours, fanmeetings, subUnits } from '@/data';
import type { Tour } from '@/types';
import SectionTitle from './SectionTitle';
import { useI18n } from '../i18n/LanguageContext';

type Tab = 'group' | 'subunit' | 'fanmeeting';

const statusStyles = {
  ended: 'bg-muted text-muted-foreground',
  ongoing: 'bg-green-100 text-green-700',
  upcoming: 'bg-[#F7CAC9] text-[#5a4a4a]',
};

export default function ConcertSection() {
  const { t, L } = useI18n();
  const [activeTab, setActiveTab] = useState<Tab>('group');

  const statusLabels = {
    ended: t('concert.status.ended'),
    ongoing: t('concert.status.ongoing'),
    upcoming: t('concert.status.upcoming'),
  };

  const groupTours = tours.filter((t) => t.scope === 'group');
  const subunitTours = tours.filter((t) => t.scope === 'subunit');

  const getSubUnitName = (id?: string) => L(subUnits.find((u) => u.id === id)?.name) || t('concert.subunit');
  const getSubUnitColor = (id?: string) => subUnits.find((u) => u.id === id)?.color || '#92A8D1';

  const renderTourCard = (tour: Tour, idx: number, compact?: boolean) => (
    <div
      key={tour.id}
      className={`bg-card rounded-2xl border border-border hover:shadow-xl transition-all hover:-translate-y-1 animate-slide-up ${compact ? 'p-5' : 'p-6'}`}
      style={{ animationDelay: `${idx * 0.05}s` }}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {tour.scope === 'subunit' && tour.subUnitId && (
          <span
            className="px-3 py-1 rounded-full text-white text-xs font-bold"
            style={{ backgroundColor: getSubUnitColor(tour.subUnitId) }}
          >
            {getSubUnitName(tour.subUnitId)}
          </span>
        )}
        <span className="px-3 py-1 rounded-full svt-gradient text-white text-xs font-bold">{tour.year}</span>
      </div>

      <h3 className={`font-bold mb-2 ${compact ? 'text-lg' : 'text-xl'}`}>{L(tour.theme)}</h3>
      <p className={`text-muted-foreground mb-4 ${compact ? 'text-xs' : 'text-sm'}`}>{L(tour.description)}</p>

      {tour.stops.length > 0 ? (
        <div className="space-y-2 mb-4">
          {tour.stops.map((stop, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">
                  {L(stop.city)}
                  {stop.venue && <span className="text-muted-foreground font-normal"> · {L(stop.venue)}</span>}
                </p>
                <p className="text-xs text-muted-foreground">{stop.dates}</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-full font-medium flex-shrink-0 ml-2 ${statusStyles[stop.status]}`}>
                {statusLabels[stop.status]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-muted/50 text-center text-sm text-muted-foreground mb-4">
          {t('concert.empty')}
        </div>
      )}

      <a
        href={tour.link}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        {L(tour.linkLabel)}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 17l9.2-9.2M17 17V7H7" />
        </svg>
      </a>
    </div>
  );

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-[#8FA3C7] tracking-[0.25em] mb-2">CONCERT & TOUR</p>
          <SectionTitle tKey="section.concert" />
          <p className="text-muted-foreground">{t('concert.desc')}</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {[
            { id: 'group', label: t('concert.tab.group', { n: groupTours.length }) },
            { id: 'subunit', label: t('concert.tab.subunit', { n: subunitTours.length }) },
            { id: 'fanmeeting', label: `CARAT LAND (${fanmeetings.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-[#92A8D1] text-white shadow-md'
                  : 'bg-card border border-border hover:border-primary/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Group tours */}
        {activeTab === 'group' && (
          <div className="space-y-6">
            {groupTours.map((tour, idx) => renderTourCard(tour, idx))}
          </div>
        )}

        {/* Sub-unit tours */}
        {activeTab === 'subunit' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {subunitTours.map((tour, idx) => renderTourCard(tour, idx, true))}
          </div>
        )}

        {/* Fanmeetings */}
        {activeTab === 'fanmeeting' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {fanmeetings.map((fm, idx) => (
              <div
                key={fm.id}
                className="bg-card rounded-2xl p-6 border border-border hover:shadow-lg transition-all hover:-translate-y-0.5 animate-slide-up"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-3 py-1 rounded-full bg-[#F7CAC9] text-[#5a4a4a] text-xs font-bold">{fm.year}</span>
                </div>
                <h3 className="text-base font-bold mb-2">{L(fm.name)}</h3>
                <p className="text-xs text-muted-foreground mb-3">{fm.dates}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {fm.cities.map((city, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{L(city)}</span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mb-4">{L(fm.description)}</p>
                <a
                  href={fm.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {t('concert.detail')}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 17l9.2-9.2M17 17V7H7" />
                  </svg>
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Info note */}
        <div className="mt-12 max-w-2xl mx-auto p-6 rounded-2xl bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            📌 {t('concert.note')}{' '}
            <a href="https://weverse.io/seventeen" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">{t('concert.noteWeverse')}</a>
            {' '}{t('concert.noteAnd')}{' '}
            <a href="https://www.seventeen-17.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">{t('concert.noteOfficial')}</a>
            。
          </p>
        </div>
      </div>
    </section>
  );
}
