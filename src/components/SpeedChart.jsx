import { useMemo } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceArea, ReferenceDot, ResponsiveContainer,
} from 'recharts';
import { TOLERANCE } from '../data/analysis.js';
import '../styles/speedchart.css';

const DEFAULT_STEP_SEC = 5;
const SHORT_WINDOW_SEC = 300; // up to 5 minutes, label ticks as m:ss
const MINUTE_STEPS = [1, 2, 5, 10, 15, 20, 30, 60];
const SECOND_STEPS = [10, 15, 30, 60];

// "an 80 zone", "a 60 zone"
export const article = (n) => (/^(8|11|18)/.test(String(n)) ? 'an' : 'a');

const EVENT_LABEL = { brake: 'Harsh braking', accel: 'Harsh acceleration' };

const mmss = (sec) => {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function ticksFor(from, to, short) {
  const span = to - from;
  const steps = short ? SECOND_STEPS : MINUTE_STEPS.map((m) => m * 60);
  const step = steps.find((s) => span / s <= 7) ?? steps[steps.length - 1];
  const ticks = [];
  for (let v = Math.ceil(from / step) * step; v <= to + 1e-6; v += step) ticks.push(v);
  return ticks;
}

function EventMarker({ cx, cy, payload }) {
  if (cy == null || !payload?.ev) return null;
  const r = 7;
  // Brake points down, acceleration points up.
  const d = payload.ev.type === 'brake'
    ? `M${cx - r},${cy - r * 0.8} L${cx + r},${cy - r * 0.8} L${cx},${cy + r} Z`
    : `M${cx - r},${cy + r * 0.8} L${cx + r},${cy + r * 0.8} L${cx},${cy - r} Z`;
  return <path d={d} fill="var(--amber)" stroke="var(--surface)" strokeWidth="2" strokeLinejoin="round" />;
}

function ChartTooltip({ active, payload, short }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const over = row.speed > row.limit + TOLERANCE;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time num">{short ? mmss(row.x) : `${mmss(row.x)} into trip`}</div>
      <div><span className="num">{Math.round(row.speed)}</span> km/h in {article(row.limit)} <span className="num">{row.limit}</span> zone</div>
      {over && <div className="chart-tooltip-over">Over by <span className="num">{Math.round(row.speed - row.limit)}</span> km/h</div>}
      {row.ev && (
        <div className="chart-tooltip-event">
          <span className="key key--event" aria-hidden="true" />
          {EVENT_LABEL[row.ev.type]} <span className="num">{row.ev.g.toFixed(2)}</span> g
        </div>
      )}
      <div className="muted">{row.road}</div>
    </div>
  );
}

/**
 * Vehicle speed against the posted limit.
 * - samples: trip samples to plot ({ t, speed, limit, road, ev })
 * - totalSamples: when live, the full trip length, so the x axis is fixed and the line grows
 * - live: marks the latest point with a dot
 * - highlight: [startMs, endMs] sample timestamps to shade in red
 * - timeOffset: seconds to add to the x axis (when samples are a slice of a longer trip)
 */
export default function SpeedChart({
  samples,
  totalSamples,
  live = false,
  highlight,
  timeOffset = 0,
  height = 280,
}) {
  const model = useMemo(() => {
    if (!samples?.length) return null;
    const t0 = samples[0].t;
    const step = samples.length > 1 ? (samples[1].t - t0) / 1000 : DEFAULT_STEP_SEC;
    const toX = (t) => timeOffset + (t - t0) / 1000;

    const rows = samples.map((s) => {
      const over = s.speed > s.limit + TOLERANCE;
      return {
        x: toX(s.t),
        speed: s.speed,
        limit: s.limit,
        over: over ? s.speed : null,
        evY: s.ev ? s.speed : null,
        ev: s.ev,
        road: s.road,
      };
    });

    const n = live && totalSamples ? Math.max(totalSamples, samples.length) : samples.length;
    const xMin = timeOffset;
    const xMax = timeOffset + Math.max(step, (n - 1) * step);
    const short = xMax - xMin <= SHORT_WINDOW_SEC;

    const peak = Math.max(...samples.map((s) => Math.max(s.speed, s.limit)));
    const yMax = Math.max(20, Math.ceil((peak + 1) / 20) * 20);
    const yStep = height < 220 && yMax > 100 ? 40 : 20;
    const yTicks = [];
    for (let v = 0; v <= yMax; v += yStep) yTicks.push(v);

    const area = highlight ? [toX(highlight[0]), toX(highlight[1])] : null;
    const last = rows[rows.length - 1];

    return { rows, xMin, xMax, short, xTicks: ticksFor(xMin, xMax, short), yMax, yTicks, area, last };
  }, [samples, totalSamples, live, highlight, timeOffset, height]);

  if (!model) return <div className="speed-chart-empty muted">No samples to show.</div>;

  const { rows, xMin, xMax, short, xTicks, yMax, yTicks, area, last } = model;
  const hasEvents = rows.some((r) => r.ev);
  const hasOver = rows.some((r) => r.over != null);
  const summary =
    `Speed chart, ${short ? mmss(xMax - xMin) : `${Math.round((xMax - xMin) / 60)} minutes`}. ` +
    `Peak ${Math.round(Math.max(...rows.map((r) => r.speed)))} km/h.`;

  return (
    <figure className="speed-chart">
      <div role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="var(--line)" strokeWidth={1} vertical={false} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[xMin, xMax]}
              ticks={xTicks}
              tickFormatter={(v) => (short ? mmss(v) : String(Math.round(v / 60)))}
              stroke="var(--line)"
              tick={{ fill: 'var(--muted)', fontSize: 14 }}
              tickLine={false}
              label={{ value: short ? 'm:ss' : 'min', position: 'insideBottomRight', offset: -2, fill: 'var(--muted)', fontSize: 13 }}
              height={32}
            />
            <YAxis
              domain={[0, yMax]}
              ticks={yTicks}
              stroke="var(--line)"
              tick={{ fill: 'var(--muted)', fontSize: 14 }}
              tickLine={false}
              axisLine={false}
              width={44}
              label={{ value: 'km/h', angle: -90, position: 'insideLeft', offset: 12, fill: 'var(--muted)', fontSize: 13 }}
            />

            {area && (
              <ReferenceArea x1={area[0]} x2={area[1]} fill="var(--red)" fillOpacity={0.12} stroke="none" ifOverflow="hidden" />
            )}

            <Tooltip
              content={<ChartTooltip short={short} />}
              cursor={{ stroke: 'var(--muted)', strokeWidth: 1 }}
              isAnimationActive={false}
            />

            <Line
              dataKey="limit"
              type="stepAfter"
              stroke="var(--red)"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="speed"
              type="linear"
              stroke="var(--blue)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              dot={false}
              activeDot={{ r: 5, fill: 'var(--blue)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="over"
              type="linear"
              stroke="var(--red)"
              strokeWidth={5}
              strokeLinejoin="round"
              strokeLinecap="round"
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="evY"
              stroke="none"
              dot={<EventMarker />}
              activeDot={false}
              isAnimationActive={false}
              legendType="none"
            />

            {live && (
              <ReferenceDot
                x={last.x}
                y={last.speed}
                r={7}
                fill="var(--blue)"
                stroke="var(--surface)"
                strokeWidth={3}
                ifOverflow="visible"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="chart-legend">
        <span><span className="key key--speed" aria-hidden="true" />Speed</span>
        <span><span className="key key--limit" aria-hidden="true" />Speed limit</span>
        {hasOver && <span><span className="key key--over" aria-hidden="true" />Over limit (+{TOLERANCE} km/h)</span>}
        {hasEvents && <span><span className="key key--event" aria-hidden="true" />Harsh event</span>}
        {live && <span><span className="key key--now" aria-hidden="true" />Now</span>}
        {area && <span><span className="key key--highlight" aria-hidden="true" />Selected</span>}
      </figcaption>
    </figure>
  );
}
