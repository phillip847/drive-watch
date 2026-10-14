import { Bar, BarChart, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { classify } from '../data/analysis.js';
import { RISK_CLASSES, riskColor } from './risk.js';

const THRESHOLDS = [50, 70, 85];

function ScoreTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-time">{d.fullLabel}</div>
      <div><span className="num">{d.score}</span> / 100, {d.riskClass.toLowerCase()}</div>
      <div className="muted">{d.route}</div>
    </div>
  );
}

function DateTick({ x, y, payload, selectedKey, rows }) {
  const row = rows.find((r) => r.key === payload.value);
  if (!row) return null;
  const selected = row.key === selectedKey;
  return (
    <text x={x} y={y + 16} textAnchor="middle" fontSize={14}
      fill={selected ? 'var(--ink)' : 'var(--muted)'} fontWeight={selected ? 700 : 500}>
      {row.label}
    </text>
  );
}

/**
 * Behaviour score per trip.
 * rows: [{ key, label, fullLabel, route, score }] oldest to newest
 */
export default function ScoreBarChart({ rows, selectedKey, onSelect, height = 240 }) {
  const data = rows.map((r) => ({ ...r, riskClass: classify(r.score) }));
  const present = RISK_CLASSES.filter((c) => data.some((d) => d.riskClass === c));

  return (
    <figure className="score-chart">
      <div role="img" aria-label={`Behaviour score per trip: ${data.map((d) => `${d.label} ${d.score}`).join(', ')}`}>
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 28, right: 28, bottom: 8, left: 8 }}>
            <XAxis
              dataKey="key"
              tick={<DateTick selectedKey={selectedKey} rows={data} />}
              tickLine={false}
              axisLine={{ stroke: 'var(--line)' }}
              interval={0}
              height={28}
            />
            <YAxis domain={[0, 100]} hide />
            {THRESHOLDS.map((t) => (
              <ReferenceLine key={t} y={t} stroke="var(--line)" strokeWidth={1}
                label={{ value: t, position: 'right', fill: 'var(--muted)', fontSize: 12 }} />
            ))}
            <Tooltip content={<ScoreTooltip />} cursor={{ fill: 'var(--surface2)' }} isAnimationActive={false} />
            <Bar
              dataKey="score"
              maxBarSize={40}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
              onClick={(d) => onSelect?.(d.key)}
              cursor="pointer"
            >
              {data.map((d) => (
                <Cell key={d.key} fill={riskColor(d.riskClass)} />
              ))}
              <LabelList dataKey="score" position="top" offset={8} fill="var(--ink)" fontSize={18}
                fontFamily="var(--font-display)" fontWeight={700} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="chart-legend">
        {present.map((c) => (
          <span key={c}>
            <span className="key key--swatch" style={{ background: riskColor(c) }} aria-hidden="true" />
            {c}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
