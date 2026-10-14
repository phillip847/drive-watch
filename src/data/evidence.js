// Builds enforcement evidence for one speeding violation. Pure, apart from the
// async SHA-256 fingerprint, which uses the Web Crypto API.
import { recordedSamples, findViolations } from './analysis.js';

export const WINDOW_SEC = 120; // chart context either side of the violation
export const GPS_ACCURACY_M = 3;

// Short, stable 4-character code (FNV-1a, base 36).
function shortCode(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
}

export function evidenceNumber(disc, tripIndex, violationIndex, violationStart) {
  const digits = disc.replace(/\D/g, '').slice(-5);
  const seq = `${tripIndex}${String(violationIndex + 1).padStart(2, '0')}`;
  return `EV-${digits}-${seq}-${shortCode(`${disc}|${tripIndex}|${violationStart}`)}`;
}

// Returns null when the trip or violation does not exist.
// defaultRoadVersion is used for samples recorded without a road-data stamp.
export function buildEvidence(vehicleData, tripIndex, violationIndex, defaultRoadVersion) {
  const trip = vehicleData.trips[tripIndex];
  if (!trip) return null;
  const samples = recordedSamples(vehicleData, trip);
  const violation = findViolations(samples)[violationIndex];
  if (!violation) return null;

  const { vehicle } = vehicleData;
  const peak = samples[violation.peakIdx];
  const evidenceNo = evidenceNumber(vehicle.disc, tripIndex, violationIndex, violation.start);
  const ongoing = Boolean(trip.live && !trip.ended && violation.endIdx === samples.length - 1);

  const from = violation.start - WINDOW_SEC * 1000;
  const to = violation.end + WINDOW_SEC * 1000;
  const windowSamples = samples.filter((s) => s.t >= from && s.t <= to);

  // Field order is fixed, so the same evidence always hashes to the same fingerprint.
  const record = {
    evidenceNo,
    vehicle: { disc: vehicle.disc, reg: vehicle.reg, make: vehicle.make, owner: vehicle.owner, ecu: vehicle.ecu },
    road: peak.road,
    segment: peak.seg,
    roadVersion: peak.roadVersion ?? defaultRoadVersion,
    limit: peak.limit,
    peakSpeed: peak.speed,
    excess: violation.excess,
    peakTime: peak.t,
    overFrom: violation.start,
    overTo: violation.end,
    durationSec: violation.duration,
    position: { lat: peak.lat, lng: peak.lng, accuracyM: GPS_ACCURACY_M },
    source: `${vehicle.ecu}, ECU speed with GPS fix ±${GPS_ACCURACY_M} m`,
    samples: samples.slice(violation.startIdx, violation.endIdx + 1).map((s) => [s.t, s.speed, s.limit]),
  };

  return {
    evidenceNo,
    record,
    violation,
    trip,
    peak,
    ongoing,
    windowSamples,
    timeOffset: windowSamples.length ? (windowSamples[0].t - trip.start) / 1000 : 0,
  };
}

export async function fingerprint(record, subtle = globalThis.crypto?.subtle) {
  if (!subtle) return null; // Web Crypto needs a secure context (https or localhost)
  const bytes = new TextEncoder().encode(JSON.stringify(record));
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export const groupHex = (hex) => hex.match(/.{1,4}/g).join(' ');
