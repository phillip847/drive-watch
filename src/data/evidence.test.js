import { describe, it, expect, beforeEach } from 'vitest';
import { getVehicleData, clearVehicleCache } from './simulator.js';
import { profileOf } from './analysis.js';
import { buildEvidence, evidenceNumber, fingerprint, groupHex, WINDOW_SEC } from './evidence.js';

const NOW = Date.UTC(2026, 9, 14, 10, 0, 0);

beforeEach(() => clearVehicleCache());

describe('evidence', () => {
  it('formats the evidence number', () => {
    expect(evidenceNumber('NAM-D-88310', 0, 2, 123)).toMatch(/^EV-88310-003-[0-9A-Z]{4}$/);
    expect(evidenceNumber('NAM-D-88310', 0, 2, 123)).toBe(evidenceNumber('NAM-D-88310', 0, 2, 123));
    expect(evidenceNumber('NAM-D-88310', 0, 2, 123)).not.toBe(evidenceNumber('NAM-D-88310', 0, 2, 124));
  });

  it('builds a record with a chart window around the violation', () => {
    const data = getVehicleData('NAM-D-88310', NOW);
    const tripIndex = profileOf(data).trips.findIndex((t) => !t.live && t.viol.length > 0);
    const ev = buildEvidence(data, tripIndex, 0, '2 Oct 2026');
    const { violation, windowSamples, record } = ev;
    expect(record.peakSpeed).toBe(violation.peak);
    expect(record.limit).toBe(violation.limit);
    expect(record.roadVersion).toBe('2 Oct 2026');
    expect(record.samples).toHaveLength(violation.endIdx - violation.startIdx + 1);
    expect(windowSamples[0].t).toBeGreaterThanOrEqual(violation.start - WINDOW_SEC * 1000);
    expect(windowSamples.at(-1).t).toBeLessThanOrEqual(violation.end + WINDOW_SEC * 1000);
    expect(ev.ongoing).toBe(false);
  });

  it('returns null for a missing trip or violation', () => {
    const data = getVehicleData('NAM-D-40217', NOW);
    expect(buildEvidence(data, 9, 0)).toBeNull();
    expect(buildEvidence(data, 0, 999)).toBeNull();
  });

  it('fingerprints records with SHA-256', async () => {
    const hex = await fingerprint({ a: 1 });
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
    expect(await fingerprint({ a: 1 })).toBe(hex);
    expect(await fingerprint({ a: 2 })).not.toBe(hex);
    expect(groupHex('0123456789ab')).toBe('0123 4567 89ab');
    expect(await fingerprint({ a: 1 }, null)).toBeNull();
  });
});
