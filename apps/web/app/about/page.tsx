import type { Metadata } from 'next';
import Link from 'next/link';

import { getUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Zola is a discovery surface for long-form essays, reporting, and criticism. Curation is the product.',
  openGraph: { title: 'About Zola', type: 'website' },
};

export default async function AboutPage() {
  const user = await getUser();

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="font-display text-2xl text-[hsl(var(--primary))]">Zola</p>
      <h1 className="mt-4 font-serif text-4xl font-medium leading-tight tracking-tight">
        A library for evenings.
      </h1>

      <div className="mt-10 space-y-6 font-serif text-lg leading-relaxed text-[hsl(var(--foreground))]">
        <p>
          Zola is a discovery surface for long-form reading. Essays, reporting,
          criticism, the occasional dispatch — anything that asks for an hour
          and tries to deserve it. Every piece links out to its original
          publication; we don&rsquo;t host text or paraphrase. The product is
          the curation, the discovery, and the way it learns what you find
          worth your time.
        </p>

        <p>
          It is not an aggregator in the cynical sense. It is not a feed
          reader. It is not for skimming. It does not surface anything
          published in the last twelve hours. If you want news, Zola is the
          wrong website. If you want one essay you&rsquo;ll think about for
          a week, this is the right place.
        </p>

        <p>
          The current library pulls from publications I respect — Aeon, The
          Atlantic, Nautilus, Longreads, ProPublica, Quanta-adjacent venues,
          literary outlets, and a small but growing collection of essayists
          who post directly to the web. A{' '}
          <Link href="/sources" className="text-[hsl(var(--primary))] underline hover:no-underline">
            full source list
          </Link>{' '}
          lives elsewhere on the site. Every source defaults to{' '}
          <em>redirect-only</em>: a click on Zola sends you to the
          publisher&rsquo;s page so they get the read, the analytics, and the
          attribution. Curation should help writers, not skim from them.
        </p>

        <p>
          Zola is run by one person. It exists because I wanted a place to
          stack the essays I keep meaning to read but lose to other tabs, and
          because the aggregators I used to use have all become news sites.
          I&rsquo;d rather build the one I want than wait for someone else
          to.
        </p>

        <p>
          If that&rsquo;s your kind of thing, sign up. If you have an
          invite, even better. If you don&rsquo;t,{' '}
          <Link href="/browse" className="text-[hsl(var(--primary))] underline hover:no-underline">
            browse the library
          </Link>{' '}
          and see whether anything pulls you in.
        </p>
      </div>

      <div className="mt-12 flex flex-wrap gap-3">
        {user ? (
          <Link
            href="/"
            className="rounded-md bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))]"
          >
            Back to your feed
          </Link>
        ) : (
          <>
            <Link
              href="/signup"
              className="rounded-md bg-[hsl(var(--primary))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--primary-foreground))]"
            >
              Sign up
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-[hsl(var(--border))] px-5 py-2.5 text-sm font-medium hover:border-[hsl(var(--foreground))]"
            >
              Sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
