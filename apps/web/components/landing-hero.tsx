import Link from 'next/link';

export function LandingHero() {
  return (
    <section className="mx-auto max-w-4xl px-6 pt-24 pb-16 text-center">
      <p className="font-display text-2xl text-[hsl(var(--primary))]">Zola</p>
      <h1 className="mt-6 font-serif text-5xl font-medium leading-[1.05] tracking-tight sm:text-6xl">
         Long form journalism has a curation problem.
      </h1>
      <p className="mx-auto mt-6 max-w-2xl font-serif text-xl leading-relaxed text-[hsl(var(--muted-foreground))]">
       Zola is a platform with thousands of quality, curated articles and pieces of long form journalism that adapts to your interests. 
       Read about anything from Ernest Shackleton’s 20th century arctic expeditions
       to the early history of taxidermy. Share reads with friends through reading lists and see how your taste compares.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/signup"
          className="rounded-md bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))] transition hover:opacity-90"
        >
          Sign up
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-[hsl(var(--border))] px-5 py-2.5 text-sm font-medium hover:border-[hsl(var(--foreground))]"
        >
          Sign in
        </Link>
        <Link
          href="/browse"
          className="rounded-md px-5 py-2.5 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        >
          Browse without an account →
        </Link>
      </div>
    </section>
  );
}
