export default function EmptyState({ icon, title, children, action }) {
  return (
    <div className="card empty-state">
      {icon && <span className="empty-state-icon">{icon}</span>}
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
