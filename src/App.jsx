import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './state/AppContext.jsx';
import { homeFor } from './state/auth.js';
import { RequireRole, RequireVehicle } from './components/RequireRole.jsx';
import Layout from './components/Layout.jsx';
import SignIn from './pages/SignIn.jsx';
import Scan from './pages/officer/Scan.jsx';
import Vehicle from './pages/officer/Vehicle.jsx';
import Warnings from './pages/officer/Warnings.jsx';
import History from './pages/officer/History.jsx';
import Evidence from './pages/officer/Evidence.jsx';
import Users from './pages/admin/Users.jsx';
import RoadData from './pages/admin/RoadData.jsx';
import Activity from './pages/admin/Activity.jsx';

function Home() {
  const { currentUser } = useApp();
  return <Navigate to={currentUser ? homeFor(currentUser) : '/signin'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />

      <Route element={<RequireRole role="officer" />}>
        <Route element={<Layout />}>
          <Route path="/scan" element={<Scan />} />
          <Route element={<RequireVehicle />}>
            <Route path="/vehicle" element={<Vehicle />} />
            <Route path="/warnings" element={<Warnings />} />
            <Route path="/history" element={<History />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/evidence/:tripIndex/:violationIndex" element={<Evidence />} />
          </Route>
        </Route>
      </Route>

      <Route path="/admin" element={<RequireRole role="admin" />}>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<Users />} />
          <Route path="roads" element={<RoadData />} />
          <Route path="activity" element={<Activity />} />
        </Route>
      </Route>

      <Route path="*" element={<Home />} />
    </Routes>
  );
}
