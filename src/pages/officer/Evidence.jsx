import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../../state/AppContext.jsx';
import { useLiveVehicle } from '../../state/useLiveVehicle.js';
import { BASE_ROAD_VERSION } from '../../state/initialState.js';
import { nextNoticeId } from '../../state/reducer.js';
import { buildEvidence, fingerprint, groupHex } from '../../data/evidence.js';
import { segmentType } from '../../data/roads.js';
import { useToast } from '../../components/Toast.jsx';
import SpeedChart from '../../components/SpeedChart.jsx';
import SpeedSign from '../../components/SpeedSign.jsx';
import SeverityChip from '../../components/SeverityChip.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { EvidenceIcon } from '../../components/Icons.jsx';
import { formatDateTimeFull, formatDuration, formatLatLng } from '../../components/format.js';
import '../../styles/evidence.css';

function useFingerprint(record) {
  const [hash, setHash] = useState(undefined); // undefined = computing, null = unavailable
  const json = record ? JSON.stringify(record) : null;
  useEffect(() => {
    let cancelled = false;
    setHash(undefined);
    if (!json) return undefined;
    fingerprint(JSON.parse(json)).then((h) => !cancelled && setHash(h));
    return () => {
      cancelled = true;
    };
  }, [json]);
  return hash;
}

function Fact({ label, children, wide }) {
  return (
    <div className={`fact${wide ? ' fact--wide' : ''}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default function Evidence() {
  const { tripIndex, violationIndex } = useParams();
  const { state, currentUser, issueNotice } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const data = useLiveVehicle();

  const hasSelection = tripIndex !== undefined && violationIndex !== undefined;
  const ev = useMemo(
    () => (data && hasSelection ? buildEvidence(data, Number(tripIndex), Number(violationIndex), BASE_ROAD_VERSION) : null),
    [data, hasSelection, tripIndex, violationIndex]
  );
  const hash = useFingerprint(ev?.record);

  if (!hasSelection || (data && !ev)) {
    return (
      <section className="page">
        <h1>Enforcement evidence</h1>
        <EmptyState
          icon={<EvidenceIcon size={40} />}
          title={hasSelection ? 'That warning was not found' : 'No warning selected'}
          action={<Link className="btn" to="/warnings">Go to Warnings</Link>}
        >
          Choose a speeding warning and tap Prepare evidence to build an enforcement record.
        </EmptyState>
      </section>
    );
  }
  if (!ev) return <section className="page"><p className="muted">Loading…</p></section>;

  const { record, violation, peak, windowSamples, timeOffset, ongoing } = ev;
  const vehicle = data.vehicle;
  const notice = state.issuedNotices.find((n) => n.evidenceNo === ev.evidenceNo);

  function issue() {
    const id = nextNoticeId(state, Date.now());
    issueNotice({
      id,
      evidenceNo: ev.evidenceNo,
      disc: vehicle.disc,
      reg: vehicle.reg,
      owner: vehicle.owner,
      fingerprint: hash,
      officer: currentUser.name,
    });
    if (state.online) {
      toast.show(`Notice issued to the registered owner. Reference ${id}.`, { tone: 'success' });
    } else {
      toast.show('Notice saved on this tablet. It will be issued when back online.', { tone: 'warning' });
    }
  }

  return (
    <section className="page evidence">
      <header className="evidence-head">
        <div>
          <h1>Enforcement evidence</h1>
          <p className="muted">Speeding record built from ECU and GPS data, in place of a fixed speed camera.</p>
        </div>
        <div className="evidence-head-sign">
          <SpeedSign limit={record.limit} size={72} />
          <SeverityChip severity={violation.severity} />
        </div>
      </header>

      {ongoing && (
        <p className="note note--offline">
          <strong>Still over the limit.</strong> This record updates with each ECU reading. Issue the notice once the
          vehicle is back within the limit.
        </p>
      )}

      <div className="card">
        <dl className="facts-grid">
          <Fact label="Evidence number"><span className="num">{ev.evidenceNo}</span></Fact>
          <Fact label="Vehicle">
            {vehicle.reg}, {vehicle.make} <span className="num">{vehicle.year}</span>
            <span className="fact-sub">Owner: {vehicle.owner}</span>
          </Fact>
          <Fact label="Disc"><span className="num">{vehicle.disc}</span></Fact>
          <Fact label="Road">
            {record.road}
            <span className="fact-sub">{segmentType(record.segment)}</span>
          </Fact>
          <Fact label="Road segment">
            <span className="num">{record.segment}</span>
            <span className="fact-sub">Road Authority data {record.roadVersion}</span>
          </Fact>
          <Fact label="Posted limit"><span className="num">{record.limit}</span> km/h</Fact>
          <Fact label="Peak speed">
            <span className="fact-big num">{Math.round(record.peakSpeed)}</span> km/h
            <span className="fact-sub"><span className="num">{Math.round(record.excess)}</span> km/h over the limit</span>
          </Fact>
          <Fact label="Time at peak"><span className="num">{formatDateTimeFull(record.peakTime)}</span></Fact>
          <Fact label="Over the limit">
            From <span className="num">{formatDateTimeFull(record.overFrom)}</span>
            <span className="fact-sub">for <span className="num">{formatDuration(record.durationSec)}</span></span>
          </Fact>
          <Fact label="GPS position at peak">
            <span className="num">{formatLatLng(record.position.lat, record.position.lng)}</span>
          </Fact>
          <Fact label="Source" wide>{record.source}</Fact>
          <Fact label="Record fingerprint (SHA-256)" wide>
            {hash === undefined && <span className="muted">Calculating…</span>}
            {hash === null && <span className="muted">Unavailable. Fingerprints need a secure (https) connection.</span>}
            {hash && <code className="fingerprint num">{groupHex(hash)}</code>}
          </Fact>
        </dl>
      </div>

      <div className="card">
        <h2>Speed around the violation</h2>
        <p className="muted chart-sub">
          Two minutes either side, peak at <span className="num">{Math.round(peak.speed)}</span> km/h. Time is shown from
          the start of the trip.
        </p>
        <SpeedChart
          samples={windowSamples}
          highlight={[violation.start, violation.end]}
          timeOffset={timeOffset}
          height={260}
        />
      </div>

      <div className="evidence-actions">
        <button type="button" className="btn-secondary" onClick={() => navigate('/warnings')}>
          Back to warnings
        </button>
        {notice ? (
          <p className={`notice-status notice-status--${notice.status}`} role="status">
            {notice.status === 'issued'
              ? <>Notice issued to the registered owner. Reference <span className="num">{notice.id}</span>.</>
              : <>Notice <span className="num">{notice.id}</span> saved on this tablet. It will be issued when back online.</>}
          </p>
        ) : (
          <button type="button" className="btn-issue" onClick={issue} disabled={ongoing || !hash}>
            Issue notice
          </button>
        )}
      </div>
    </section>
  );
}
