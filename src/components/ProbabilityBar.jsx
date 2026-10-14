import { pct } from './format.js';

export function probabilityLevel(p) {
  if (p < 0.35) return { tone: 'green', label: 'Low' };
  if (p <= 0.6) return { tone: 'amber', label: 'Elevated' };
  return { tone: 'red', label: 'High' };
}

export default function ProbabilityBar({ label, value }) {
  const level = probabilityLevel(value);
  return (
    <div className="prob">
      <div className="prob-head">
        <span className="prob-label">{label}</span>
        <span className="prob-value">
          <span className="num">{pct(value)}</span>
          <span className={`prob-level prob-level--${level.tone}`}>{level.label}</span>
        </span>
      </div>
      <div className="prob-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)} aria-valuetext={`${pct(value)}, ${level.label.toLowerCase()}`}>
        <span className={`prob-fill prob-fill--${level.tone}`} style={{ width: `${Math.max(1, value * 100)}%` }} />
      </div>
    </div>
  );
}
