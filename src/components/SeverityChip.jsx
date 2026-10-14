const TONE = { minor: 'amber', major: 'orange', serious: 'red' };
const LABEL = { minor: 'Minor', major: 'Major', serious: 'Serious' };

export default function SeverityChip({ severity }) {
  return <span className={`chip chip--${TONE[severity]}`}>{LABEL[severity]}</span>;
}
