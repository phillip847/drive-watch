import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { homeFor } from '../state/auth.js';

// Sends signed-out users to /signin and users with the wrong role to their own home page.
export function RequireRole({ role }) {
  const { currentUser } = useApp();
  if (!currentUser) return <Navigate to="/signin" replace />;
  if (currentUser.role !== role) return <Navigate to={homeFor(currentUser)} replace />;
  return <Outlet />;
}

// Officer pages other than Scan need a scanned vehicle.
export function RequireVehicle() {
  const { state } = useApp();
  if (!state.currentDisc) return <Navigate to="/scan" replace />;
  return <Outlet />;
}
