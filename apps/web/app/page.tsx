export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl font-semibold tracking-tight">Longform</h1>
      <p className="mt-4 text-lg text-[hsl(var(--muted-foreground))]">
        Pinterest-for-long-form-reading. Phase 0 scaffold is up.
      </p>
      <ul className="mt-8 space-y-2 text-sm text-[hsl(var(--muted-foreground))]">
        <li>
          API health check: <code>curl http://localhost:8000/healthz</code>
        </li>
        <li>See <code>COMMAND_CENTER.md</code> for the plan and <code>PROGRESS.md</code> for live state.</li>
      </ul>
    </main>
  );
}
