
import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { Navigation, Share2, Check, Info, MapPin, X } from 'lucide-react';
import { AudioPoint } from '../types';
import { APP_THEME } from '../constants';
import { PolygonCoords } from '../types';

const START_ZOOM = 13; 
const START_CENTER: [number, number] = [55.689746, 8.603500];

interface MapViewProps {
  points: AudioPoint[];
  forestBoundary: PolygonCoords[];
  onSelectPoint: (point: AudioPoint) => void;
  onOpenIntro?: () => void;
  onLocationUpdate?: (coords: [number, number] | null) => void;
  activePointId?: number;
  resetTrigger?: number;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Jordens radius i meter
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const MapView: React.FC<MapViewProps> = ({ points, forestBoundary, onSelectPoint, onOpenIntro, onLocationUpdate, activePointId, resetTrigger }) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clusterGroupRef = useRef<any>(null);
  const markersRef = useRef<{ [key: number]: L.Marker }>({});
  const userMarkerRef = useRef<L.Marker | null>(null);
  
  const [isLocationActive, setIsLocationActive] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [distanceAlert, setDistanceAlert] = useState<{dist: number, nearest: {lat: number, lng: number}} | null>(null);

  const isLocatingRef = useRef(false);
  const highAccuracyFailedRef = useRef(false);

  const getCategoryColor = (category: string) => {
    return APP_THEME.categories[category as keyof typeof APP_THEME.categories] || '#1A3A32';
  };

  // 1. Initialiser kortet
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: START_CENTER,
      zoom: START_ZOOM,
      zoomControl: false,
      attributionControl: false,
      maxZoom: 18,
      minZoom: 11
    });

    const userPane = map.createPane('user-pane');
    if (userPane) userPane.style.zIndex = '650';

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    clusterGroupRef.current = (L as any).markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 40,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `
            <div class="relative flex items-center justify-center">
              <div class="w-10 h-10 rounded-full bg-stone-500 border-2 border-white flex items-center justify-center text-white font-black shadow-xl">
                <span>${count}</span>
              </div>
            </div>
          `,
          className: 'custom-cluster-icon',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
      }
    }).addTo(map);

    // Grænser
    const activeSegments = forestBoundary.filter(s => s.length >= 3);
    L.polygon([
      [[90, -180], [90, 180], [-90, 180], [-90, -180]],
      ...activeSegments
    ], {
      color: '#1a3a32',
      weight: 1.5,
      opacity: 0.2,
      fillColor: '#061612',
      fillOpacity: 0.55,
      interactive: false
    }).addTo(map);

    map.on('locationfound', (e) => {
      isLocatingRef.current = false;
      setIsLocating(false);
      setIsLocationActive(true);
      setErrorMsg(null);
      
      onLocationUpdate?.([e.latlng.lat, e.latlng.lng]);

      let minDistance = Infinity;
      let nearestPoint = points[0];
      points.forEach(p => {
        const dist = calculateDistance(e.latlng.lat, e.latlng.lng, p.lat, p.lng);
        if (dist < minDistance) {
          minDistance = dist;
          nearestPoint = p;
        }
      });

      if (minDistance > 500) {
        setDistanceAlert({ dist: minDistance, nearest: { lat: nearestPoint.lat, lng: nearestPoint.lng } });
      } else {
        setDistanceAlert(null);
      }

      const userIcon = L.divIcon({
        className: 'user-location-icon',
        html: `
          <div class="relative flex items-center justify-center">
            <div class="absolute inset-0 bg-blue-500/40 rounded-full animate-ping scale-[3.5]"></div>
            <div class="w-5 h-5 bg-blue-600 border-2 border-white rounded-full shadow-[0_0_15px_rgba(37,99,235,0.6)]"></div>
          </div>`,
        iconSize: [20, 20], 
        iconAnchor: [10, 10]
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(e.latlng, { icon: userIcon, pane: 'user-pane' }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng(e.latlng);
      }
    });

    map.on('locationerror', (e) => {
      if (!highAccuracyFailedRef.current && isLocatingRef.current) {
        highAccuracyFailedRef.current = true;
        map.locate({ setView: true, maxZoom: 16, watch: true, enableHighAccuracy: false, timeout: 8000 });
        return;
      }
      isLocatingRef.current = false;
      setIsLocating(false);
      setIsLocationActive(false);
      setDistanceAlert(null);
      onLocationUpdate?.(null);
      
      let msg = "GPS signal ikke fundet.";
      if (e.message.toLowerCase().includes("denied")) msg = "Tillad venligst GPS adgang.";
      else if (e.message.toLowerCase().includes("timeout")) msg = "GPS timeout.";
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
    });

    mapRef.current = map;
    return () => { 
      if (mapRef.current) mapRef.current.stopLocate();
      map.remove(); 
      mapRef.current = null; 
    };
  }, [points, onLocationUpdate]);

  // 2. Opdater markører når points eller aktivt punkt ændrer sig
  useEffect(() => {
    if (!mapRef.current || !clusterGroupRef.current) return;
    
    clusterGroupRef.current.clearLayers();
    markersRef.current = {};

    const createIcon = (point: AudioPoint, isActive: boolean) => {
      const color = getCategoryColor(point.category);
      const audioIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="1.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;

      return L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="relative flex items-center justify-center transition-all duration-300 ${isActive ? 'scale-125' : 'scale-100'}">
            ${isActive ? `<div class="absolute inset-0 rounded-full animate-ping scale-150" style="background-color: ${color}33"></div>` : ''}
            <div class="w-10 h-10 rounded-full shadow-xl flex items-center justify-center text-white border-2 border-white" style="background-color: ${color}">
              ${audioIcon}
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
    };

    points.forEach(point => {
      const marker = L.marker([point.lat, point.lng], {
        icon: createIcon(point, point.id === activePointId)
      });
      marker.on('click', () => onSelectPoint(point));
      markersRef.current[point.id] = marker;
      clusterGroupRef.current.addLayer(marker);
    });
  }, [points, activePointId]);

  const handleLocateToggle = () => {
    const map = mapRef.current;
    if (!map) return;
    if (isLocationActive || isLocating) {
      map.stopLocate();
      if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null; }
      setIsLocationActive(false);
      setIsLocating(false);
      isLocatingRef.current = false;
      highAccuracyFailedRef.current = false;
      setDistanceAlert(null); 
      onLocationUpdate?.(null);
      map.setView(START_CENTER, START_ZOOM, { animate: true });
      return;
    }
    setIsLocating(true);
    isLocatingRef.current = true;
    map.locate({ setView: true, maxZoom: 16, watch: true, enableHighAccuracy: true, timeout: 10000 });
  };

  const handleOpenGoogleMaps = () => {
    if (!distanceAlert) return;
    const { lat, lng } = distanceAlert.nearest;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  const handleShare = async () => {
    const shareUrl = "https://naturaudio.dk/vildmarken/app/";
    const shareData = { title: "Nørholm Lydguide", text: "Oplev Nørholm Vildmark.", url: shareUrl };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(shareUrl); setIsShared(true); setTimeout(() => setIsShared(false), 2000); }
    } catch (err) {}
  };

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {distanceAlert !== null && (
        <div className="absolute inset-0 z-[3000] flex items-center justify-center p-6 bg-emerald-950/20 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-white rounded-[2.5rem] shadow-2xl p-8 text-center">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6"><MapPin size={32} /></div>
            <h3 className="text-xl font-black text-emerald-900 mb-2">Uden for området</h3>
            <p className="text-stone-500 text-sm mb-6">Ca. <span className="font-bold text-emerald-700">{Math.round(distanceAlert.dist / 1000)} km</span> væk (i fugleflugtslinje).</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleOpenGoogleMaps} className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95"><img src="https://www.google.com/images/branding/product/2x/maps_96in128dp.png" alt="" className="w-4 h-auto" />Find vej</button>
              <button onClick={() => setDistanceAlert(null)} className="w-full py-3 bg-stone-100 text-stone-600 font-bold rounded-2xl">Luk</button>
            </div>
          </div>
        </div>
      )}
      {errorMsg && <div className="absolute top-32 left-1/2 -translate-x-1/2 z-[2000] w-[85%] max-w-[320px] bg-red-600/95 text-white px-6 py-4 rounded-3xl text-sm font-bold shadow-2xl text-center">{errorMsg}</div>}
      <div className="absolute bottom-6 right-6 z-[1000] flex gap-3">
        <button onClick={onOpenIntro} className="w-12 h-12 rounded-full shadow-2xl flex items-center justify-center bg-white/95 text-emerald-900"><Info size={20} /></button>
        <button onClick={handleShare} className="w-12 h-12 rounded-full shadow-2xl flex items-center justify-center bg-white/95 text-emerald-900">{isShared ? <Check size={20} /> : <Share2 size={20} />}</button>
        <button onClick={handleLocateToggle} className={`w-12 h-12 rounded-full shadow-2xl flex items-center justify-center ${isLocationActive ? 'bg-blue-600 text-white' : 'bg-white/95 text-emerald-900'}`}><Navigation size={20} className={`${isLocating ? 'animate-pulse' : ''} ${isLocationActive ? 'fill-current' : ''}`} /></button>
      </div>
    </div>
  );
};

export default MapView;
