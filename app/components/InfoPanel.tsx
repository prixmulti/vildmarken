
import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, MapPin } from 'lucide-react';
import { AudioPoint } from '../types';

interface InfoPanelProps {
  point: AudioPoint | null;
  userLocation: [number, number] | null;
  onClose: () => void;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const InfoPanel: React.FC<InfoPanelProps> = ({ point, userLocation, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasAudio = Boolean(point?.audioSrc);
  const hasImage = Boolean(point?.imageSrc);

  useEffect(() => {
    if (!point || !hasAudio) {
      if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false); }
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = point.audioSrc;
      audioRef.current.load();
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    }
  }, [point, hasAudio]);

  const togglePlay = () => {
    if (!audioRef.current || !hasAudio) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(console.error);
    setIsPlaying(!isPlaying);
  };

  const onTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration;
    setCurrentTime(cur);
    setDuration(dur || 0);
    setProgress((cur / dur) * 100 || 0);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!point) return null;

  const distance = userLocation && point
    ? Math.round(calculateDistance(userLocation[0], userLocation[1], point.lat, point.lng))
    : null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-[2000] bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out transform flex flex-col overflow-hidden ${point ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}
      style={{ maxHeight: '85vh' }}
    >
      {!hasAudio ? null : (
        <audio
          ref={audioRef}
          onTimeUpdate={onTimeUpdate}
          onEnded={() => setIsPlaying(false)}
          onLoadedMetadata={onTimeUpdate}
        />
      )}

      {hasImage ? (
        <div className="relative shrink-0">
          <img
            src={point.imageSrc}
            alt={point.title}
            className="aspect-video w-full object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/95 text-stone-700 shadow-md shrink-0"
            aria-label="Luk"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <div className="flex justify-center p-3 cursor-pointer shrink-0" onClick={onClose}>
          <div className="w-10 h-1 bg-stone-200 rounded-full" />
        </div>
      )}

      <div className="px-6 shrink-0">
        {hasImage ? (
          <h2 className="text-xl font-black text-[#1a3a32] leading-tight text-center mt-4 mb-4">
            {point.title}
          </h2>
        ) : (
          <div className="flex justify-between items-start mb-4 pt-1">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-black text-[#1a3a32] leading-tight">{point.title}</h2>
            </div>
            <button onClick={onClose} className="p-2 rounded-full bg-stone-100 text-stone-600 shrink-0">
              <X size={18} />
            </button>
          </div>
        )}

        {hasAudio ? (
          <div className="mb-4 flex justify-center">
            <div className="w-full max-w-[260px] bg-[#1a3a32] rounded-full px-3 py-2.5 text-white shadow-lg">
              <div className="flex items-center gap-2.5 min-h-[40px]">
                <button
                  onClick={togglePlay}
                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-white text-[#1a3a32]"
                >
                  {isPlaying ? (
                    <Pause size={14} fill="currentColor" />
                  ) : (
                    <Play size={14} fill="currentColor" className="ml-0.5" />
                  )}
                </button>
                <div className="relative flex-1 min-w-0 h-10">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/15 rounded-full overflow-hidden">
                    <div
                      className="absolute left-0 top-0 h-full bg-white rounded-full transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 flex justify-between items-center text-[9px] font-bold text-white/45 tabular-nums">
                    <span className="text-white/70">{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="px-6 flex-1 overflow-y-auto scrollbar-hide py-2 min-h-0">
        <p className="text-stone-700 leading-relaxed text-[15px] text-center">{point.description}</p>
      </div>

      <div className="px-6 pb-6 pt-3 shrink-0">
        {distance !== null ? (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-stone-100">
            <MapPin size={12} className="text-emerald-600 opacity-60" />
            <span className="text-[11px] font-bold text-stone-400 tracking-wider uppercase">
              Du er <span className="text-emerald-700">{distance} meter</span> væk (fugleflugtslinie)
            </span>
          </div>
        ) : (
          <div className="py-2" />
        )}
      </div>
    </div>
  );
};

export default InfoPanel;
