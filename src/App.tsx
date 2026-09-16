import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/LanguageContext';
import { startVersionGuard } from '@/lib/versionGuard';
import './App.css';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import MemberSection from '@/components/MemberSection';
import CountdownSection from '@/components/CountdownSection';
import UpdatesSection from '@/components/UpdatesSection';
import AlbumSection from '@/components/AlbumSection';
import SubUnitSection from '@/components/SubUnitSection';
import MiniteenSection from '@/components/MiniteenSection';
import PhotocardSection from '@/components/PhotocardSection';
import ConcertSection from '@/components/ConcertSection';
import DaysMatterSection from '@/components/DaysMatterSection';
import QuotesSection from '@/components/QuotesSection';
import VarietySection from '@/components/VarietySection';
import MaterialSection from '@/components/MaterialSection';
import CaratSaySection from '@/components/CaratSaySection';
import AnswerBook from '@/components/AnswerBook';
import Footer from '@/components/Footer';
import FloatingMascot from '@/components/FloatingMascot';

function App() {
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState('home');
  const [highlightMemberId, setHighlightMemberId] = useState<string | null>(null);
  const [answerBookOpen, setAnswerBookOpen] = useState(false);
  const sectionRefs = {
    home: useRef<HTMLDivElement>(null),
    countdown: useRef<HTMLDivElement>(null),
    updates: useRef<HTMLDivElement>(null),
    album: useRef<HTMLDivElement>(null),
    subunit: useRef<HTMLDivElement>(null),
    miniteen: useRef<HTMLDivElement>(null),
    concert: useRef<HTMLDivElement>(null),
    material: useRef<HTMLDivElement>(null),
    daysmatter: useRef<HTMLDivElement>(null),
    quotes: useRef<HTMLDivElement>(null),
    variety: useRef<HTMLDivElement>(null),
    photocard: useRef<HTMLDivElement>(null),
    caratsay: useRef<HTMLDivElement>(null),
  };

  const handleNavigate = (id: string) => {
    setActiveSection(id);
    const ref = sectionRefs[id as keyof typeof sectionRefs];
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleMemberClick = (memberId: string) => {
    // Scroll to the member section area (which is part of the home section)
    const memberSection = document.querySelector('[data-member-section]');
    if (memberSection) {
      memberSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // Set highlight after scroll starts
    setHighlightMemberId(memberId);
  };

  /* 版本守卫：发现线上已发布新版本时自动刷新一次。
     避免手机 / 电脑长期停在旧代码上，导致一端按旧结构写数据、另一端读不到。 */
  useEffect(() => startVersionGuard(), []);

  // Update active section on scroll (throttled with rAF)
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const scrollY = window.scrollY + 120;
        for (const [id, ref] of Object.entries(sectionRefs)) {
          if (ref.current) {
            const top = ref.current.offsetTop;
            const bottom = top + ref.current.offsetHeight;
            if (scrollY >= top && scrollY < bottom) {
              setActiveSection(id);
              break;
            }
          }
        }
        ticking = false;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar activeSection={activeSection} onNavigate={handleNavigate} />
      <FloatingMascot />

      <div ref={sectionRefs.home}>
        <Hero onMemberClick={handleMemberClick} />
        <div data-member-section>
          <MemberSection highlightMemberId={highlightMemberId} />
        </div>
      </div>

      <div ref={sectionRefs.countdown}>
        <CountdownSection />
      </div>

      <div ref={sectionRefs.daysmatter}>
        <DaysMatterSection />
      </div>

      <div ref={sectionRefs.quotes}>
        <QuotesSection />
      </div>

      <div ref={sectionRefs.updates}>
        <UpdatesSection />
      </div>

      <div ref={sectionRefs.album}>
        <AlbumSection />
      </div>

      <div ref={sectionRefs.subunit}>
        <SubUnitSection />
      </div>

      <div ref={sectionRefs.miniteen}>
        <MiniteenSection />
      </div>

      <div ref={sectionRefs.concert}>
        <ConcertSection />
      </div>

      <div ref={sectionRefs.material}>
        <MaterialSection />
      </div>

      <div ref={sectionRefs.variety}>
        <VarietySection />
      </div>

      <div ref={sectionRefs.photocard}>
        <PhotocardSection />
      </div>

      <div ref={sectionRefs.caratsay}>
        <CaratSaySection />
      </div>

      <Footer />

      {/* Bongbong floating mascot — opens Answer Book */}
      <button
        onClick={() => setAnswerBookOpen(true)}
        className="fixed bottom-5 right-5 z-40 w-16 h-16 sm:w-20 sm:h-20 hover:scale-110 transition-transform group"
        title={t('answer.title')}
        aria-label={t('answer.title')}
      >
        <img
          src="/images/bongbong.png"
          alt="bongbong"
          className="w-full h-full object-contain bongbong-float drop-shadow-lg"
        />
        <span className="absolute -top-1 -right-1 bg-[#E8555E] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          {t('mascot.tooltip')}
        </span>
      </button>

      <AnswerBook open={answerBookOpen} onClose={() => setAnswerBookOpen(false)} />
    </div>
  );
}

export default App;
