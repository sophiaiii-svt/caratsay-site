import { members, subUnits } from '@/data';
import SectionTitle from './SectionTitle';
import { useI18n } from '../i18n/LanguageContext';

export default function SubUnitSection() {
  const { t, L } = useI18n();
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-[#8FA3C7] tracking-[0.25em] mb-2">SPECIAL UNITS</p>
          <SectionTitle tKey="section.subunit" />
          <p className="text-muted-foreground">{t('subunit.desc')}</p>
        </div>

        {/* Sub-unit cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {subUnits.map((unit, idx) => {
            const unitMembers = unit.members.map((id) => members.find((m) => m.id === id)!).filter(Boolean);
            return (
              <div
                key={unit.id}
                className="bg-card rounded-3xl p-6 border border-border hover:shadow-xl transition-all hover:-translate-y-1 animate-slide-up"
                style={{ animationDelay: `${idx * 0.06}s` }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-2xl font-black" style={{ color: unit.color }}>{L(unit.name)}</h3>
                      <span className="text-xs text-muted-foreground font-medium">{L(unit.fullName)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{t('subunit.debut', { d: L(unit.debut) })}</p>
                  </div>
                  <div className="flex -space-x-2">
                    {unitMembers.map((m) => (
                      <div
                        key={m.id}
                        className="w-10 h-10 rounded-full overflow-hidden bg-white border-2 border-white shadow-sm"
                        title={L(m.stageName)}
                      >
                        <img src={m.miniteenImage} alt={L(m.stageName)} className="w-full h-full object-contain p-0.5" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{L(unit.description)}</p>

                {/* Albums */}
                <div className="mb-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60 mb-2">{t('subunit.albums')}</h4>
                  <div className="flex flex-wrap gap-2">
                    {unit.albums.map((album) => (
                      <span
                        key={album.title}
                        className="text-xs px-3 py-1.5 rounded-full font-medium"
                        style={{ backgroundColor: unit.color + '15', color: unit.color }}
                      >
                        {L(album.title)} ({album.releaseDate})
                      </span>
                    ))}
                  </div>
                </div>

                {/* Concerts */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/60 mb-2">{t('subunit.concerts')}</h4>
                  <div className="space-y-2">
                    {unit.concerts.map((concert, cidx) => {
                      const isUpcoming = concert.status === 'upcoming';
                      return (
                        <div
                          key={cidx}
                          className={`text-sm p-3 rounded-xl ${concert.status === 'none' ? 'bg-muted/50 text-muted-foreground' : isUpcoming ? 'bg-muted border' : 'bg-muted'}`}
                          style={isUpcoming ? { borderColor: unit.color } : undefined}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold">{L(concert.name)}</span>
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                              {isUpcoming && (
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                  style={{ backgroundColor: unit.color + '22', color: unit.color }}
                                >
                                  {t('subunit.upcoming')}
                                </span>
                              )}
                              {concert.dates}
                            </span>
                          </div>
                          {concert.status === 'none' ? (
                            <span className="text-xs">{t('subunit.empty')}</span>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              {concert.cities.map((c) => L(c)).join(' / ')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
