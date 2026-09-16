import { useState, useEffect } from 'react';
import { members, miniteenItems } from '@/data';
import type { MiniteenItem } from '@/types';
import SectionTitle from './SectionTitle';
import { useI18n } from '../i18n/LanguageContext';

interface BongBong {
  id: number;
  x: number;
  y: number;
}

export default function MiniteenSection() {
  const { t, L } = useI18n();
  const [bongbongs, setBongbongs] = useState<BongBong[]>([]);
  const [bongId, setBongId] = useState(0);
  const [selectedChar, setSelectedChar] = useState<MiniteenItem | null>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 避免在交互元素（链接、按钮、输入框）上触发
      if (
        target.closest('a') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select') ||
        target.closest('[role="button"]')
      ) {
        return;
      }
      const newBong = { id: bongId, x: e.clientX, y: e.clientY };
      setBongbongs((prev) => [...prev, newBong]);
      setBongId((id) => id + 1);
      setTimeout(() => {
        setBongbongs((prev) => prev.filter((b) => b.id !== newBong.id));
      }, 900);
    };

    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [bongId]);

  const characters = miniteenItems.filter((item) => item.category === 'character');
  const merchItems = miniteenItems.filter((item) => item.category === 'merch');

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white/50 relative">
      {/* Bongbong click effect */}
      {bongbongs.map((bong) => (
        <img
          key={bong.id}
          src="/images/bongbong.png"
          alt="bongbong"
          className="fixed pointer-events-none z-[100] w-16 h-16 object-contain animate-bongbong"
          style={{ left: bong.x - 32, top: bong.y - 32 }}
        />
      ))}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-[#E08E9D] tracking-[0.25em] mb-2">MINITEEN</p>
          <SectionTitle tKey="section.miniteen" />
          <p className="text-muted-foreground">{t('miniteen.desc')}</p>
          <p className="text-xs text-muted-foreground mt-2">{t('miniteen.hint')}</p>
        </div>

        {/* 13 characters */}
        <div className="mb-14">
          <h3 className="text-lg font-bold mb-5 text-center">{t('miniteen.charsTitle')}</h3>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-13 gap-3">
            {characters.map((char, idx) => {
              const member = members.find((m) => m.id === char.memberId);
              return (
                <button
                  key={char.id}
                  onClick={() => setSelectedChar(char)}
                  className="group flex flex-col items-center animate-fade-in cursor-pointer"
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white shadow-md overflow-hidden border border-border hover:shadow-lg hover:scale-110 transition-all flex items-center justify-center">
                    <img
                      src={member?.miniteenImage}
                      alt={L(char.characterName) || L(char.title)}
                      className="w-[82%] h-[82%] object-contain"
                    />
                  </div>
                  <p className="text-[10px] sm:text-xs font-bold mt-2 text-center group-hover:text-primary transition-colors">
                    {L(char.characterName) || L(char.title)}
                  </p>
                  {char.characterSpecies && (
                    <p className="text-[9px] text-muted-foreground text-center mt-0.5">{L(char.characterSpecies)}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Merch */}
        <div>
          <h3 className="text-lg font-bold mb-5 text-center">{t('miniteen.goodsTitle')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {merchItems.map((item, idx) => (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-card rounded-2xl p-5 border border-border hover:shadow-lg transition-all hover:-translate-y-0.5 animate-fade-in"
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className="w-12 h-12 rounded-xl svt-gradient flex items-center justify-center text-white text-xl mb-3 shadow-sm">
                  🎁
                </div>
                <h4 className="font-bold text-sm mb-1 group-hover:text-primary transition-colors">{L(item.title)}</h4>
                <p className="text-xs text-muted-foreground">{L(item.description)}</p>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Character intro modal */}
      {selectedChar && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedChar(null)}
        >
          <div
            className="bg-card rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="p-8 rounded-t-3xl relative flex items-center gap-4"
              style={{
                background: `linear-gradient(135deg, ${
                  members.find((m) => m.id === selectedChar.memberId)?.representativeColor || '#E08E9D'
                } 0%, ${(members.find((m) => m.id === selectedChar.memberId)?.representativeColor || '#E08E9D')}88 100%)`,
              }}
            >
              <button
                onClick={() => setSelectedChar(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/30 hover:bg-white/50 flex items-center justify-center text-white"
              >
                ✕
              </button>
              <div className="w-20 h-20 rounded-full bg-white/90 shadow-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                <img
                  src={members.find((m) => m.id === selectedChar.memberId)?.miniteenImage}
                  alt={L(selectedChar.characterName)}
                  className="w-[85%] h-[85%] object-contain"
                />
              </div>
              <div className="text-white">
                <h3 className="text-2xl font-bold mb-1">{L(selectedChar.characterName)}</h3>
                <p className="text-white/80 text-sm">
                  {t('miniteen.charInfo', { name: L(selectedChar.characterSpecies), member: L(selectedChar.title) })}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-4">
              {/* Intro */}
              <p className="text-sm text-foreground/90 leading-relaxed">{L(selectedChar.characterIntro)}</p>

              {/* Detail grid */}
              <div className="grid grid-cols-2 gap-3">
                {selectedChar.characterMbti && (
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">MBTI</p>
                    <p className="text-sm font-bold">{selectedChar.characterMbti}</p>
                  </div>
                )}
                {selectedChar.characterSpecies && (
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{t('miniteen.species')}</p>
                    <p className="text-sm font-bold">{L(selectedChar.characterSpecies)}</p>
                  </div>
                )}
                {selectedChar.characterResidence && (
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{t('miniteen.habitat')}</p>
                    <p className="text-sm font-bold">{L(selectedChar.characterResidence)}</p>
                  </div>
                )}
                {selectedChar.characterFavoriteFood && (
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{t('miniteen.food')}</p>
                    <p className="text-sm font-bold">{L(selectedChar.characterFavoriteFood)}</p>
                  </div>
                )}
                {selectedChar.characterFavoriteSong && (
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{t('miniteen.music')}</p>
                    <p className="text-sm font-bold">{L(selectedChar.characterFavoriteSong)}</p>
                  </div>
                )}
                {selectedChar.characterHobby && (
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{t('miniteen.hobby')}</p>
                    <p className="text-sm font-bold">{L(selectedChar.characterHobby)}</p>
                  </div>
                )}
              </div>

              {/* Special traits */}
              {selectedChar.characterSpecial && (
                <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                  <p className="text-[10px] font-bold text-primary mb-1">{t('miniteen.power')}</p>
                  <p className="text-xs text-foreground/80 leading-relaxed">{L(selectedChar.characterSpecial)}</p>
                </div>
              )}

              {/* Dislikes */}
              {selectedChar.characterDislikes && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-0.5">{t('miniteen.hate')}</p>
                  <p className="text-xs text-foreground/70">{L(selectedChar.characterDislikes)}</p>
                </div>
              )}

              {/* Member IG link */}
              {selectedChar.memberId && members.find((m) => m.id === selectedChar.memberId)?.instagram && (
                <a
                  href={`https://www.instagram.com/${members.find((m) => m.id === selectedChar.memberId)?.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  📷 {t('miniteen.instagram', { title: L(selectedChar.title) })}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
