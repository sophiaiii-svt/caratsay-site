import { useState } from 'react';
import { albums, members } from '@/data';
import type { Album } from '@/types';
import SectionTitle from './SectionTitle';
import { useI18n } from '../i18n/LanguageContext';

const weappText = '#小程序://17次元/m5WI1RjF3CHs6Ty';

export default function PhotocardSection() {
  const { t, L } = useI18n();
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [copied, setCopied] = useState(false);

  const handleMemberClick = () => {
    // Try to open WeChat mini-program; also copy the link for manual use
    if (navigator.clipboard) {
      navigator.clipboard.writeText(weappText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-[#8FA3C7] tracking-[0.25em] mb-2">PHOTOCARD GUIDE</p>
          <SectionTitle tKey="section.photocard" />
          <p className="text-muted-foreground">HAPPY BURSTDAY / SPILL THE FEELS / 17 IS RIGHT HERE</p>
          <p className="text-xs text-muted-foreground mt-2">{t('photocard.desc')}</p>
        </div>

        {/* Album grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {albums.map((album, idx) => (
            <div
              key={album.id}
              onClick={() => setSelectedAlbum(album)}
              className="group cursor-pointer animate-slide-up"
              style={{ animationDelay: `${idx * 0.06}s` }}
            >
              <div
                className="aspect-[4/5] rounded-3xl shadow-md group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${album.coverColor} 0%, ${album.coverColor}cc 100%)` }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
                  <div className="text-white/80 text-xs font-medium mb-2 tracking-wider">{album.releaseDate}</div>
                  <div className="text-white font-black text-2xl leading-tight mb-2">{L(album.title)}</div>
                  <div className="text-white/90 text-sm font-medium">{t('photocard.titleTrack', { t: L(album.titleTrack) })}</div>
                </div>
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-sm font-medium px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm">{t('photocard.configBtn')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Member quick links */}
        <div className="bg-card rounded-3xl p-6 border border-border">
          <h3 className="text-base font-bold mb-4 text-center">{t('photocard.title')}</h3>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-13 gap-3">
            {members.map((member) => (
              <button
                key={member.id}
                onClick={handleMemberClick}
                className="group flex flex-col items-center cursor-pointer"
              >
                <div
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden bg-white shadow-sm border-2 hover:scale-110 transition-transform"
                  style={{ borderColor: member.representativeColor + '55' }}
                >
                  <img
                    src={member.miniteenImage}
                    alt={member.stageName}
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <span className="text-[10px] sm:text-xs font-medium mt-1.5 text-center">{L(member.stageName)}</span>
              </button>
            ))}
          </div>
          {copied && (
            <p className="text-center text-xs text-primary mt-3">{t('photocard.copied')}</p>
          )}
        </div>

        {/* Album detail modal */}
        {selectedAlbum && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelectedAlbum(null)}
          >
            <div
              className="bg-card rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="p-8 rounded-t-3xl relative"
                style={{ background: `linear-gradient(135deg, ${selectedAlbum.coverColor} 0%, ${selectedAlbum.coverColor}88 100%)` }}
              >
                <button
                  onClick={() => setSelectedAlbum(null)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center text-white"
                >
                  ✕
                </button>
                <div className="text-white/80 text-xs font-medium mb-2">{selectedAlbum.releaseDate}</div>
                <h3 className="text-2xl font-bold text-white mb-2">{L(selectedAlbum.title)}</h3>
                <p className="text-white/80 text-sm">{t('album.titleTrackFull', { t: L(selectedAlbum.titleTrack) })}</p>
              </div>

              {/* Body */}
              <div className="p-8">
                <p className="text-sm text-muted-foreground mb-6">{L(selectedAlbum.description)}</p>

                {/* Photocard config */}
                <h4 className="font-bold text-sm mb-3">{t('photocard.config')}</h4>
                <p className="text-sm text-muted-foreground mb-6 bg-muted/50 p-4 rounded-xl">
                  {L(selectedAlbum.photocardInfo)}
                </p>

                {/* Benefits */}
                <h4 className="font-bold text-sm mb-3">{t('photocard.benefits')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                  {selectedAlbum.benefits?.map((benefit, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-border hover:border-primary/30 transition-colors">
                      <p className="text-xs font-bold text-primary mb-0.5">{L(benefit.store)}</p>
                      <p className="text-xs text-muted-foreground">{L(benefit.description)}</p>
                    </div>
                  ))}
                </div>

                {/* Member quick jump */}
                <h4 className="font-bold text-sm mb-3">{t('photocard.byMember')}</h4>
                <div className="flex flex-wrap gap-2 mb-6">
                  {members.map((member) => (
                    <button
                      key={member.id}
                      onClick={handleMemberClick}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                    >
                      <img
                        src={member.miniteenImage}
                        alt={L(member.stageName)}
                        className="w-5 h-5 object-contain"
                      />
                      {L(member.stageName)}
                    </button>
                  ))}
                </div>

                {/* Track list */}
                <h4 className="font-bold text-sm mb-3">{t('photocard.tracks')}</h4>
                <div className="space-y-1.5">
                  {selectedAlbum.tracks.map((track, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-lg hover:bg-muted/50">
                      <span className="text-muted-foreground w-6 text-xs">{String(idx + 1).padStart(2, '0')}</span>
                      <span className={track === selectedAlbum.titleTrack ? 'font-bold text-primary' : ''}>{L(track)}</span>
                      {track === selectedAlbum.titleTrack && (
                        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t('photocard.badge')}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
