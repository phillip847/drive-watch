import { useApp } from '../../state/AppContext.jsx';
import PageStub from '../../components/PageStub.jsx';

const fmt = new Intl.DateTimeFormat('en-NA', { dateStyle: 'medium', timeStyle: 'medium' });

export default function Activity() {
  const { state } = useApp();
  return (
    <PageStub title="Activity">
      {state.auditLog.length === 0 ? (
        <p className="muted">No activity yet.</p>
      ) : (
        <ul className="plain-list">
          {state.auditLog.map((e) => (
            <li key={e.id}>
              <span className="num">{fmt.format(e.time)}</span> · <strong>{e.user}</strong> · {e.action}
            </li>
          ))}
        </ul>
      )}
    </PageStub>
  );
}
