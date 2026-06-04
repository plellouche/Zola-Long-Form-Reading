import { Bookmark, Compass, Share2 } from 'lucide-react';

const CARDS = [
  {
    icon: Compass,
    title: 'Discover',
    body: 'Swipe through articles to train a feed that learns your taste. Topics, sources, and signals from people you follow shape what surfaces next.',
  },
  {
    icon: Bookmark,
    title: 'Save',
    body: 'Bookmark essays you mean to read. Mark them finished. Build a real reading history instead of an open-tabs graveyard.',
  },
  {
    icon: Share2,
    title: 'Share',
    body: 'Organize what you love into lists. Follow people whose taste you trust, and connect over meaningful ideas.',
  },
] as const;

export function ProductExplainer() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="grid gap-8 sm:grid-cols-3">
        {CARDS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="text-center sm:text-left">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))]">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 font-serif text-2xl font-medium tracking-tight">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
              {body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
