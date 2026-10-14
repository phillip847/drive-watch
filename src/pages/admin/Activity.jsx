import { useEffect } from 'react';
import { useApp } from '../../state/AppContext.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { formatDateTimeFull } from '../../components/format.js';
import '../../styles/admin.css';

export default function Activity() {
  const { state, refresh } = useApp();

  // Pick up entries written since the last refresh, such as other users' sign-ins.
  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <section className="page admin">
      <h1>Activity</h1>
      {state.auditLog.length === 0 ? (
        <EmptyState title="No activity yet">Sign-ins, lookups, notices and admin changes will appear here.</EmptyState>
      ) : (
        <div className="card">
          <div className="table-scroll">
            <table className="data-table activity-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                </tr>
              </thead>
              <tbody>
                {state.auditLog.map((e) => (
                  <tr key={e.id}>
                    <td className="num">{formatDateTimeFull(e.time)}</td>
                    <td className="strong">{e.user}</td>
                    <td className="what">{e.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
