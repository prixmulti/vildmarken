import { AudioPoint, PolygonCoords } from '../types';

const API_BASE = '/vildmarken/api';

export interface GuideData {
  audioPoints: AudioPoint[];
  forestBoundary: PolygonCoords[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error(`Kunne ikke hente data (${response.status}).`);
  }

  return response.json() as Promise<T>;
}

export async function loadGuideData(): Promise<GuideData> {
  const [pointsPayload, boundaryPayload] = await Promise.all([
    fetchJson<{ audioPoints: AudioPoint[] }>(`${API_BASE}/points.php`),
    fetchJson<{ forestBoundary: PolygonCoords[] }>(`${API_BASE}/boundary.php`),
  ]);

  if (!Array.isArray(pointsPayload.audioPoints)) {
    throw new Error('Ugyldigt svar for lydpunkter.');
  }

  if (!Array.isArray(boundaryPayload.forestBoundary)) {
    throw new Error('Ugyldigt svar for områdegrænse.');
  }

  return {
    audioPoints: pointsPayload.audioPoints,
    forestBoundary: boundaryPayload.forestBoundary,
  };
}
