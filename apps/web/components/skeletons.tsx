/** Small kit of skeleton placeholders used by loading.tsx files. */

export function CardSkeleton() {
  return (
    <div className="mb-4 break-inside-avoid rounded-lg border border-[hsl(var(--border))] p-4">
      <div className="aspect-[16/9] -mx-4 -mt-4 mb-3 animate-pulse bg-[hsl(var(--muted))]" />
      <div className="h-3 w-20 animate-pulse rounded bg-[hsl(var(--muted))]" />
      <div className="mt-3 h-4 animate-pulse rounded bg-[hsl(var(--muted))]" />
      <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-[hsl(var(--muted))]" />
      <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-[hsl(var(--muted))]" />
    </div>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function LineSkeleton({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`animate-pulse rounded bg-[hsl(var(--muted))] ${height} ${width}`} />;
}
