// Round road sign showing a speed limit. Always white with a red ring, like the real sign.
export default function SpeedSign({ limit, size = 64, decorative = false }) {
  const text = String(limit);
  const fontSize = text.length >= 3 ? 38 : 48;
  const a11y = decorative
    ? { 'aria-hidden': true }
    : { role: 'img', 'aria-label': `Speed limit ${limit} km/h` };
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="speed-sign" {...a11y}>
      <circle cx="50" cy="50" r="43" fill="#FFFFFF" stroke="#C8102E" strokeWidth="13" />
      <text
        x="50"
        y="50"
        dy="0.35em"
        textAnchor="middle"
        fill="#15212A"
        fontFamily="'Barlow Condensed', sans-serif"
        fontWeight="700"
        fontSize={fontSize}
        letterSpacing={text.length >= 3 ? -1 : 0}
      >
        {text}
      </text>
    </svg>
  );
}
