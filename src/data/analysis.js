// Pure analysis of ECU samples: violations, scoring, risk profile and narrative.
export const TOLERANCE = 5; // km/h above the limit before a sample counts as speeding

const OPEN_LIMIT = 100; // limits of 100+ count as open road

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const sig = (x) => 1 / (1 + Math.exp(-x));
const isOver = (s) => s.speed > s.limit + TOLERANCE;

function severityOf(excess, limit) {
  if (excess >= 30 || excess / limit >= 0.4) return 'serious';
  if (excess >= 15) return 'major';
  return 'minor';
}

// Groups consecutive over-limit samples; runs shorter than 2 samples are ignored.
export function findViolations(samples) {
  const viol = [];
  let runStart = -1;
  const close = (endIdx) => {
    if (endIdx - runStart + 1 >= 2) {
      let peakIdx = runStart;
      for (let i = runStart; i <= endIdx; i++) {
        if (samples[i].speed > samples[peakIdx].speed) peakIdx = i;
      }
      const peak = samples[peakIdx];
      const excess = Math.round((peak.speed - peak.limit) * 10) / 10;
      viol.push({
        start: samples[runStart].t,
        end: samples[endIdx].t,
        startIdx: runStart,
        endIdx,
        peak: peak.speed,
        peakIdx,
        limit: peak.limit,
        road: peak.road,
        seg: peak.seg,
        duration: (samples[endIdx].t - samples[runStart].t) / 1000,
        excess,
        severity: severityOf(excess, peak.limit),
      });
    }
    runStart = -1;
  };

  samples.forEach((s, i) => {
    if (isOver(s)) {
      if (runStart < 0) runStart = i;
    } else if (runStart >= 0) {
      close(i - 1);
    }
  });
  if (runStart >= 0) close(samples.length - 1);
  return viol;
}

function stdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function analyse(samples) {
  const n = samples.length;
  const viol = findViolations(samples);

  let km = 0;
  let brakes = 0;
  let accels = 0;
  let overCount = 0;
  let urbanCount = 0;
  let urbanOver = 0;
  let openCount = 0;
  let openOver = 0;

  samples.forEach((s, i) => {
    if (i > 0) km += (s.speed * (s.t - samples[i - 1].t)) / 3_600_000;
    if (s.ev?.type === 'brake') brakes++;
    if (s.ev?.type === 'accel') accels++;
    const over = isOver(s);
    if (over) overCount++;
    if (s.limit >= OPEN_LIMIT) {
      openCount++;
      if (over) openOver++;
    } else {
      urbanCount++;
      if (over) urbanOver++;
    }
  });

  const overRatio = n ? overCount / n : 0;
  const brakePer100 = km > 0 ? (brakes / km) * 100 : 0;
  const accelPer100 = km > 0 ? (accels / km) * 100 : 0;
  const variability = stdDev(samples.filter((s) => s.speed > 20).map((s) => s.speed / s.limit));
  const maxExcess = viol.reduce((m, v) => Math.max(m, v.excess), 0);

  const raw =
    100 -
    overRatio * 75 -
    brakePer100 * 1.1 -
    accelPer100 * 0.9 -
    maxExcess * 0.35 -
    Math.max(0, variability - 0.06) * 90;

  return {
    viol,
    overRatio,
    brakes,
    accels,
    km,
    score: Math.round(clamp(raw, 3, 100)),
    variability,
    urbanRatio: urbanCount ? urbanOver / urbanCount : 0,
    openRatio: openCount ? openOver / openCount : 0,
    brakePer100,
    accelPer100,
    durationSec: n > 1 ? (samples[n - 1].t - samples[0].t) / 1000 : 0,
    // raw counts, used to aggregate across trips
    samples: n,
    overCount,
    urbanCount,
    urbanOver,
    openCount,
    openOver,
  };
}

export function classify(score) {
  if (score >= 85) return 'Low risk';
  if (score >= 70) return 'Moderate risk';
  if (score >= 50) return 'High risk';
  return 'Severe risk';
}

// Samples recorded so far: the live trip stops at liveIdx.
export function recordedSamples(vehicleData, trip) {
  if (!trip.live || vehicleData.liveIdx >= trip.samples.length - 1) return trip.samples;
  return trip.samples.slice(0, vehicleData.liveIdx + 1);
}

// Replaces the live trip with the samples revealed so far by the live feed.
// totalSamples keeps the full trip length for charts.
export function withLiveFeed(vehicleData, feed) {
  const [live, ...rest] = vehicleData.trips;
  return {
    ...vehicleData,
    liveIdx: feed.samples.length - 1,
    trips: [{ ...live, samples: feed.samples, totalSamples: feed.raw.length, ended: feed.ended }, ...rest],
  };
}

// Finished trips never change, so their analysis is cached by sample array.
const analysisCache = new WeakMap();
function analyseCached(samples) {
  let result = analysisCache.get(samples);
  if (!result) {
    result = analyse(samples);
    analysisCache.set(samples, result);
  }
  return result;
}

function slope(ys) {
  const n = ys.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  ys.forEach((y, x) => {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  });
  return num / den;
}

export function profileOf(vehicleData) {
  const trips = vehicleData.trips.map((trip) => ({
    id: trip.id,
    start: trip.start,
    live: trip.live,
    routeName: trip.routeName,
    ...analyseCached(recordedSamples(vehicleData, trip)),
  }));

  const sum = (key) => trips.reduce((a, t) => a + t[key], 0);
  const km = sum('km');
  const brakes = sum('brakes');
  const accels = sum('accels');
  const samples = sum('samples');
  const urbanCount = sum('urbanCount');
  const openCount = sum('openCount');

  const cumulative = km > 0 ? Math.round(trips.reduce((a, t) => a + t.score * t.km, 0) / km) : 100;
  const totals = {
    km,
    brakes,
    accels,
    violations: trips.reduce((a, t) => a + t.viol.length, 0),
    overRatio: samples ? sum('overCount') / samples : 0,
    urbanRatio: urbanCount ? sum('urbanOver') / urbanCount : 0,
    openRatio: openCount ? sum('openOver') / openCount : 0,
    brakePer100: km > 0 ? (brakes / km) * 100 : 0,
    accelPer100: km > 0 ? (accels / km) * 100 : 0,
    variability: km > 0 ? trips.reduce((a, t) => a + t.variability * t.km, 0) / km : 0,
  };

  // trips are newest first; regress oldest -> newest so a positive slope means improving
  const trend = slope([...trips].reverse().map((t) => t.score));

  return {
    trips,
    cumulative,
    riskClass: classify(cumulative),
    trend,
    totals,
    predictions: {
      speeding: sig((totals.overRatio - 0.12) * 18),
      harshBraking: sig((totals.brakePer100 - 4) * 0.55),
      harshAccel: sig((totals.accelPer100 - 3) * 0.6),
      erratic: sig((totals.variability - 0.095) * 55),
    },
  };
}

const pct = (r) => `${Math.round(r * 100)}%`;
const fix1 = (n) => n.toFixed(1);

export function narrative(vehicleData, profile) {
  const { totals } = profile;
  const n = profile.trips.length;
  const out = [];

  out.push(
    `${classify(profile.cumulative)}: cumulative score ${profile.cumulative}/100 over ` +
      `${Math.round(totals.km)} km across ${n} trip${n === 1 ? '' : 's'}.`
  );

  if (totals.overRatio < 0.03) {
    out.push('The driver rarely exceeds the speed limit.');
  } else {
    const where =
      totals.urbanRatio > totals.openRatio * 1.25
        ? 'mostly on urban roads'
        : totals.openRatio > totals.urbanRatio * 1.25
          ? 'mostly on open roads'
          : 'on both urban and open roads';
    out.push(
      `The driver is over the limit (more than ${TOLERANCE} km/h) ${pct(totals.overRatio)} of the time, ${where} ` +
        `(${pct(totals.urbanRatio)} of urban driving, ${pct(totals.openRatio)} of open-road driving).`
    );
  }

  const harshTotal = totals.brakePer100 + totals.accelPer100;
  const harshNote = harshTotal >= 10 ? ', which is high' : harshTotal >= 6 ? ', which is above average' : '';
  out.push(
    `Harsh braking happens ${fix1(totals.brakePer100)} times and harsh acceleration ` +
      `${fix1(totals.accelPer100)} times per 100 km${harshNote}.`
  );

  if (profile.trend > 1.5) out.push('Scores have been improving over recent trips.');
  else if (profile.trend < -1.5) out.push('Scores have been getting worse over recent trips.');
  else out.push('Scores have been stable over recent trips.');

  const live = vehicleData.trips.find((t) => t.live);
  if (live) {
    const now = live.samples[vehicleData.liveIdx];
    const liveTrip = profile.trips.find((t) => t.live);
    if (now && now.speed > now.limit + TOLERANCE) {
      out.push(
        `Right now the vehicle is doing ${Math.round(now.speed)} km/h in a ${now.limit} km/h zone on ${now.road}.`
      );
    } else if (liveTrip?.viol.length) {
      const worst = liveTrip.viol.reduce((a, v) => (v.excess > a.excess ? v : a));
      out.push(
        `This trip has ${liveTrip.viol.length} speeding violation${liveTrip.viol.length === 1 ? '' : 's'} so far, ` +
          `worst ${Math.round(worst.peak)} km/h in a ${worst.limit} km/h zone on ${worst.road}.`
      );
    }
  }

  return out;
}

