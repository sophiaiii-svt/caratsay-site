import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar({ activeSection, onNavigate }: { activeSection: string; onNavigate: (id: string) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();

  const navItems = [
    { id: 'home', key: 'nav.home' },
    { id: 'countdown', key: 'nav.countdown' },
    { id: 'daysmatter', key: 'nav.daysmatter' },
    { id: 'quotes', key: 'nav.quotes' },
    { id: 'updates', key: 'nav.updates' },
    { id: 'album', key: 'nav.album' },
    { id: 'subunit', key: 'nav.subunit' },
    { id: 'miniteen', key: 'nav.miniteen' },
    { id: 'concert', key: 'nav.concert' },
    { id: 'material', key: 'nav.material' },
    { id: 'variety', key: 'nav.variety' },
    { id: 'photocard', key: 'nav.photocard' },
    { id: 'caratsay', key: 'nav.caratsay' },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = (id: string) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={() => handleClick('home')} className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:scale-110 transition-transform svt-gradient">
              17
            </div>
            <span className="hidden sm:block font-bold text-lg svt-gradient-text tracking-tight">SEVENTEEN</span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                className={`px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  activeSection === item.id
                    ? 'bg-[#F7CAC9] text-[#5a4a4a] shadow-sm'
                    : 'text-foreground/70 hover:text-foreground hover:bg-muted'
                }`}
              >
                {t(item.key)}
              </button>
            ))}
          </div>

          {/* Right cluster: Language switcher + Mobile menu */}
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-muted"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {mobileOpen ? (
                  <path d="M18 6L6 18M6 6l12 12" />
                ) : (
                  <path d="M3 12h18M3 6h18M3 18h18" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="lg:hidden pb-4 grid grid-cols-2 gap-1 animate-fade-in">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleClick(item.id)}
                className={`px-4 py-3 rounded-xl text-sm font-medium text-left transition-all ${
                  activeSection === item.id
                    ? 'bg-[#F7CAC9] text-[#5a4a4a]'
                    : 'text-foreground/70 hover:bg-muted'
                }`}
              >
                {t(item.key)}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
