import { describe, it, expect, beforeEach } from 'vitest';
import { VEHICLES } from './vehicles.js';
import { simulateTrip, getVehicleData, clearVehicleCache, SAMPLE_SEC } from './simulator.js';
import { profileOf, narrative } from './analysis.js';

const NOW = Date.UTC(2026, 9, 14, 10, 0, 0);

beforeEach(() => clearVehicleCache());

describe('simulator', () => {
  it('is deterministic for the same seed', () => {
    const v = VEHICLES[0];
    expect(simulateTrip(v, 0, 42, 0)).toEqual(simulateTrip(v, 0, 42, 0));
  });

  it('places the live sample at "now" and keeps trips newest first', () => {
    const d = getVehicleData('NAM-D-40217', NOW);
    expect(d.trips).toHaveLength(6);
    const live = d.trips[0];
    expect(live.live).toBe(true);
    expect(d.liveIdx).toBe(Math.floor(live.samples.length * 0.32));
    expect(live.samples[d.liveIdx].t).toBe(NOW);
    expect(live.samples[1].t - live.samples[0].t).toBe(SAMPLE_SEC * 1000);
    for (let k = 1; k < 6; k++) expect(d.trips[k].start).toBeLessThan(d.trips[k - 1].start);
    expect(NOW - d.trips[5].start).toBeLessThan(16 * 86_400_000);
  });

  it('returns null for an unknown disc', () => {
    expect(getVehicleData('NAM-D-00000')).toBeNull();
  });

  it('ranks the steady driver safer than the others', () => {
    const scores = Object.fromEntries(
      VEHICLES.map((v) => [v.profile, profileOf(getVehicleData(v.disc, NOW)).cumulative])
    );
    for (const p of ['speeder', 'harsh', 'erratic']) expect(scores.steady).toBeGreaterThan(scores[p]);
  });

  it('writes a 3 to 5 sentence narrative', () => {
    for (const v of VEHICLES) {
      const d = getVehicleData(v.disc, NOW);
      const lines = narrative(d, profileOf(d));
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines.length).toBeLessThanOrEqual(5);
    }
  });
});
