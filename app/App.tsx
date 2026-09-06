
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Smartphone, Monitor } from 'lucide-react';
import MapView from './components/Map';
import InfoPanel from './components/InfoPanel';
import IntroModal from './components/IntroModal';
import SplashScreen from './components/SplashScreen';
import { loadGuideData } from './services/guideData';
import { AudioPoint, Category, PolygonCoords } from './types';

const App: React.FC = () => {
  const [selectedPoint, setSelectedPoint] = useState<AudioPoint | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>('Alle');
  const [mapResetTrigger, setMapResetTrigger] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);
  const [audioPoints, setAudioPoints] = useState<AudioPoint[]>([]);
  const [forestBoundary, setForestBoundary] = useState<PolygonCoords[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchGuideData = useCallback(async () => {
    setIsLoadingData(true);
    setLoadError(null);

    try {
      const data = await loadGuideData();
      setAudioPoints(data.audioPoints);
      setForestBoundary(data.forestBoundary);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Kunne ikke indlæse lydguiden.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchGuideData();
  }, [fetchGuideData]);

  useEffect(() => {
    const checkDevice = () => {
      const ua = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const isLargeScreen = window.innerWidth > 1024;
      setIsDesktop(!isMobile && isLargeScreen);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const handleSelectPoint = useCallback((point: AudioPoint) => {
    setSelectedPoint(point);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedPoint(null);
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  const handleCategoryClick = (catName: Category) => {
    setActiveCategory(catName);
    setMapResetTrigger(prev => prev + 1);
  };

  const filteredPoints = useMemo(() => {
    if (activeCategory === 'Alle') return audioPoints;
    return audioPoints.filter(p => p.category === activeCategory);
  }, [activeCategory, audioPoints]);

  const wildNatureImgUrl = "https://naturaudio.dk/vildmarken/banner.jpg";
  const appUrl = "https://naturaudio.dk/vildmarken/app/";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(appUrl)}`;

  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-emerald-950">
        <div className="absolute inset-0 z-0">
          <img src={wildNatureImgUrl} className="w-full h-full object-cover opacity-30 blur-sm" alt="" />
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/80 to-emerald-950"></div>
        </div>

        <div className="relative z-10 w-full max-w-lg p-10 bg-white rounded-[3rem] shadow-2xl text-center mx-4">
          <div className="mb-8 flex justify-center">
            <div className="p-4 bg-emerald-50 rounded-3xl">
              <img src="https://naturaudio.dk/NaturAudio_logo.png" alt="NaturAudio" className="h-16 w-auto" />
            </div>
          </div>

          <h1 className="text-3xl font-black text-emerald-900 mb-4 leading-tight">
            Optimeret til mobil
          </h1>
          
          <p className="text-stone-600 mb-8 leading-relaxed">
            Denne lydguide er designet til at blive brugt ude i naturen med en mobiltelefon. Scan koden herunder for at åbne oplevelsen med det samme.
          </p>

          <div className="flex flex-col items-center gap-6">
            <div className="p-4 bg-white border-4 border-emerald-100 rounded-[2rem] shadow-inner">
              <img src={qrUrl} alt="QR Kode" className="w-48 h-48" />
            </div>
            
            <div className="flex items-center gap-2 text-emerald-700 font-bold bg-emerald-50 px-4 py-2 rounded-full text-sm">
              <Smartphone size={16} />
              <span>naturaudio.dk/vildmarken/app/</span>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-stone-100 flex items-center justify-center gap-8 text-stone-400">
            <div className="flex flex-col items-center gap-1">
              <Monitor size={20} className="opacity-50" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Ikke til PC</span>
            </div>
            <div className="w-px h-8 bg-stone-100"></div>
            <div className="flex flex-col items-center gap-1">
              <Smartphone size={20} className="text-emerald-600" />
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-600">Brug mobil</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (isLoadingData) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#f4f7f2] text-[#1a3a32]">
        <div className="text-center px-6">
          <p className="text-sm font-bold uppercase tracking-widest text-emerald-800">Indlæser lydguide</p>
          <p className="mt-2 text-stone-500 text-sm">Henter punkter og kortdata…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#f4f7f2] text-[#1a3a32] px-6">
        <div className="max-w-sm w-full bg-white rounded-3xl shadow-xl border border-stone-200 p-6 text-center">
          <h1 className="text-lg font-black mb-2">Kunne ikke indlæse</h1>
          <p className="text-sm text-stone-600 mb-5">{loadError}</p>
          <button
            type="button"
            onClick={fetchGuideData}
            className="w-full px-4 py-3 rounded-xl bg-emerald-800 text-white font-bold"
          >
            Prøv igen
          </button>
        </div>
      </div>
    );
  }

  const categories: { name: Category; activeColor: string; textColor: string; borderColor: string; inactiveText: string }[] = [
    { name: 'Alle', activeColor: 'bg-emerald-900', textColor: 'text-white', borderColor: 'border-emerald-900', inactiveText: 'text-emerald-900' },
    { name: 'Historie', activeColor: 'bg-[#78350f]', textColor: 'text-white', borderColor: 'border-[#78350f]', inactiveText: 'text-[#78350f]' },
    { name: 'Natur', activeColor: 'bg-emerald-800', textColor: 'text-white', borderColor: 'border-emerald-800', inactiveText: 'text-emerald-800' },
    { name: 'Rewild', activeColor: 'bg-blue-800', textColor: 'text-white', borderColor: 'border-blue-800', inactiveText: 'text-blue-800' },
  ];

  return (
    <div className="relative h-[100dvh] w-full bg-[#f4f7f2] text-[#1a3a32] font-sans select-none overflow-hidden">
      <div className="fixed top-0 left-0 right-0 z-[1001] flex flex-col pt-[env(safe-area-inset-top)] bg-emerald-900 shadow-xl">
        <header className="relative w-full h-16 overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 z-0">
            <div className="animate-header-pan h-full flex">
              <img src={wildNatureImgUrl} alt="" className="w-1/2 h-full object-cover opacity-100" />
              <img src={wildNatureImgUrl} alt="" className="w-1/2 h-full object-cover opacity-100" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/10"></div>
          </div>

          <div className="relative z-10 h-full px-5 flex justify-center items-center">
            <img 
              src="https://naturaudio.dk/vildmarken/Norholm_Vildmark.png" 
              alt="Nørholm Vildmark" 
              className="h-11 w-auto block object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]"
            />
          </div>
        </header>

        <div className="w-full px-2 py-2 flex justify-center gap-1 bg-black/10 backdrop-blur-md border-b border-black/20">
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => handleCategoryClick(cat.name)}
              className={`flex-1 max-w-[80px] py-1.5 rounded-[4px] text-[9px] font-black uppercase tracking-tight transition-all active:scale-95 border-2 ${
                activeCategory === cat.name 
                ? `${cat.activeColor} ${cat.textColor} ${cat.borderColor} shadow-lg scale-[1.02]` 
                : `bg-white/10 text-white/90 border-white/20`
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <main className="absolute inset-0 z-0">
        <MapView 
          points={filteredPoints}
          forestBoundary={forestBoundary}
          onSelectPoint={handleSelectPoint} 
          onOpenIntro={() => setIsIntroOpen(true)}
          onLocationUpdate={setUserLocation}
          activePointId={selectedPoint?.id}
          resetTrigger={mapResetTrigger}
        />
      </main>

      <InfoPanel 
        point={selectedPoint} 
        userLocation={userLocation}
        onClose={handleClosePanel} 
      />
      {isIntroOpen && <IntroModal onClose={() => setIsIntroOpen(false)} />}
    </div>
  );
};

export default App;
