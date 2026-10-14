import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { checkSignIn, homeFor } from '../state/auth.js';
import SpeedSign from '../components/SpeedSign.jsx';
import '../styles/signin.css';

const DEMO = [
  { label: 'Traffic officer', id: 'NamPol-30418', pin: '2468' },
  { label: 'System admin', id: 'ADM-0007', pin: '1357' },
  { label: 'Suspended officer', id: 'NamPol-31902', pin: '2222' },
];

export default function SignIn() {
  const { state, currentUser, signIn, addAudit } = useApp();
  const navigate = useNavigate();
  const [forceNumber, setForceNumber] = useState(DEMO[0].id);
  const [pin, setPin] = useState(DEMO[0].pin);
  const [error, setError] = useState('');

  if (currentUser) return <Navigate to={homeFor(currentUser)} replace />;

  function fill(demo) {
    setForceNumber(demo.id);
    setPin(demo.pin);
    setError('');
  }

  function submit(e) {
    e.preventDefault();
    const result = checkSignIn(state.users, forceNumber, pin);
    if (result.error) {
      setError(result.error);
      if (result.user) addAudit(`Failed sign-in: ${result.error}`, result.user.name);
      return;
    }
    signIn(result.user.id);
    navigate(homeFor(result.user), { replace: true });
  }

  return (
    <main className="signin">
      <form className="signin-card card" onSubmit={submit} noValidate>
        <div className="signin-brand">
          <SpeedSign limit={60} size={56} decorative />
          <div>
            <h1>DriveWatch</h1>
            <p className="muted">Driver-behaviour monitoring for traffic officers</p>
          </div>
        </div>

        <label className="field">
          <span className="field-label">Force number</span>
          <input
            value={forceNumber}
            onChange={(e) => setForceNumber(e.target.value)}
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck="false"
          />
        </label>

        <label className="field">
          <span className="field-label">PIN</span>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            autoComplete="current-password"
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-block">Sign in</button>

        <div className="demo">
          <p className="field-label">Demo accounts</p>
          <div className="demo-buttons">
            {DEMO.map((d) => (
              <button key={d.id} type="button" className="btn-secondary" onClick={() => fill(d)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </main>
  );
}
