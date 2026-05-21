import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="text-sm uppercase tracking-wide text-[hsl(var(--muted-foreground))]">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
        That page doesn&rsquo;t exist, or you don&rsquo;t have access to it.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link
          href="/browse"
          className="rounded-md bg-[hsl(var(--foreground))] px-4 py-2 text-sm font-medium text-[hsl(var(--background))]"
        >
          Browse articles
        </Link>
        <Link
          href="/"
          className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm font-medium"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
