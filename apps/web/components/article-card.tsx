import Link from 'next/link';

export type ArticleCardData = {
  id: string;
  title: string;
  author: string | null;
  publication_date: string | null;
  description: string | null;
  og_image_url: string | null;
  reading_time_minutes: number | null;
  source: { name: string; slug: string };
};

export function ArticleCard({ article }: { article: ArticleCardData }) {
  const date = article.publication_date
    ? new Date(article.publication_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Link
      href={`/article/${article.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-[hsl(var(--border))] transition hover:border-[hsl(var(--foreground))]"
    >
      {article.og_image_url && (
        <div className="aspect-[16/9] overflow-hidden bg-[hsl(var(--muted))]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.og_image_url}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          {article.source.name}
        </div>
        <h3 className="mt-2 text-base font-semibold leading-snug">{article.title}</h3>
        {article.description && (
          <p className="mt-2 line-clamp-3 text-sm text-[hsl(var(--muted-foreground))]">
            {article.description}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          {article.author && <span>{article.author}</span>}
          {article.author && date && <span>·</span>}
          {date && <span>{date}</span>}
          {article.reading_time_minutes && (
            <>
              <span>·</span>
              <span>{article.reading_time_minutes} min read</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
