import { LineSkeleton } from '@/components/skeletons';

export default function ListLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <LineSkeleton width="w-12" height="h-3" />
      <div className="mt-3"><LineSkeleton width="w-2/3" height="h-9" /></div>
      <div className="mt-2"><LineSkeleton width="w-1/2" height="h-3" /></div>
      <ol className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex items-stretch gap-3 rounded-lg border border-[hsl(var(--border))] p-3"
          >
            <div className="hidden h-20 w-32 animate-pulse rounded-md bg-[hsl(var(--muted))] sm:block" />
            <div className="min-w-0 flex-1 space-y-2">
              <LineSkeleton width="w-20" height="h-3" />
              <LineSkeleton width="w-5/6" height="h-4" />
              <LineSkeleton width="w-1/3" height="h-3" />
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
