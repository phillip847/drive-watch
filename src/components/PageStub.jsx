// Temporary page body for screens that are not built yet.
export default function PageStub({ title, children }) {
  return (
    <section className="page">
      <h1>{title}</h1>
      <div className="card">
        {children ?? <p className="muted">This screen is coming soon.</p>}
      </div>
    </section>
  );
}
