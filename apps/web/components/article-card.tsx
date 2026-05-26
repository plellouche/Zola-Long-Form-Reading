import Link from 'next/link';

import { AccessTierChip } from '@/components/access-tier-chip';
import { AddToList } from '@/components/add-to-list';
import { ArticleImageFallback } from '@/components/article-image-fallback';
import { SaveButton } from '@/components/save-button';
import type { ArticleSummary } from '@/lib/api-types';
import { stripHtml } from '@/lib/utils';

export type ArticleCardData = Pick<
  ArticleSummary,
  | 'id'
  | 'title'
  | 'author'
  | 'publication_date'
  | 'description'
  | 'og_image_url'
  | 'reading_time_minutes'
  | 'access_tier'
  | 'source'
>;

type Props = {
  article: ArticleCardData;
  /** When provided, show the SaveButton + AddToList icon. Set by feed pages
   *  once they know whether the viewer is signed in. */
  showSave?: boolean;
  initiallySaved?: boolean;
};

export function ArticleCard({ article, showSave = false, initiallySaved = false }: Props) {
  const date = article.publication_date
    ? new Date(article.publication_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="group relative mb-4 break-inside-avoid">
      {showSave && (
        <div className="absolute right-2 top-2 z-10 flex gap-1">
          <AddToList articleId={article.id} variant="icon" />
          <SaveButton articleId={article.id} initiallySaved={initiallySaved} />
        </div>
      )}
      <Link
        href={`/article/${article.id}`}
        className="block overflow-hidden rounded-lg border border-[hsl(var(--border))] transition duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md hover:border-[hsl(var(--foreground))]"
      >
        {/* Always render an image area so cards have consistent visual
            rhythm in the grid. Falls back to a muted gradient for the
            ~250 PG essays and other sparse-metadata articles. */}
        <div className="aspect-[16/9] overflow-hidden bg-[hsl(var(--muted))]">
          {article.og_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.og_image_url}
              alt=""
              className="h-full w-full object-cover transition group-hover:scale-[1.02]"
              loading="lazy"
            />
          ) : (
            <ArticleImageFallback
              seed={article.id}
              sourceName={article.source.name}
            />
          )}
        </div>
        <div className="flex flex-col p-4">
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-[hsl(var(--accent))]">
              {article.source.name}
            </div>
            <AccessTierChip tier={article.access_tier} />
          </div>
          <h3 className="mt-2 font-serif text-lg font-medium leading-snug">{article.title}</h3>
          {article.description && (
            <p className="mt-2 line-clamp-3 text-sm text-[hsl(var(--muted-foreground))]">
              {stripHtml(article.description)}
            </p>
          )}
          <MetaLine
            author={article.author}
            date={date}
            minutes={article.reading_time_minutes}
          />
        </div>
      </Link>
    </div>
  );
}

/** Render only the parts that exist, joined by a single "·". Skips
 *  separators on either side of missing fields so no stray dots appear. */
function MetaLine({
  author,
  date,
  minutes,
}: {
  author: string | null;
  date: string | null;
  minutes: number | null;
}) {
  const parts: string[] = [];
  if (author) parts.push(author);
  if (date) parts.push(date);
  if (minutes != null) parts.push(`${minutes} min read`);
  if (parts.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">·</span>}
          {p}
        </span>
      ))}
    </div>
  );
}
