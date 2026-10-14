import { useMemo } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { useLiveVehicle } from '../state/useLiveVehicle.js';
import { analyse, recordedSamples } from '../data/analysis.js';
import { useToast } from './Toast.jsx';
import {
  ScanIcon, VehicleIcon, WarningIcon, HistoryIcon, EvidenceIcon,
  UsersIcon, RoadIcon, ActivityIcon, SignOutIcon
} from './Icons.jsx';
import SpeedSign from './SpeedSign.jsx';
import '../styles/layout.css';

const OFFICER_NAV = [
  { to: '/scan', label: 'Scan', Icon: ScanIcon, always: true },
  { to: '/vehicle', label: 'Vehicle', Icon: VehicleIcon },
  { to: '/warnings', label: 'Warnings', Icon: WarningIcon, badge: 'warnings' },
  { to: '/history', label: 'History', Icon: HistoryIcon },
  { to: '/evidence', label: 'Evidence', Icon: EvidenceIcon },
];

const ADMIN_NAV = [
  { to: '/admin/users', label: 'Users', Icon: UsersIcon, always: true },
  { to: '/admin/roads', label: 'Road data', Icon: RoadIcon, always: true },
  { to: '/admin/activity', label: 'Activity', Icon: ActivityIcon, always: true },
];

export default function Layout() {
  const { state, currentUser, setOnline, signOut } = useApp();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdmin = currentUser.role === 'admin';
  const vehicleData = useLiveVehicle();
  const warningCount = useMemo(() => {
    if (!vehicleData) return 0;
    return analyse(recordedSamples(vehicleData, vehicleData.trips[0])).viol.length;
  }, [vehicleData]);
  const badges = { warnings: warningCount };

  async function toggleOnline() {
    if (state.online) {
      await setOnline(false);
      toast.show('Offline. ECU data is buffered on the vehicle unit and synced later.', { tone: 'warning' });
    } else {
      const n = state.bufferedCount;
      const notices = await setOnline(true);
      const extra = notices ? ` Issued ${notices} saved notice${notices === 1 ? '' : 's'}.` : '';
      toast.show(`Back online. Synced ${n} buffered ECU record${n === 1 ? '' : 's'}.${extra}`, { tone: 'success' });
    }
  }

  async function handleSignOut() {
    await signOut();
    toast.clear();
    navigate('/signin', { replace: true });
  }

  const nav = isAdmin ? ADMIN_NAV : OFFICER_NAV;

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="topbar">
        <div className="brand">
          <SpeedSign limit={60} size={36} decorative />
          <span className="brand-name">DriveWatch</span>
        </div>

        <div className="topbar-pills">
          <span className="pill pill--neutral">
            Road data <span className="num">{state.roads.version}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={state.online}
            className={`pill pill--toggle ${state.online ? 'is-online' : 'is-offline'}`}
            onClick={toggleOnline}
            title={state.online ? 'Switch to offline' : 'Switch to online'}
          >
            <span className="dot" aria-hidden="true" />
            {state.online ? 'Online' : 'Offline'}
            {!state.online && (
              <span className="buffered">
                (<span className="num">{state.bufferedCount}</span> buffered)
              </span>
            )}
          </button>
        </div>

        <div className="topbar-user">
          {currentUser.name}
          {isAdmin && <span className="muted"> (admin)</span>}
        </div>
      </header>

      <nav className="rail" aria-label="Main">
        {nav.map(({ to, label, Icon, always, badge }) => {
          const enabled = always || Boolean(state.currentDisc);
          const count = badge ? badges[badge] : 0;
          const inner = (
            <>
              <span className="rail-icon">
                <Icon />
                {count > 0 && <span className="badge num" aria-hidden="true">{count}</span>}
              </span>
              <span className="rail-label">{label}</span>
              {count > 0 && <span className="sr-only">, {count} on current trip</span>}
            </>
          );
          return enabled ? (
            <NavLink key={to} to={to} className="rail-item">
              {inner}
            </NavLink>
          ) : (
            <span key={to} className="rail-item is-disabled" aria-disabled="true" title="Scan a vehicle first">
              {inner}
            </span>
          );
        })}
        <button type="button" className="rail-item rail-signout" onClick={handleSignOut}>
          <span className="rail-icon"><SignOutIcon /></span>
          <span className="rail-label">Sign out</span>
        </button>
      </nav>

      <main className="content" id="main" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
