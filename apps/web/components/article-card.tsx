import Link from 'next/link';

import type { ArticleSummary } from '@/lib/api-types';

export type ArticleCardData = Pick<
  ArticleSummary,
  'id' | 'title' | 'author' | 'publication_date' | 'description' | 'og_image_url' | 'reading_time_minutes' | 'source'
>;

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
      className="group mb-4 block break-inside-avoid overflow-hidden rounded-lg border border-[hsl(var(--border))] transition hover:border-[hsl(var(--foreground))]"
    >
      {article.og_image_url && (
        <div className="overflow-hidden bg-[hsl(var(--muted))]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.og_image_url}
            alt=""
            className="w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        </div>
      )}
      <div className="flex flex-col p-4">
        <div className="text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          {article.source.name}
        </div>
        <h3 className="mt-2 text-base font-semibold leading-snug">{article.title}</h3>
        {article.description && (
          <p className="mt-2 line-clamp-3 text-sm text-[hsl(var(--muted-foreground))]">
            {article.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
          {article.author && <span>{article.author}</span>}
          {article.author && date && <span>·</span>}
          {date && <span>{date}</span>}
          {article.reading_time_minutes != null && (
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
