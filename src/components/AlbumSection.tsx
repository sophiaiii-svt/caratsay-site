import { useState } from 'react';
import { albums, subUnitAlbums, soloAlbums } from '@/data';
import type { Album } from '@/types';
import SectionTitle from './SectionTitle';
import { useI18n } from '../i18n/LanguageContext';

const typeColors: Record<Album['type'], string> = {
  mini: 'bg-blue-100 text-blue-700',
  full: 'bg-rose-100 text-rose-700',
  repackage: 'bg-purple-100 text-purple-700',
  special: 'bg-amber-100 text-amber-700',
  best: 'bg-green-100 text-green-700',
  japanese: 'bg-cyan-100 text-cyan-700',
  subunit: 'bg-orange-100 text-orange-700',
  solo: 'bg-pink-100 text-pink-700',
};

type MainTab = 'group' | 'subunit' | 'solo';

// 个人板块按成员固定顺序排列
const SOLO_MEMBER_ORDER = ['DINO', 'WOOZI', 'HOSHI', 'THE 8', 'JUN', 'JOSHUA', 'JEONGHAN'];

export default function AlbumSection() {
  const { t, L } = useI18n();
  const [tab, setTab] = useState<MainTab>('group');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  const typeLabels: Record<Album['type'], string> = {
    mini: t('album.type.mini'),
    full: t('album.type.full'),
    repackage: t('album.type.repackage'),
    special: t('album.type.special'),
    best: t('album.type.best'),
    japanese: t('album.type.japanese'),
    subunit: t('album.type.subunit'),
    solo: t('album.type.solo'),
  };

  const badgeText = (a: Album) => (a.artist ? a.artist : typeLabels[a.type]);

  const sortByDate = (arr: Album[], asc = false): Album[] =>
    [...arr].sort((a, b) =>
      asc ? a.releaseDate.localeCompare(b.releaseDate) : b.releaseDate.localeCompare(a.releaseDate),
    );

  // 团体 / 小分队：按发行时间倒序（最新在前）
  const list =
    tab === 'group' ? sortByDate(albums) : tab === 'subunit' ? sortByDate(subUnitAlbums) : [];

  // 个人：先按成员分组，组内按时间正序（最早在前）
  const soloGroups: { artist: string; albums: Album[] }[] = (() => {
    const map = new Map<string, Album[]>();
    for (const a of soloAlbums) {
      const key = a.artist ?? 'OTHER';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    const keys = [...map.keys()].sort((x, y) => {
      const ix = SOLO_MEMBER_ORDER.indexOf(x);
      const iy = SOLO_MEMBER_ORDER.indexOf(y);
      return (ix === -1 ? 999 : ix) - (iy === -1 ? 999 : iy);
    });
    return keys.map((k) => ({ artist: k, albums: sortByDate(map.get(k)!, true) }));
  })();

  const tabs: { key: MainTab; label: string }[] = [
    { key: 'group', label: t('album.tab.seventeen') },
    { key: 'subunit', label: t('album.tab.subunit') },
    { key: 'solo', label: t('album.tab.solo') },
  ];

  const renderCard = (album: Album, idx: number) => (
    <div
      key={album.id}
      onClick={() => setSelectedAlbum(album)}
      className="group cursor-pointer animate-slide-up"
      style={{ animationDelay: `${idx * 0.04}s` }}
    >
      {/* Album cover */}
      <div
        className="aspect-square rounded-2xl shadow-md group-hover:shadow-xl transition-all duration-300 group-hover:-translate-y-1 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${album.coverColor} 0%, ${album.coverColor}cc 100%)` }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-white">
          <div className="text-white/70 text-[10px] font-medium mb-1 tracking-wider">{album.releaseDate}</div>
          <div className="text-white font-black text-sm sm:text-base leading-tight mb-2">{L(album.title)}</div>
          <div className="text-white/80 text-[10px] font-medium line-clamp-1">{t('album.titleTrack', { t: L(album.titleTrack) })}</div>
        </div>
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white text-xs font-medium px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">{t('album.detail')}</span>
        </div>
        {/* 成员 / 类型徽章 */}
        <div className="absolute top-2 left-2">
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${typeColors[album.type]}`}>
            {badgeText(album)}
          </span>
        </div>
      </div>
      {/* Album title below */}
      <p className="text-xs font-bold mt-2 text-center truncate group-hover:text-primary transition-colors">{L(album.title)}</p>
      <p className="text-[10px] text-muted-foreground text-center">{album.releaseDate}</p>
    </div>
  );

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-[#E08E9D] tracking-[0.25em] mb-2">DISCOGRAPHY</p>
          <SectionTitle tKey="section.album" />
          <p className="text-muted-foreground">{t('album.desc')}</p>
        </div>

        {/* Main tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-colors ${
                tab === tb.key
                  ? 'bg-primary text-white shadow-md'
                  : 'bg-card text-muted-foreground hover:text-foreground border border-border'
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {/* Album timeline */}
        {tab !== 'solo' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {list.map((album, idx) => renderCard(album, idx))}
          </div>
        ) : (
          <div className="space-y-10">
            {soloGroups.map((group) => (
              <div key={group.artist}>
                {/* 成员分组标题 */}
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-bold text-foreground">{group.artist}</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {group.albums.map((album, idx) => renderCard(album, idx))}
                </div>
              </div>
            ))}
          </div>
        )}

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
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeColors[selectedAlbum.type]}`}>
                    {badgeText(selectedAlbum)}
                  </span>
                  <span className="text-white/80 text-xs font-medium">{selectedAlbum.releaseDate}</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{L(selectedAlbum.title)}</h3>
                <p className="text-white/80 text-sm">{t('album.titleTrackFull', { t: L(selectedAlbum.titleTrack) })}</p>
              </div>

              {/* Body */}
              <div className="p-8">
                <p className="text-sm text-muted-foreground mb-6">{L(selectedAlbum.description)}</p>

                {selectedAlbum.photocardInfo && (
                  <>
                    <h4 className="font-bold text-sm mb-3">{t('album.config')}</h4>
                    <p className="text-sm text-muted-foreground mb-6 bg-muted/50 p-4 rounded-xl">
                      {L(selectedAlbum.photocardInfo)}
                    </p>
                  </>
                )}

                {selectedAlbum.benefits && selectedAlbum.benefits.length > 0 && (
                  <>
                    <h4 className="font-bold text-sm mb-3">{t('album.benefits')}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                      {selectedAlbum.benefits.map((benefit, idx) => (
                        <div key={idx} className="p-3 rounded-xl border border-border hover:border-primary/30 transition-colors">
                          <p className="text-xs font-bold text-primary mb-0.5">{L(benefit.store)}</p>
                          <p className="text-xs text-muted-foreground">{L(benefit.description)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Track list */}
                <h4 className="font-bold text-sm mb-3">{t('album.tracks')}</h4>
                {selectedAlbum.tracks.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-xl">{t('album.tracksTBA')}</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedAlbum.tracks.map((track, idx) => {
                      const normalizedTrack = track.toLowerCase().replace(/[\s()（）\[\]]/g, '');
                      const normalizedTitle = selectedAlbum.titleTrack.toLowerCase().replace(/[\s()（）\[\]]/g, '');
                      const isTitle = normalizedTitle === normalizedTrack ||
                        selectedAlbum.titleTrack.split('/').some((tt) => tt.trim().toLowerCase().replace(/[\s()（）\[\]]/g, '') === normalizedTrack);
                      return (
                        <div key={idx} className="flex items-center gap-3 text-sm py-1.5 px-3 rounded-lg hover:bg-muted/50">
                          <span className="text-muted-foreground w-6 text-xs">{String(idx + 1).padStart(2, '0')}</span>
                          <span className={isTitle ? 'font-bold text-primary' : ''}>{L(track)}</span>
                          {isTitle && (
                            <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">{t('album.badge')}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
