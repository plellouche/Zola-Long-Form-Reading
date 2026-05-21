import Link from 'next/link';

import { AddToList } from '@/components/add-to-list';
import { SaveButton } from '@/components/save-button';
import type { ArticleSummary } from '@/lib/api-types';

export type ArticleCardData = Pick<
  ArticleSummary,
  'id' | 'title' | 'author' | 'publication_date' | 'description' | 'og_image_url' | 'reading_time_minutes' | 'source'
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
    </div>
  );
}
