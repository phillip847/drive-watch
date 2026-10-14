import { riskTone } from './risk.js';

// Severe risk uses a solid red chip so it stands apart from High risk.
export default function RiskChip({ riskClass, label = riskClass }) {
  const tone = riskTone(riskClass);
  return <span className={`chip chip--${tone === 'red' ? 'severe' : tone}`}>{label}</span>;
}
