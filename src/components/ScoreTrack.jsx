const THRESHOLDS = [50, 70, 85];

// Red-to-green track with a marker at the score (0 to 100).
export default function ScoreTrack({ score }) {
  const pos = Math.min(100, Math.max(0, score));
  return (
    <div className="score-track" role="img" aria-label={`Score ${score} out of 100`}>
      <div className="score-track-bar">
        {THRESHOLDS.map((t) => (
          <span key={t} className="score-track-tick" style={{ left: `${t}%` }} />
        ))}
        <span className="score-track-marker" style={{ left: `${pos}%` }} />
      </div>
      <div className="score-track-scale num" aria-hidden="true">
        <span style={{ left: '0%' }}>0</span>
        {THRESHOLDS.map((t) => (
          <span key={t} style={{ left: `${t}%` }}>{t}</span>
        ))}
        <span style={{ left: '100%' }}>100</span>
      </div>
    </div>
  );
}
