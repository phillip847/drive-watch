// One colour per risk class, shared by chips and charts.
export const RISK_CLASSES = ['Low risk', 'Moderate risk', 'High risk', 'Severe risk'];

const TONE = {
  'Low risk': 'green',
  'Moderate risk': 'amber',
  'High risk': 'orange',
  'Severe risk': 'red',
};

export const riskTone = (riskClass) => TONE[riskClass] ?? 'neutral';
export const riskColor = (riskClass) => `var(--${riskTone(riskClass)})`;
