import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../state/AppContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { listVehicles, lookupDisc } from '../../data/api.js';
import Plate from '../../components/Plate.jsx';
import '../../styles/scan.css';

const SCAN_MS = 1400;

export default function Scan() {
  const { state, setDisc, addAudit } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [discInput, setDiscInput] = useState('');
  const [error, setError] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    listVehicles().then(setVehicles);
    return () => clearTimeout(timer.current);
  }, []);

  function open(vehicle) {
    const firstOffline = !state.online && !state.offlineScans.includes(vehicle.disc);
    setDisc(vehicle.disc);
    addAudit(`Looked up ${vehicle.reg} (disc ${vehicle.disc})`);
    if (firstOffline) {
      toast.show(
        `Opened ${vehicle.reg} from records saved on the tablet. New ECU data will sync when you are back online.`,
        { tone: 'warning' }
      );
    } else {
      toast.show(`Opened ${vehicle.reg}, ${vehicle.make}.`, { tone: 'success' });
    }
    navigate('/vehicle');
  }

  // Simulated camera read: opens the demo vehicles one after another.
  function startScan() {
    if (scanning || vehicles.length === 0) return;
    setError('');
    setScanning(true);
    timer.current = setTimeout(() => {
      const current = vehicles.findIndex((v) => v.disc === state.currentDisc);
      setScanning(false);
      open(vehicles[(current + 1) % vehicles.length]);
    }, SCAN_MS);
  }

  async function lookUp(e) {
    e.preventDefault();
    const entered = discInput.trim().toUpperCase();
    if (!entered) {
      setError('Enter the disc number printed on the licence disc.');
      return;
    }
    const vehicle = await lookupDisc(entered);
    if (!vehicle) {
      setError(`No vehicle is linked to disc ${entered}. Check the number on the disc and try again.`);
      return;
    }
    setError('');
    open(vehicle);
  }

  return (
    <section className="page scan">
      <h1>Scan disc</h1>

      {!state.online && (
        <p className="note note--offline">
          <strong>Offline.</strong> Discs are matched against records saved on the tablet.
        </p>
      )}

      <div className="scan-grid">
        <div className="scan-camera-panel">
          <div className={`viewfinder${scanning ? ' is-scanning' : ''}`}>
            <div className="viewfinder-circle">
              {scanning && <div className="viewfinder-beam" aria-hidden="true" />}
            </div>
            <p className="viewfinder-text" aria-live="polite">
              {scanning ? 'Reading disc…' : 'Line up the disc inside the circle'}
            </p>
          </div>
          <button type="button" className="scan-button" onClick={startScan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan disc'}
          </button>
        </div>

        <div className="scan-side">
          <form className="card" onSubmit={lookUp} noValidate>
            <label className="field" htmlFor="disc-input">
              <span className="field-label">Enter disc number</span>
            </label>
            <div className="lookup-row">
              <input
                id="disc-input"
                className="num"
                value={discInput}
                onChange={(e) => setDiscInput(e.target.value.toUpperCase())}
                placeholder="NAM-D-00000"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck="false"
              />
              <button type="submit">Look up</button>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>

          <div className="card">
            <h2 className="section-title">Discs in range</h2>
            <ul className="disc-list">
              {vehicles.map((v) => (
                <li key={v.disc}>
                  <button
                    type="button"
                    className={`disc-item${state.currentDisc === v.disc ? ' is-current' : ''}`}
                    onClick={() => open(v)}
                  >
                    <Plate reg={v.reg} size="sm" />
                    <span className="disc-item-text">
                      <span className="disc-item-make">{v.make}</span>
                      <span className="disc-item-disc num">{v.disc}</span>
                    </span>
                    <span className="disc-item-go" aria-hidden="true">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
