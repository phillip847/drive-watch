// Deterministic ECU/GPS trip simulator. Same seed -> same data on every load.
import { ROUTES } from './roads.js';
import { findVehicle } from './vehicles.js';

export const SAMPLE_SEC = 5;
const KM_PER_DEG = 111.32;
const DAY_MS = 86_400_000;
const MAX_SAMPLES = 20_000;

// urban/open: target speed as a fraction of the limit (open = limits of 100+)
// noise: km/h jitter per sample; eventP: harsh-event chance per sample;
// osc: amplitude (km/h) of slow speed oscillation
export const PROFILES = {
  steady: { urban: 0.9, open: 0.93, noise: 2.2, eventP: 0.003, osc: 0 },
  speeder: { urban: 1.12, open: 1.075, noise: 3.5, eventP: 0.006, osc: 0 },
  harsh: { urban: 0.97, open: 0.98, noise: 3, eventP: 0.022, osc: 0 },
  erratic: { urban: 1.0, open: 1.0, noise: 5, eventP: 0.012, osc: 15 },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;
const jitter = (rand, amount) => (rand() * 2 - 1) * amount;

export function simulateTrip(vehicle, routeIndex, seed, startMs) {
  const rand = mulberry32(seed);
  const p = PROFILES[vehicle.profile];
  const route = ROUTES[routeIndex];
  const segs = route.segments;

  const tripBias = 1 + jitter(rand, 0.03);
  const hLen = Math.hypot(...route.heading);
  const uLat = route.heading[0] / hLen;
  const uLng = route.heading[1] / hLen;

  let [lat, lng] = route.origin;
  let speed = 0;
  let km = 0;
  let segIdx = 0;
  let segEnd = segs[0].km;
  const samples = [];

  for (let i = 0; segIdx < segs.length && i < MAX_SAMPLES; i++) {
    const seg = segs[segIdx];
    const elapsed = i * SAMPLE_SEC;
    const factor = seg.limit >= 100 ? p.open : p.urban;
    const target = seg.limit * factor * tripBias + Math.sin(elapsed / 45) * p.osc;

    speed += (target - speed) * 0.3 + jitter(rand, p.noise);

    let ev = null;
    if (speed > 35 && rand() < p.eventP) {
      if (rand() < 0.6) {
        const g = 0.36 + rand() * 0.2;
        speed = Math.max(8, speed - g * 88);
        ev = { type: 'brake', g: round(g, 2) };
      } else {
        const g = 0.32 + rand() * 0.14;
        speed += g * 70;
        ev = { type: 'accel', g: round(g, 2) };
      }
    }
    speed = Math.max(0, speed);

    samples.push({
      t: startMs + elapsed * 1000,
      speed: round(speed, 1),
      limit: seg.limit,
      road: seg.road,
      seg: seg.id,
      lat: round(lat, 5),
      lng: round(lng, 5),
      rpm: Math.round(800 + speed * 24 + jitter(rand, 120)),
      ev,
    });

    const dKm = (speed * SAMPLE_SEC) / 3600;
    km += dKm;
    lat += (uLat * dKm) / KM_PER_DEG;
    lng += (uLng * dKm) / (KM_PER_DEG * Math.cos((lat * Math.PI) / 180));
    while (segIdx < segs.length && km >= segEnd) {
      segIdx++;
      if (segIdx < segs.length) segEnd += segs[segIdx].km;
    }
  }
  return samples;
}

const cache = new Map();

// Returns { vehicle, trips, liveIdx } or null for an unknown disc.
// trips[0] is the live trip (newest first); its sample at liveIdx is "now".
// Results are cached per disc, so `now` only applies to the first call.
export function getVehicleData(disc, now = Date.now()) {
  const vehicle = findVehicle(disc);
  if (!vehicle) return null;
  if (cache.has(vehicle.disc)) return cache.get(vehicle.disc);

  const rand = mulberry32(vehicle.seed * 7919);
  const trips = [];
  let liveIdx = 0;

  for (let k = 0; k < 6; k++) {
    const routeIndex = (vehicle.seed + k) % ROUTES.length;
    const raw = simulateTrip(vehicle, routeIndex, vehicle.seed * 1000 + k, 0);
    let start;
    if (k === 0) {
      liveIdx = Math.floor(raw.length * 0.32);
      start = now - liveIdx * SAMPLE_SEC * 1000;
    } else {
      // ~2.6 days apart, so five earlier trips cover roughly two weeks
      const daysAgo = k * 2.6 + jitter(rand, 0.6);
      start = Math.round((now - daysAgo * DAY_MS) / 60_000) * 60_000;
    }
    const samples = raw.map((s) => ({ ...s, t: s.t + start }));
    trips.push({
      id: `${vehicle.disc}-T${k}`,
      routeIndex,
      routeName: ROUTES[routeIndex].name,
      start,
      end: samples[samples.length - 1].t,
      live: k === 0,
      samples,
    });
  }

  const data = { vehicle, trips, liveIdx };
  cache.set(vehicle.disc, data);
  return data;
}

export function clearVehicleCache() {
  cache.clear();
}
