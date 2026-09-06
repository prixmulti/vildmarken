
export type Category = 'Alle' | 'Historie' | 'Natur' | 'Rewild';

export interface AudioPoint {
  id: number;
  lat: number;
  lng: number;
  title: string;
  description: string;
  audioSrc: string;
  imageSrc?: string;
  category: Exclude<Category, 'Alle'>;
}

export interface TrackingData {
  button: string;
  timestamp: string;
  userAgent: string;
}

export type PolygonCoords = [number, number][];
