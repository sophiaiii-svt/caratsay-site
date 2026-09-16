import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/LanguageContext';
import { ANSWERS, ANSWER_COUNT } from '@/data/answerBook';

interface AnswerBookProps {
  open: boolean;
  onClose: () => void;
}

type Phase = 'input' | 'flipping' | 'result';

export default function AnswerBook({ open, onClose }: AnswerBookProps) {
  const [phase, setPhase] = useState<Phase>('input');
  const [inputValue, setInputValue] = useState('');
  const [answer, setAnswer] = useState('');
  const [shake, setShake] = useState(false);
  const { t } = useI18n();

  // Reset when opened
  useEffect(() => {
    if (open) {
      setPhase('input');
      setInputValue('');
      setAnswer('');
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phase === 'result') {
          setPhase('input');
          setInputValue('');
          setAnswer('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, phase, onClose]);

  const handleReveal = useCallback(() => {
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < 1 || num > ANSWER_COUNT) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    setPhase('flipping');
    setTimeout(() => {
      setAnswer(ANSWERS[num - 1]);
      setPhase('result');
    }, 1200);
  }, [inputValue]);

  const handleReset = useCallback(() => {
    setPhase('input');
    setInputValue('');
    setAnswer('');
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(280, 10, 15, 0.45)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(160deg, #FDF6F6 0%, #F7CAC9 40%, #E8D5DD 70%, #92A8D1 100%)',
          boxShadow: '0 20px 60px rgba(232, 85, 94, 0.25), 0 0 80px rgba(146, 168, 209, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ background: 'rgba(255,255,255,0.6)', color: '#8B4555' }}
          aria-label={t('answer.close')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        {/* Bongbong at top */}
        <div className="flex justify-center pt-6 pb-2">
          <img
            src="/images/bongbong.png"
            alt={t('answer.alt')}
            className={`w-24 h-24 object-contain ${phase === 'flipping' ? 'bongbong-flloat' : 'bongbong-float'}`}
          />
        </div>

        {/* Title */}
        <div className="text-center px-6 pb-4">
          <h2 className="text-2xl font-bold mb-1" style={{ background: 'linear-gradient(135deg, #E8555E 0%, #92A8D1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            {t('answer.title')}
          </h2>
          <p className="text-sm" style={{ color: '#9B6B7A' }}>
            {t('answer.prompt', { n: ANSWER_COUNT })}
          </p>
        </div>

        {/* Content area */}
        <div className="px-8 pb-8 min-h-[200px] flex flex-col items-center justify-center">
          {phase === 'input' && (
            <div className={`w-full flex flex-col items-center gap-4 animate-fade-in ${shake ? 'answer-shake' : ''}`}>
              <div className="flex items-center gap-2 w-full max-w-xs">
                <input
                  type="number"
                  min={1}
                  max={ANSWER_COUNT}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleReveal()}
                  placeholder={`1 - ${ANSWER_COUNT}`}
                  className="flex-1 text-center text-lg font-semibold rounded-xl px-4 py-3 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.75)',
                    border: '2px solid rgba(247, 202, 201, 0.6)',
                    color: '#5C3D4A',
                  }}
                  autoFocus
                />
              </div>
              <button
                onClick={handleReveal}
                className="px-8 py-2.5 rounded-full font-bold text-white transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #E8555E 0%, #C04555 100%)',
                  boxShadow: '0 4px 15px rgba(232, 85, 94, 0.35)',
                }}
              >
              {t('answer.open')}
          </button>
            </div>
          )}

          {phase === 'flipping' && (
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <div className="answer-book-flip relative w-20 h-28">
                <div
                  className="absolute inset-0 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(145deg, #F7CAC9 0%, #92A8D1 100%)',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                  }}
                >
                  <span className="text-3xl">📖</span>
                </div>
              </div>
              <p className="text-sm font-medium" style={{ color: '#9B6B7A' }}>
                {t('answer.loading')}
              </p>
            </div>
          )}

          {phase === 'result' && (
            <div className="flex flex-col items-center gap-5 animate-fade-in w-full">
              <div
                className="w-full rounded-2xl px-6 py-8 text-center"
                style={{
                  background: 'rgba(255,255,255,0.65)',
                  border: '2px solid rgba(247, 202, 201, 0.5)',
                  boxShadow: '0 4px 20px rgba(247, 202, 201, 0.3)',
                }}
              >
                  <p className="text-xs mb-2" style={{ color: '#B89BA5' }}>
                  {t('answer.found', { n: inputValue })}
                </p>
                <p
                  className="text-xl font-bold leading-relaxed answer-text-reveal"
                  style={{ color: '#5C3D4A' }}
                >
                  {answer}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="px-6 py-2 rounded-full font-semibold text-white transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #E8555E 0%, #C04555 100%)',
                    boxShadow: '0 4px 12px rgba(232, 85, 94, 0.3)',
                  }}
                >
                  {t('answer.again')}
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-full font-semibold transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.7)',
                    color: '#8B4555',
                    border: '1.5px solid rgba(232, 85, 94, 0.3)',
                  }}
                >
                {t('answer.close')}
          </button>
              </div>
            </div>
          )}
        </div>

        {/* Decorative dots */}
        <div className="absolute bottom-0 left-0 right-0 h-2" style={{ background: 'linear-gradient(90deg, #F7CAC9, #92A8D1)' }} />
      </div>

      <style>{`
        .answer-shake {
          animation: shake 0.4s ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(4px); }
        }
        .bongbong-flloat {
          animation: flipBong 1.2s ease-in-out infinite;
        }
        @keyframes flipBong {
          0%, 100% { transform: rotateY(0deg) translateY(0); }
          50% { transform: rotateY(180deg) translateY(-15px); }
        }
        .answer-book-flip {
          animation: bookFlip 1.2s ease-in-out infinite;
          transform-style: preserve-3d;
        }
        @keyframes bookFlip {
          0% { transform: rotateY(0deg); }
          50% { transform: rotateY(180deg); }
          100% { transform: rotateY(360deg); }
        }
        .answer-text-reveal {
          animation: textReveal 0.6s ease-out;
        }
        @keyframes textReveal {
          0% { opacity: 0; transform: scale(0.8) translateY(10px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
}
