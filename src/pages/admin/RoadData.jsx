import { useState } from 'react';
import { useApp } from '../../state/AppContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import SpeedSign from '../../components/SpeedSign.jsx';
import '../../styles/admin.css';

const LIMIT_ERROR = 'Enter a limit from 20 to 140 km/h, in steps of 10.';

export function validLimit(value) {
  const n = Number(value);
  return value !== '' && Number.isInteger(n) && n >= 20 && n <= 140 && n % 10 === 0;
}

function SyncPanel() {
  const { state, checkRoadUpdate, dismissRoadUpdate, applyRoadUpdate } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const pending = state.roadUpdate;
  const roadOf = (seg) => state.roads.segments.find((s) => s.id === seg)?.road ?? seg;

  async function check() {
    setBusy(true);
    const update = await checkRoadUpdate();
    setBusy(false);
    if (!update) toast.show('Road data is up to date', { tone: 'success' });
  }

  async function apply() {
    setBusy(true);
    const version = await applyRoadUpdate();
    setBusy(false);
    toast.show(`Road data updated to ${version}. Live checks never stopped.`, { tone: 'success' });
  }

  return (
    <div className="card">
      <div className="sync-head">
        <div>
          <h2>Road Authority sync</h2>
          <p className="muted">
            Current version <strong className="num version">{state.roads.version}</strong>
          </p>
        </div>
        {!pending && (
          <button type="button" onClick={check} disabled={busy}>
            {busy ? 'Checking…' : 'Check for updates'}
          </button>
        )}
      </div>

      {pending && (
        <div className="update-box">
          <h3>
            Update <span className="num">{pending.version}</span>: {pending.changes.length} limit changes
          </h3>
          <ul className="update-list">
            {pending.changes.map((c) => (
              <li key={c.seg}>
                <span className="num seg-id">{c.seg}</span>
                <span className="update-road">{roadOf(c.seg)}</span>
                <span className="update-limits num">
                  {c.was} → {c.limit} km/h
                </span>
                <span className="update-reason">{c.reason}</span>
              </li>
            ))}
          </ul>
          <div className="button-row">
            <button type="button" onClick={apply} disabled={busy}>Apply update</button>
            <button type="button" className="btn-secondary" onClick={dismissRoadUpdate} disabled={busy}>Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SegmentRow({ seg }) {
  const { setLimit } = useApp();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  function start() {
    setValue(String(seg.limit));
    setError('');
    setEditing(true);
  }

  async function save(e) {
    e.preventDefault();
    if (!validLimit(value)) {
      setError(LIMIT_ERROR);
      return;
    }
    const next = Number(value);
    if (next !== seg.limit) {
      await setLimit(seg.id, next);
      toast.show(`${seg.road} is now ${next} km/h. Live checks use it from now on.`, { tone: 'success' });
    }
    setEditing(false);
  }

  return (
    <tr>
      <td><SpeedSign limit={seg.limit} size={44} /></td>
      <td>
        <div className="strong">{seg.road}</div>
        {seg.note && <div className="change-note">{seg.note}</div>}
      </td>
      <td className="num">{seg.id}</td>
      <td>{seg.type}</td>
      <td className="actions">
        {editing ? (
          <form className="limit-form" onSubmit={save} noValidate>
            <label className="sr-only" htmlFor={`limit-${seg.id}`}>New limit for {seg.road} in km/h</label>
            <input
              id={`limit-${seg.id}`}
              type="number"
              inputMode="numeric"
              min={20}
              max={140}
              step={10}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `limit-err-${seg.id}` : undefined}
              autoFocus
            />
            <button type="submit">Save</button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            {error && <p className="form-error limit-error" id={`limit-err-${seg.id}`} role="alert">{error}</p>}
          </form>
        ) : (
          <button type="button" className="btn-secondary" onClick={start}>Edit limit</button>
        )}
      </td>
    </tr>
  );
}

export default function RoadData() {
  const { state } = useApp();
  return (
    <section className="page admin">
      <h1>Road data</h1>
      <p className="intro">
        Speed limits come from the Road Authority&rsquo;s Road Network System. Changes reach live checks immediately,
        with no downtime. Earlier records keep the limit that applied when they were captured.
      </p>

      <SyncPanel />

      <div className="card">
        <h2>Road segments</h2>
        <div className="table-scroll">
          <table className="data-table roads-table">
            <thead>
              <tr>
                <th scope="col">Limit</th>
                <th scope="col">Road</th>
                <th scope="col">Segment</th>
                <th scope="col">Type</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {state.roads.segments.map((seg) => <SegmentRow key={seg.id} seg={seg} />)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
