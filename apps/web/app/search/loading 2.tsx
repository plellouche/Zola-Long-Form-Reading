import { CardGridSkeleton, LineSkeleton } from '@/components/skeletons';

export default function SearchLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <LineSkeleton width="w-24" height="h-7" />
      <div className="mt-2 mb-4"><LineSkeleton width="w-2/3" height="h-3" /></div>
      <div className="h-10 animate-pulse rounded-md border border-[hsl(var(--border))]" />
      <div className="mt-8">
        <CardGridSkeleton count={6} />
      </div>
    </main>
  );
}
