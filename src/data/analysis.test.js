import { describe, it, expect } from 'vitest';
import { analyse, classify, findViolations, TOLERANCE } from './analysis.js';

// Builds 5-second samples from a list of speeds (or [speed, limit] pairs).
function make(speeds, limit = 60) {
  return speeds.map((v, i) => {
    const [speed, lim] = Array.isArray(v) ? v : [v, limit];
    return { t: i * 5000, speed, limit: lim, road: 'Test Rd', seg: 'TST-U-0001', ev: null };
  });
}

describe('violation grouping', () => {
  it('does not count speeds within the tolerance', () => {
    expect(findViolations(make([60, 60 + TOLERANCE, 65, 65]))).toEqual([]);
  });

  it('ignores a single over-limit sample', () => {
    expect(findViolations(make([60, 80, 60, 60]))).toEqual([]);
  });

  it('groups consecutive over-limit samples into one violation', () => {
    const v = findViolations(make([60, 70, 78, 72, 60]));
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({
      startIdx: 1,
      endIdx: 3,
      start: 5000,
      end: 15000,
      duration: 10,
      peak: 78,
      peakIdx: 2,
      limit: 60,
      excess: 18,
      road: 'Test Rd',
      seg: 'TST-U-0001',
    });
  });

  it('separates runs broken by a legal sample', () => {
    const v = findViolations(make([70, 70, 60, 75, 75, 60, 90]));
    expect(v.map((x) => [x.startIdx, x.endIdx])).toEqual([
      [0, 1],
      [3, 4],
    ]);
  });

  it('closes a run that reaches the last sample', () => {
    const v = findViolations(make([60, 70, 71]));
    expect(v).toHaveLength(1);
    expect(v[0].endIdx).toBe(2);
  });

  it('assigns severity by excess and ratio', () => {
    const sev = (speed, limit) => findViolations(make([speed, speed], limit))[0].severity;
    expect(sev(70, 60)).toBe('minor'); // +10
    expect(sev(75, 60)).toBe('major'); // +15
    expect(sev(90, 60)).toBe('serious'); // +30
    expect(sev(57, 40)).toBe('serious'); // +17, 42.5% over
    expect(sev(135, 120)).toBe('major'); // +15, 12.5% over
  });
});

describe('analyse', () => {
  it('returns a perfect score for smooth legal driving', () => {
    const r = analyse(make(Array(20).fill(60)));
    expect(r.viol).toEqual([]);
    expect(r.overRatio).toBe(0);
    expect(r.variability).toBe(0);
    expect(r.score).toBe(100);
    expect(r.durationSec).toBe(95);
    // 19 intervals of 5 s at 60 km/h
    expect(r.km).toBeCloseTo((19 * 5 * 60) / 3600);
  });

  it('counts harsh events and normalises per 100 km', () => {
    const s = make(Array(13).fill(72), 72); // 12 intervals * 5 s at 72 km/h = 1.2 km
    s[3].ev = { type: 'brake', g: 0.4 };
    s[7].ev = { type: 'accel', g: 0.35 };
    s[9].ev = { type: 'brake', g: 0.5 };
    const r = analyse(s);
    expect(r.brakes).toBe(2);
    expect(r.accels).toBe(1);
    expect(r.km).toBeCloseTo(1.2);
    expect(r.brakePer100).toBeCloseTo(2 / 1.2 * 100);
    expect(r.accelPer100).toBeCloseTo(1 / 1.2 * 100);
  });

  it('splits over-limit share into urban and open road', () => {
    const r = analyse(make([[70, 60], [70, 60], [60, 60], [60, 60], [130, 120], [110, 120]]));
    expect(r.overRatio).toBeCloseTo(3 / 6);
    expect(r.urbanRatio).toBeCloseTo(2 / 4);
    expect(r.openRatio).toBeCloseTo(1 / 2);
  });

  it('ignores slow samples when measuring variability', () => {
    const r = analyse(make([0, 10, 20, 60, 60, 60]));
    expect(r.variability).toBe(0);
  });

  it('applies the score formula', () => {
    // 2 of 4 samples over, peak excess 20, constant speed/limit ratio per sample
    const s = make([60, 60, 80, 80]);
    const r = analyse(s);
    const variability = r.variability;
    const expected = 100 - 0.5 * 75 - 20 * 0.35 - Math.max(0, variability - 0.06) * 90;
    expect(r.score).toBe(Math.round(expected));
  });

  it('clamps the score to a minimum of 3', () => {
    const s = make(Array(10).fill(150));
    s.forEach((x) => (x.ev = { type: 'brake', g: 0.5 }));
    expect(analyse(s).score).toBe(3);
  });

  it('handles empty input', () => {
    const r = analyse([]);
    expect(r.score).toBe(100);
    expect(r.km).toBe(0);
    expect(r.durationSec).toBe(0);
  });
});

describe('classify', () => {
  it.each([
    [100, 'Low risk'],
    [85, 'Low risk'],
    [84.9, 'Moderate risk'],
    [70, 'Moderate risk'],
    [69, 'High risk'],
    [50, 'High risk'],
    [49, 'Severe risk'],
    [3, 'Severe risk'],
  ])('%s -> %s', (score, label) => {
    expect(classify(score)).toBe(label);
  });
});
