import { CardGridSkeleton, LineSkeleton } from '@/components/skeletons';

export default function BrowseLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <LineSkeleton width="w-32" height="h-7" />
        <div className="mt-2"><LineSkeleton width="w-48" height="h-3" /></div>
      </div>
      <div className="mb-6 h-24 animate-pulse rounded-lg border border-[hsl(var(--border))]" />
      <CardGridSkeleton count={12} />
    </main>
  );
}
