import { useState } from 'react';
import { useApp } from '../../state/AppContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { formatDateTime } from '../../components/format.js';
import '../../styles/admin.css';

const PIN_TOAST_MS = 12000; // long enough to read the PIN out
const EMPTY = { name: '', id: '', station: '', role: 'officer' };
const ROLE_LABEL = { officer: 'Traffic officer', admin: 'System admin' };

function AddUserForm() {
  const { state, addUser } = useApp();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const stations = [...new Set(state.users.map((u) => u.station))].sort();

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    const name = form.name.trim();
    const id = form.id.trim();
    const station = form.station.trim();
    if (!name || !id || !station || !form.role) {
      setError('Fill in the full name, force number, station and role.');
      return;
    }
    if (state.users.some((u) => u.id.toLowerCase() === id.toLowerCase())) {
      setError(`Force number ${id} is already in use.`);
      return;
    }
    const result = await addUser({ id, name, station, role: form.role });
    if (result.error) {
      setError(result.error === 'duplicate_force_number' ? `Force number ${id} is already in use.` : 'Could not add the user.');
      return;
    }
    toast.show(`${name} added. Temporary PIN: ${result.temporaryPin}. Share it in person.`, {
      tone: 'success',
      duration: PIN_TOAST_MS,
    });
    setForm(EMPTY);
    setError('');
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>Add a user</h2>
      <div className="form-grid">
        <label className="field">
          <span className="field-label">Full name</span>
          <input value={form.name} onChange={set('name')} placeholder="Cst. A. Example" autoComplete="off" />
        </label>
        <label className="field">
          <span className="field-label">Force number</span>
          <input value={form.id} onChange={set('id')} placeholder="NamPol-00000" autoComplete="off" spellCheck="false" />
        </label>
        <label className="field">
          <span className="field-label">Station</span>
          <input value={form.station} onChange={set('station')} list="stations" autoComplete="off" />
          <datalist id="stations">
            {stations.map((s) => <option key={s} value={s} />)}
          </datalist>
        </label>
        <label className="field">
          <span className="field-label">Role</span>
          <select value={form.role} onChange={set('role')}>
            <option value="officer">Traffic officer</option>
            <option value="admin">System admin</option>
          </select>
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button type="submit">Add user</button>
    </form>
  );
}

export default function Users() {
  const { state, currentUser, setUserStatus, resetPin } = useApp();
  const toast = useToast();

  async function toggleStatus(u) {
    const status = u.status === 'active' ? 'suspended' : 'active';
    await setUserStatus(u, status);
    toast.show(`${u.name} ${status === 'active' ? 'reactivated' : 'suspended'}.`, {
      tone: status === 'active' ? 'success' : 'warning',
    });
  }

  async function reset(u) {
    const { temporaryPin } = await resetPin(u);
    toast.show(`New PIN for ${u.name}: ${temporaryPin}. Share it in person.`, { tone: 'info', duration: PIN_TOAST_MS });
  }

  return (
    <section className="page admin">
      <h1>Users</h1>
      <AddUserForm />

      <div className="card">
        <h2>Accounts</h2>
        <div className="table-scroll">
          <table className="data-table users-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Force number</th>
                <th scope="col">Role</th>
                <th scope="col">Station</th>
                <th scope="col">Last sign-in</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((u) => (
                <tr key={u.id}>
                  <td className="strong">{u.name}</td>
                  <td className="num">{u.id}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>{u.station}</td>
                  <td>{u.lastSignIn ? <span className="num">{formatDateTime(u.lastSignIn)}</span> : <span className="muted">Never</span>}</td>
                  <td>
                    <span className={`chip chip--${u.status === 'active' ? 'green' : 'red'}`}>
                      {u.status === 'active' ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="actions"><div className="actions-inner">
                    {u.id === currentUser.id ? (
                      <span className="muted">This is you</span>
                    ) : (
                      <>
                        <button type="button" className={u.status === 'active' ? 'btn-danger' : 'btn-secondary'} onClick={() => toggleStatus(u)}>
                          {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => reset(u)}>Reset PIN</button>
                      </>
                    )}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
