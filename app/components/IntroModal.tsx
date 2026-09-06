
import React from 'react';
import { X, Headset, MapPin, ExternalLink } from 'lucide-react';

interface IntroModalProps {
  onClose: () => void;
}

const IntroModal: React.FC<IntroModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-emerald-950/40 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 slide-in-from-bottom-10 max-h-[90vh] flex flex-col">
        {/* Header visual */}
        <div className="h-32 bg-emerald-900 flex items-center justify-center relative overflow-hidden shrink-0">
          <img 
            src="https://naturaudio.dk/vildmarken/banner.jpg" 
            className="absolute inset-0 w-full h-full object-cover opacity-40"
            alt=""
          />
          <div className="relative z-10 flex flex-col items-center px-4">
            <img 
              src="https://naturaudio.dk/vildmarken/Norholm_Vildmark.png" 
              alt="Nørholm Vildmark" 
              className="h-12 w-auto object-contain drop-shadow-lg translate-y-[24px]"
            />
          </div>
          
          <div className="absolute top-4 right-4 flex gap-2 z-20">
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto scrollbar-hide">
          <h2 className="text-xl font-bold text-emerald-900 mb-2 leading-tight">
            Udforsk den vilde natur
          </h2>
          <p className="text-stone-600 text-sm mb-6 leading-relaxed">
            Dyk ned i historien om Nørholm. Her får naturen plads til at genfinde sin egen balance gennem naturlig græsning og fri dynamik.
          </p>

          <div className="space-y-5 mb-6">
            <div className="flex gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <MapPin size={18} />
              </div>
              <div>
                <h4 className="font-bold text-stone-800 text-xs">Find vej</h4>
                <p className="text-[11px] text-stone-500 leading-tight mt-0.5">Udforsk de oplyste områder på kortet.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Headset size={18} />
              </div>
              <div>
                <h4 className="font-bold text-stone-800 text-xs">Lyt og lær</h4>
                <p className="text-[11px] text-stone-500 leading-tight mt-0.5">Tryk på lydikonerne for at hør om landskabets forvandling.</p>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-full py-4 bg-emerald-700 text-white font-bold rounded-2xl shadow-lg hover:bg-emerald-800 transition-colors active:scale-[0.98] text-sm"
          >
            Start min tur i vildmarken
          </button>

          <a 
            href="https://naturaudio.dk" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
          >
            Besøg NaturAudio.dk <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default IntroModal;
