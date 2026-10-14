import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveVehicle } from '../../state/useLiveVehicle.js';
import { profileOf } from '../../data/analysis.js';
import SpeedSign from '../../components/SpeedSign.jsx';
import SeverityChip from '../../components/SeverityChip.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { WarningIcon } from '../../components/Icons.jsx';
import { formatClock, formatDate, formatDateTime, formatDuration } from '../../components/format.js';
import { article } from '../../components/SpeedChart.jsx';
import '../../styles/warnings.css';

function WarningCard({ v, tripIndex, violationIndex }) {
  const navigate = useNavigate();
  return (
    <li className={`warning warning--${v.severity}`}>
      <SpeedSign limit={v.limit} size={64} />
      <div className="warning-body">
        <div className="warning-title">
          <h3>
            <span className="num">{Math.round(v.peak)}</span> km/h in {article(v.limit)}{' '}
            <span className="num">{v.limit}</span> zone
          </h3>
          <SeverityChip severity={v.severity} />
        </div>
        <p className="warning-meta">
          <span>{v.road}</span>
          <span className="num">{formatDateTime(v.start)}</span>
          <span>over for <span className="num">{formatDuration(v.duration)}</span></span>
          <span><span className="num">+{Math.round(v.excess)}</span> km/h at peak</span>
        </p>
      </div>
      <button type="button" className="btn-secondary" onClick={() => navigate(`/evidence/${tripIndex}/${violationIndex}`)}>
        Prepare evidence
      </button>
    </li>
  );
}

export default function Warnings() {
  const data = useLiveVehicle();
  const profile = useMemo(() => (data ? profileOf(data) : null), [data]);

  if (!profile) return <section className="page"><p className="muted">Loading…</p></section>;

  // trips are newest first, so the current trip leads and earlier trips follow by date
  const groups = profile.trips
    .map((trip, tripIndex) => ({ trip, tripIndex }))
    .filter(({ trip }) => trip.viol.length > 0);
  const total = groups.reduce((n, g) => n + g.trip.viol.length, 0);

  return (
    <section className="page warnings">
      <div className="page-head">
        <h1>Warnings</h1>
        <p className="muted">
          {data.vehicle.reg} · <span className="num">{total}</span> speeding violation{total === 1 ? '' : 's'} across{' '}
          {profile.trips.length} recorded trips
        </p>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<WarningIcon size={40} />} title="No speeding warnings">
          This vehicle has not been more than 5 km/h over the limit for longer than one reading on any recorded trip.
        </EmptyState>
      ) : (
        groups.map(({ trip, tripIndex }) => (
          <section key={trip.id} className="warning-group" aria-labelledby={`group-${tripIndex}`}>
            <h2 id={`group-${tripIndex}`} className="warning-group-head">
              <span>{trip.live ? 'Current trip' : formatDate(trip.start)}</span>
              <span className="warning-group-sub">
                {trip.routeName}
                {!trip.live && <>, <span className="num">{formatClock(trip.start)}</span></>}
              </span>
              <span className="count num">{trip.viol.length}</span>
            </h2>
            <ul className="warning-list">
              {trip.viol
                .map((v, violationIndex) => ({ v, violationIndex }))
                .reverse()
                .map(({ v, violationIndex }) => (
                  <WarningCard key={v.start} v={v} tripIndex={tripIndex} violationIndex={violationIndex} />
                ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}
