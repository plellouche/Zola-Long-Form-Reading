import Link from 'next/link';

import { AccessTierChip } from '@/components/access-tier-chip';
import { AddToList } from '@/components/add-to-list';
import { ArticleImageFallback } from '@/components/article-image-fallback';
import { SaveButton } from '@/components/save-button';
import type { ArticleCardData } from '@/components/article-card';
import { stripHtml } from '@/lib/utils';

type Props = {
  article: ArticleCardData;
  showSave?: boolean;
  initiallySaved?: boolean;
};

export function FeaturedArticleCard({
  article,
  showSave = false,
  initiallySaved = false,
}: Props) {
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
        <div className="absolute right-3 top-3 z-10 flex gap-1">
          <AddToList articleId={article.id} variant="icon" />
          <SaveButton articleId={article.id} initiallySaved={initiallySaved} />
        </div>
      )}
      <Link
        href={`/article/${article.id}`}
        className="relative block aspect-[16/9] overflow-hidden rounded-xl border border-[hsl(var(--border))] transition duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-lg hover:border-[hsl(var(--foreground))] sm:aspect-[2/1]"
      >
        {article.og_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.og_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0">
            <ArticleImageFallback
              seed={article.id}
              sourceName={article.source.name}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-6 text-white">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-white/80">
            <span className="inline-block rounded-sm bg-white/10 px-2 py-0.5 backdrop-blur-sm">
              Featured
            </span>
            <span>{article.source.name}</span>
            <AccessTierChip tier={article.access_tier} />
          </div>
          <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
            {article.title}
          </h2>
          {article.description && (
            <p className="line-clamp-2 max-w-2xl text-sm text-white/85">
              {stripHtml(article.description)}
            </p>
          )}
          {(() => {
            const parts: string[] = [];
            if (article.author) parts.push(article.author);
            if (date) parts.push(date);
            if (article.reading_time_minutes != null) {
              parts.push(`${article.reading_time_minutes} min read`);
            }
            if (parts.length === 0) return null;
            return (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/70">
                {parts.map((p, i) => (
                  <span key={i} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden="true">·</span>}
                    {p}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
      </Link>
    </div>
  );
}
