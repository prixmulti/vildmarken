
import React, { useState, useEffect } from 'react';
import { APP_ASSETS } from '../constants';

interface SplashScreenProps {
  onFinish: () => void;
}

const KEYWORDS = [
  { word: 'hede', delay: '1.2s' },
  { word: 'historie', delay: '1.35s' },
  { word: 'rewilding', delay: '1.5s' },
];

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const handleEnter = () => {
    setIsVisible(false);
    setTimeout(onFinish, 250);
  };

  const anim = (delay: string) => ({
    animationDelay: isLoaded ? delay : '0s',
  });

  return (
    <div
      className={`splash-screen fixed inset-0 z-[9999] flex flex-col transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src={APP_ASSETS.heathBanner}
          alt=""
          aria-hidden="true"
          className="splash-bg-pan"
        />
        <div className="absolute inset-0 bg-[#04110d]/5" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#04110d]/25 via-transparent to-[#04110d]/45" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(4,17,13,0.12)_100%)]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-6">
        <div className="flex flex-1 items-center justify-center">
          <div
            className="splash-card w-full max-w-[22rem] rounded-[2rem] px-7 py-9 text-center sm:max-w-md sm:px-9 sm:py-10"
            style={anim('0.55s')}
          >
            <p
              className="tagline-word text-[0.68rem] font-semibold uppercase tracking-[0.42em] text-emerald-100/75"
              style={anim('0.8s')}
            >
              Velkommen til
            </p>

            <div className="splash-rule mx-auto my-5" aria-hidden="true" />

            <img
              src={APP_ASSETS.logo}
              alt="Nørholm Vildmark"
              className="mx-auto h-[4.5rem] w-auto object-contain drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)] sm:h-24"
            />

            <div className="splash-rule mx-auto my-6" aria-hidden="true" />

            <p
              className="tagline-word text-[1.15rem] font-light leading-snug tracking-[0.01em] text-emerald-50/90 sm:text-[1.35rem]"
              style={anim('1s')}
            >
              En interaktiv lydguide gennem
            </p>

            <div className="mt-7 flex flex-col items-center gap-3.5 sm:gap-4">
              {KEYWORDS.map((item) => (
                <span
                  key={item.word}
                  className="tagline-keyword text-[1.55rem] font-medium uppercase leading-none tracking-[0.28em] text-emerald-200/95 sm:text-[1.85rem]"
                  style={anim(item.delay)}
                >
                  {item.word}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleEnter}
          disabled={!isLoaded}
          className={`splash-cta mx-auto w-full max-w-[22rem] rounded-full px-8 py-4 text-[0.95rem] font-semibold uppercase tracking-[0.22em] text-white transition-all duration-500 disabled:opacity-60 sm:max-w-sm ${
            isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
          style={anim('1.65s')}
        >
          Start turen
        </button>
      </div>
    </div>
  );
};

export default SplashScreen;
