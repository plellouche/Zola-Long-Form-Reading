import { LineSkeleton } from '@/components/skeletons';

export default function ArticleLoading() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <LineSkeleton width="w-16" height="h-3" />
      <div className="mt-6"><LineSkeleton width="w-24" height="h-3" /></div>
      <div className="mt-2"><LineSkeleton width="w-3/4" height="h-10" /></div>
      <div className="mt-3 flex gap-2">
        <LineSkeleton width="w-24" height="h-3" />
        <LineSkeleton width="w-20" height="h-3" />
      </div>
      <div className="mt-6 aspect-[16/9] animate-pulse rounded-lg bg-[hsl(var(--muted))]" />
      <div className="mt-6 space-y-2">
        <LineSkeleton height="h-4" />
        <LineSkeleton width="w-5/6" height="h-4" />
        <LineSkeleton width="w-4/6" height="h-4" />
      </div>
    </main>
  );
}
