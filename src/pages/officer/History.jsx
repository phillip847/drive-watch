import { useMemo, useState } from 'react';
import { useLiveVehicle } from '../../state/useLiveVehicle.js';
import { classify, profileOf } from '../../data/analysis.js';
import ScoreBarChart from '../../components/ScoreBarChart.jsx';
import SpeedChart from '../../components/SpeedChart.jsx';
import RiskChip from '../../components/RiskChip.jsx';
import { formatClock, formatDate, formatDateTime, formatDuration, formatKm } from '../../components/format.js';
import '../../styles/history.css';

const shortRoad = (name) => name.split(',')[0];

const routeSummary = (trip) => `${shortRoad(trip.startRoad)} → ${shortRoad(trip.endRoad)}`;

const isToday = (ms) => new Date(ms).toDateString() === new Date().toDateString();

export default function History() {
  const data = useLiveVehicle();
  const profile = useMemo(() => (data ? profileOf(data) : null), [data]);
  const [selected, setSelected] = useState(0); // index into data.trips (0 = current trip)

  if (!data || !profile) return <section className="page"><p className="muted">Loading…</p></section>;

  const rows = profile.trips.map((t, i) => {
    const trip = data.trips[i];
    return {
      index: i,
      key: t.id,
      label: isToday(t.start) ? 'Today' : formatDate(t.start).replace(/^\w+ /, ''),
      dateText: t.live ? 'Today (in progress)' : formatDateTime(t.start),
      fullLabel: t.live ? 'Current trip' : `${formatDate(t.start)}, ${formatClock(t.start)}`,
      route: routeSummary(trip),
      km: t.km,
      durationSec: t.durationSec,
      warnings: t.viol.length,
      score: t.score,
      brakes: t.brakes,
      accels: t.accels,
    };
  });
  const sel = rows[selected] ?? rows[0];
  const selTrip = data.trips[sel.index];

  function onKeyDown(e, index) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelected(index);
    }
  }

  return (
    <section className="page history">
      <div className="page-head">
        <h1>Trip history</h1>
        <p className="muted">
          {data.vehicle.reg} · cumulative score <span className="num">{profile.cumulative}</span> / 100 across{' '}
          {rows.length} trips
        </p>
      </div>

      <div className="card">
        <h2>Behaviour score per trip</h2>
        <ScoreBarChart
          rows={[...rows].reverse()}
          selectedKey={sel.key}
          onSelect={(key) => setSelected(rows.findIndex((r) => r.key === key))}
        />
      </div>

      <div className="card">
        <h2>Trips</h2>
        <div className="table-scroll">
          <table className="data-table trip-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Route</th>
                <th scope="col" className="n">Distance</th>
                <th scope="col" className="n">Duration</th>
                <th scope="col" className="n">Warnings</th>
                <th scope="col">Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  tabIndex={0}
                  aria-current={r.index === sel.index ? 'true' : undefined}
                  className={r.index === sel.index ? 'is-selected' : ''}
                  onClick={() => setSelected(r.index)}
                  onKeyDown={(e) => onKeyDown(e, r.index)}
                >
                  <td className={r.index === 0 ? 'strong' : ''}>{r.dateText}</td>
                  <td>{r.route}</td>
                  <td className="n"><span className="num">{formatKm(r.km)}</span> km</td>
                  <td className="n num">{formatDuration(r.durationSec)}</td>
                  <td className="n num">{r.warnings}</td>
                  <td><RiskChip riskClass={classify(r.score)} label={<span className="num">{r.score}</span>} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <header className="selected-head">
          <div>
            <h2>{sel.index === 0 ? 'Current trip' : `Trip on ${sel.fullLabel}`}</h2>
            <p className="muted">{selTrip.routeName}</p>
          </div>
          <dl className="event-counts">
            <div><dt>Harsh braking</dt><dd className="num">{sel.brakes}</dd></div>
            <div><dt>Harsh acceleration</dt><dd className="num">{sel.accels}</dd></div>
          </dl>
        </header>
        <SpeedChart
          samples={selTrip.samples}
          totalSamples={selTrip.totalSamples}
          live={Boolean(selTrip.live && !selTrip.ended)}
          height={260}
        />
      </div>
    </section>
  );
}
