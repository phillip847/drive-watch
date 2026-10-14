import { useMemo } from 'react';
import { useLiveVehicle } from '../../state/useLiveVehicle.js';
import { profileOf, narrative, TOLERANCE } from '../../data/analysis.js';
import Plate from '../../components/Plate.jsx';
import SpeedSign from '../../components/SpeedSign.jsx';
import SpeedChart from '../../components/SpeedChart.jsx';
import RiskChip from '../../components/RiskChip.jsx';
import ScoreTrack from '../../components/ScoreTrack.jsx';
import ProbabilityBar from '../../components/ProbabilityBar.jsx';
import { formatKm, formatLatLng, formatTime } from '../../components/format.js';
import '../../styles/vehicle.css';

const PREDICTIONS = [
  ['speeding', 'Speeding'],
  ['harshBraking', 'Harsh braking'],
  ['harshAccel', 'Harsh acceleration'],
  ['erratic', 'Erratic driving'],
];

function IdentityCard({ vehicle }) {
  return (
    <div className="card identity">
      <Plate reg={vehicle.reg} size="lg" />
      <div className="identity-body">
        <h1 className="identity-make">
          {vehicle.make} <span className="num muted">{vehicle.year}</span>
        </h1>
        <dl className="facts facts--inline">
          <div><dt>Colour</dt><dd>{vehicle.colour}</dd></div>
          <div><dt>Registered owner</dt><dd>{vehicle.owner}</dd></div>
          <div><dt>Disc number</dt><dd className="num">{vehicle.disc}</dd></div>
          <div><dt>ECU unit</dt><dd className="num">{vehicle.ecu}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function CurrentTrip({ trip, tripStats }) {
  const now = trip.samples[trip.samples.length - 1];
  const overBy = Math.round(now.speed - now.limit);
  const isOver = now.speed > now.limit + TOLERANCE;

  return (
    <div className="card trip">
      <header className="panel-head">
        <div>
          <h2>Current trip</h2>
          <p className="muted panel-sub">{trip.routeName}</p>
        </div>
        {trip.ended ? (
          <span className="ecu-tag ecu-tag--ended">Trip ended</span>
        ) : (
          <span className="ecu-tag"><span className="ecu-dot" aria-hidden="true" />Receiving from ECU</span>
        )}
      </header>

      <div className="trip-now">
        <SpeedSign limit={now.limit} size={128} />
        <div className={`speed-readout${isOver ? ' is-over' : ''}`}>
          <div className="speed-big num">
            {Math.round(now.speed)}
            <span className="speed-unit">km/h</span>
          </div>
          {isOver ? (
            <div className="over-msg"><span className="num">{overBy}</span> km/h over the limit</div>
          ) : (
            <div className="muted">Within the limit</div>
          )}
        </div>
        <dl className="facts trip-facts">
          <div><dt>Road</dt><dd>{now.road}</dd></div>
          <div>
            <dt>GPS</dt>
            <dd><span className="num">{formatLatLng(now.lat, now.lng)}</span>, segment <span className="num">{now.seg}</span></dd>
          </div>
          <div><dt>Engine</dt><dd><span className="num">{now.rpm.toLocaleString('en-GB')}</span> rpm</dd></div>
          <div><dt>Distance</dt><dd><span className="num">{formatKm(tripStats.km)}</span> km</dd></div>
          <div><dt>Started</dt><dd className="num">{formatTime(trip.start)}</dd></div>
        </dl>
      </div>

      <SpeedChart samples={trip.samples} totalSamples={trip.totalSamples} live={!trip.ended} height={260} />
    </div>
  );
}

function DriverBehaviour({ profile, sentences }) {
  return (
    <div className="card">
      <h2>Driver behaviour</h2>
      <div className="score-row">
        <div className="score-big num">
          {profile.cumulative}
          <span className="score-of"> / 100</span>
        </div>
        <RiskChip riskClass={profile.riskClass} />
      </div>
      <ScoreTrack score={profile.cumulative} />
      <div className="narrative">
        {sentences.map((s) => (
          <p key={s}>{s}</p>
        ))}
      </div>
    </div>
  );
}

function PredictedBehaviour({ predictions }) {
  return (
    <div className="card">
      <h2>Predicted behaviour</h2>
      <div className="prob-list">
        {PREDICTIONS.map(([key, label]) => (
          <ProbabilityBar key={key} label={label} value={predictions[key]} />
        ))}
      </div>
      <p className="muted model-note">
        Prototype model: weighs time over the limit, harsh events per 100 km and speed variability across recorded trips.
      </p>
    </div>
  );
}

export default function Vehicle() {
  const data = useLiveVehicle();
  // Recomputes on each feed tick; finished trips come from the analysis cache.
  const profile = useMemo(() => (data ? profileOf(data) : null), [data]);
  const sentences = useMemo(() => (data && profile ? narrative(data, profile) : []), [data, profile]);

  if (!data || !profile) {
    return (
      <section className="page">
        <p className="muted">Connecting to the vehicle unit…</p>
      </section>
    );
  }

  return (
    <section className="page vehicle">
      <IdentityCard vehicle={data.vehicle} />
      <CurrentTrip trip={data.trips[0]} tripStats={profile.trips[0]} />
      <div className="panel-pair">
        <DriverBehaviour profile={profile} sentences={sentences} />
        <PredictedBehaviour predictions={profile.predictions} />
      </div>
    </section>
  );
}
