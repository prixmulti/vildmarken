const API_BASE = '/vildmarken/api';
const SESSION_KEY = 'vildmarken_analytics_session';
const VISIT_KEY = 'vildmarken_analytics_visit_sent';
const LOCATION_KEY = 'vildmarken_analytics_location_sent';

export type ListenEventType = 'play' | 'pause' | 'ended' | 'switch' | 'close' | 'hidden';

interface ClientEnvironment {
  device: string;
  browser: string;
  os: string;
  userAgent: string;
}

interface TrackLocationPoint {
  id: number;
  lat: number;
  lng: number;
  title: string;
}

interface NearestPointMatch {
  pointId: number;
  title: string;
  distanceM: number;
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === 'x' ? rand : ((rand & 0x3) | 0x8);
    return value.toString(16);
  });
}

export function getAnalyticsSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) {
      return existing;
    }

    const sessionId = createSessionId();
    sessionStorage.setItem(SESSION_KEY, sessionId);
    return sessionId;
  } catch {
    return createSessionId();
  }
}

function parseClientEnvironment(): ClientEnvironment {
  const ua = navigator.userAgent || '';
  let device = 'desktop';

  if (/iPad|Tablet|PlayBook|Silk/i.test(ua)) {
    device = 'tablet';
  } else if (/Mobile|Android|iPhone|iPod|IEMobile|Opera Mini/i.test(ua)) {
    device = 'mobile';
  }

  let browser = 'Ukendt';
  const edge = ua.match(/Edg\/(\d+)/);
  const opera = ua.match(/OPR\/(\d+)/);
  const chrome = ua.match(/Chrome\/(\d+)/);
  const safari = ua.match(/Version\/(\d+).*Safari/);
  const firefox = ua.match(/Firefox\/(\d+)/);

  if (edge) {
    browser = `Edge ${edge[1]}`;
  } else if (opera) {
    browser = `Opera ${opera[1]}`;
  } else if (chrome && !/Edg|OPR/i.test(ua)) {
    browser = `Chrome ${chrome[1]}`;
  } else if (safari && /Safari/.test(ua)) {
    browser = `Safari ${safari[1]}`;
  } else if (firefox) {
    browser = `Firefox ${firefox[1]}`;
  }

  let os = 'Ukendt';
  const ios = ua.match(/iPhone OS (\d+[_\d]*)/);
  const ipados = ua.match(/iPad; CPU OS (\d+[_\d]*)/);
  const android = ua.match(/Android (\d+(?:\.\d+)?)/);
  const windows = ua.match(/Windows NT (\d+\.\d+)/);
  const mac = ua.match(/Mac OS X (\d+[._\d]*)/);

  if (ios) {
    os = `iOS ${ios[1].replace(/_/g, '.')}`;
  } else if (ipados) {
    os = `iPadOS ${ipados[1].replace(/_/g, '.')}`;
  } else if (android) {
    os = `Android ${android[1]}`;
  } else if (windows) {
    os = `Windows ${windows[1]}`;
  } else if (mac) {
    os = `macOS ${mac[1].replace(/_/g, '.')}`;
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }

  return {
    device,
    browser,
    os,
    userAgent: ua,
  };
}

async function sendAnalytics(payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${API_BASE}/analytics.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Statistik må aldrig blokere appen.
  }
}

export function trackVisit(): void {
  try {
    if (sessionStorage.getItem(VISIT_KEY) === '1') {
      return;
    }
    sessionStorage.setItem(VISIT_KEY, '1');
  } catch {
    // Fortsæt uden sessionStorage-markering.
  }

  const env = parseClientEnvironment();
  void sendAnalytics({
    type: 'visit',
    sessionId: getAnalyticsSessionId(),
    device: env.device,
    browser: env.browser,
    os: env.os,
    userAgent: env.userAgent,
  });
}

export function trackListen(pointId: number, seconds: number, event: ListenEventType): void {
  const rounded = Math.round(seconds);
  if (pointId <= 0 || rounded < 1) {
    return;
  }

  void sendAnalytics({
    type: 'listen',
    sessionId: getAnalyticsSessionId(),
    pointId,
    seconds: rounded,
    event,
  });
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2)
    + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function findNearestPoint(
  coords: [number, number],
  points: TrackLocationPoint[],
): NearestPointMatch | null {
  if (points.length === 0) {
    return null;
  }

  let nearest: NearestPointMatch | null = null;
  points.forEach((point) => {
    const distanceM = calculateDistanceMeters(coords[0], coords[1], point.lat, point.lng);
    if (!nearest || distanceM < nearest.distanceM) {
      nearest = {
        pointId: point.id,
        title: point.title,
        distanceM: Math.round(distanceM),
      };
    }
  });

  return nearest;
}

export function trackLocation(
  coords: [number, number],
  points: TrackLocationPoint[],
): void {
  try {
    if (sessionStorage.getItem(LOCATION_KEY) === '1') {
      return;
    }
    sessionStorage.setItem(LOCATION_KEY, '1');
  } catch {
    // Fortsæt uden sessionStorage-markering.
  }

  const nearest = findNearestPoint(coords, points);
  void sendAnalytics({
    type: 'location',
    sessionId: getAnalyticsSessionId(),
    lat: coords[0],
    lng: coords[1],
    nearestPointId: nearest?.pointId ?? null,
    nearestPointTitle: nearest?.title ?? null,
    nearestDistanceM: nearest?.distanceM ?? null,
  });
}
