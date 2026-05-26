'use client';

import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion';
import { Bookmark, ChevronDown, Heart, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { AccessTierChip } from '@/components/access-tier-chip';
import { ArticleImageFallback } from '@/components/article-image-fallback';
import { getBrowserApiClient } from '@/lib/api';
import type { ArticleSummary } from '@/lib/api-types';
import { stripHtml } from '@/lib/utils';

type Direction = 'left' | 'right' | 'up' | 'down';

const SWIPE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 600;

type Props = {
  initialDeck: ArticleSummary[];
};

export function DiscoverDeck({ initialDeck }: Props) {
  const [deck, setDeck] = useState<ArticleSummary[]>(initialDeck);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ right: 0, left: 0, up: 0, down: 0 });

  const current = deck[index];
  const upcoming = deck.slice(index + 1, index + 3);
  const finished = !current;

  const recordSwipe = useCallback(
    async (article: ArticleSummary, direction: Direction) => {
      setBusy(true);
      setError(null);
      try {
        await getBrowserApiClient().request('/api/discover/swipe', {
          method: 'POST',
          body: { article_id: article.id, direction },
        });
        setCounts((c) => ({ ...c, [direction]: c[direction] + 1 }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not record swipe.');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const swipe = useCallback(
    (direction: Direction) => {
      if (!current || busy) return;
      const snapshot = current;
      setIndex((i) => i + 1);
      void recordSwipe(snapshot, direction);
    },
    [busy, current, recordSwipe],
  );

  // Keyboard shortcuts. Disabled while typing in inputs.
  useEffect(() => {
    function isEditable(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        target.isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      if (isEditable(e.target)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        swipe('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        swipe('right');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        swipe('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        swipe('down');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [swipe]);

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const more = await getBrowserApiClient().request<ArticleSummary[]>(
        '/api/discover/deck',
        { query: { limit: '25' } },
      );
      if (more.length === 0) {
        setError('No fresh articles right now — check back tomorrow.');
      } else {
        setDeck((d) => [...d, ...more]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more.');
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex w-full max-w-md items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
        <span>
          {Math.min(index + 1, deck.length)} / {deck.length}
        </span>
        <span className="flex gap-3">
          <span title="Interested">♥ {counts.right}</span>
          <span title="Saved">✦ {counts.up}</span>
          <span title="Dismissed">✕ {counts.left}</span>
        </span>
      </div>

      <div className="relative h-[560px] w-full max-w-md">
        {finished ? (
          <FinishedState onLoadMore={loadMore} loading={loadingMore} error={error} />
        ) : (
          <>
            {/* Stacked cards behind the top one */}
            {upcoming.map((article, i) => (
              <BackCard key={article.id} depth={i + 1} article={article} />
            ))}

            <AnimatePresence initial={false} mode="popLayout">
              <SwipeCard
                key={current.id}
                article={current}
                onSwipe={swipe}
                disabled={busy}
              />
            </AnimatePresence>
          </>
        )}
      </div>

      {!finished && (
        <div className="mt-6 flex items-center gap-3">
          <ActionButton
            label="Dismiss"
            icon={<X className="h-5 w-5" />}
            onClick={() => swipe('left')}
            disabled={busy}
            colorClass="text-red-500 border-red-500/50 hover:bg-red-500/10"
          />
          <ActionButton
            label="Less from this source"
            icon={<ChevronDown className="h-5 w-5" />}
            onClick={() => swipe('down')}
            disabled={busy}
            colorClass="text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
          />
          <ActionButton
            label="Interested"
            icon={<Heart className="h-5 w-5" />}
            onClick={() => swipe('right')}
            disabled={busy}
            colorClass="text-pink-500 border-pink-500/50 hover:bg-pink-500/10"
            big
          />
          <ActionButton
            label="Save"
            icon={<Bookmark className="h-5 w-5" />}
            onClick={() => swipe('up')}
            disabled={busy}
            colorClass="text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
          />
        </div>
      )}

      {error && !finished && (
        <p className="mt-3 text-xs text-red-600">{error}</p>
      )}

      <p className="mt-6 max-w-md text-center text-xs text-[hsl(var(--muted-foreground))]">
        Swipe right to mark as interested, left to dismiss, up to save, down to see
        fewer articles from this source. Use the arrow keys too.
      </p>
    </div>
  );
}

function FinishedState({
  onLoadMore,
  loading,
  error,
}: {
  onLoadMore: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-[hsl(var(--border))] p-8 text-center">
      <h2 className="text-xl font-semibold">You&apos;re caught up.</h2>
      <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
        Your swipes are reshaping your For-You feed.
      </p>
      <div className="mt-6 flex gap-2">
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))] disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
        <Link
          href="/"
          className="rounded-md border border-[hsl(var(--border))] px-4 py-2 text-sm hover:bg-[hsl(var(--muted))]"
        >
          Back to home
        </Link>
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function BackCard({ depth, article }: { depth: number; article: ArticleSummary }) {
  const scale = 1 - depth * 0.04;
  const offset = depth * 10;
  const opacity = 1 - depth * 0.25;
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]"
      style={{
        transform: `translateY(${offset}px) scale(${scale})`,
        opacity,
        zIndex: 0,
      }}
      aria-hidden
    >
      <CardContent article={article} />
    </div>
  );
}

function SwipeCard({
  article,
  onSwipe,
  disabled,
}: {
  article: ArticleSummary;
  onSwipe: (d: Direction) => void;
  disabled: boolean;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-18, 18]);
  const likeOpacity = useTransform(x, [40, 140], [0, 1]);
  const nopeOpacity = useTransform(x, [-140, -40], [1, 0]);
  const saveOpacity = useTransform(y, [-140, -40], [1, 0]);

  return (
    <motion.div
      className="absolute inset-0 z-10 cursor-grab overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-lg active:cursor-grabbing"
      style={{ x, y, rotate }}
      drag={!disabled}
      dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        const { offset, velocity } = info;
        const fastX = Math.abs(velocity.x) > VELOCITY_THRESHOLD;
        const fastY = Math.abs(velocity.y) > VELOCITY_THRESHOLD;
        if (offset.x > SWIPE_THRESHOLD || (fastX && velocity.x > 0)) {
          onSwipe('right');
        } else if (offset.x < -SWIPE_THRESHOLD || (fastX && velocity.x < 0)) {
          onSwipe('left');
        } else if (offset.y < -SWIPE_THRESHOLD || (fastY && velocity.y < 0)) {
          onSwipe('up');
        } else if (offset.y > SWIPE_THRESHOLD || (fastY && velocity.y > 0)) {
          onSwipe('down');
        }
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
    >
      <CardContent article={article} />
      <motion.div
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-6 top-6 rotate-[-18deg] rounded-md border-4 border-pink-500 px-3 py-1 text-xl font-bold uppercase tracking-wider text-pink-500"
      >
        Interested
      </motion.div>
      <motion.div
        style={{ opacity: nopeOpacity }}
        className="pointer-events-none absolute right-6 top-6 rotate-[18deg] rounded-md border-4 border-red-500 px-3 py-1 text-xl font-bold uppercase tracking-wider text-red-500"
      >
        Dismiss
      </motion.div>
      <motion.div
        style={{ opacity: saveOpacity }}
        className="pointer-events-none absolute inset-x-0 top-6 mx-auto w-fit rounded-md border-4 border-amber-500 px-3 py-1 text-xl font-bold uppercase tracking-wider text-amber-500"
      >
        Save
      </motion.div>
    </motion.div>
  );
}

function CardContent({ article }: { article: ArticleSummary }) {
  const date = article.publication_date
    ? new Date(article.publication_date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;
  return (
    <div className="flex h-full flex-col">
      {article.og_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.og_image_url}
          alt=""
          className="h-56 w-full object-cover"
        />
      ) : (
        <div className="h-56 w-full">
          <ArticleImageFallback
            seed={article.id}
            sourceName={article.source.name}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
          <span>{article.source.name}</span>
          <AccessTierChip tier={article.access_tier} />
          {date && <span>· {date}</span>}
          {article.reading_time_minutes && (
            <span>· {article.reading_time_minutes} min</span>
          )}
        </div>
        <h2 className="font-serif text-3xl font-medium leading-tight tracking-tight">
          {article.title}
        </h2>
        {article.author && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            By {article.author}
          </p>
        )}
        {article.description && (
          <p className="line-clamp-5 text-sm text-[hsl(var(--muted-foreground))]">
            {stripHtml(article.description)}
          </p>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
  disabled,
  colorClass,
  big,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  colorClass: string;
  big?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center rounded-full border-2 transition disabled:opacity-50 ${colorClass} ${
        big ? 'h-14 w-14' : 'h-12 w-12'
      }`}
    >
      {icon}
    </button>
  );
}
