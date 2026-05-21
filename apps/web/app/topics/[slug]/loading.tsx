import { CardGridSkeleton, LineSkeleton } from '@/components/skeletons';

export default function TopicLoading() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <LineSkeleton width="w-16" height="h-3" />
      <div className="mt-3 mb-6">
        <LineSkeleton width="w-48" height="h-8" />
        <div className="mt-2"><LineSkeleton width="w-2/3" height="h-3" /></div>
      </div>
      <CardGridSkeleton count={12} />
    </main>
  );
}
