import type { ArticleAccessTier } from '@/lib/api-types';

type Size = 'sm' | 'md';

const COPY: Record<Exclude<ArticleAccessTier, 'free' | 'unknown'>, {
  label: string;
  tooltip: string;
  classes: string;
}> = {
  metered: {
    label: 'Free quota',
    tooltip:
      'The publisher gives a small number of free reads per month, then asks you to subscribe.',
    classes:
      'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  locked: {
    label: 'Paywall',
    tooltip: 'Requires a subscription to read.',
    classes:
      'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border-[hsl(var(--border))]',
  },
};

export function AccessTierChip({
  tier,
  size = 'sm',
}: {
  tier: ArticleAccessTier;
  size?: Size;
}) {
  if (tier === 'free' || tier === 'unknown') return null;
  const meta = COPY[tier];
  const pad = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs';

  return (
    <span
      title={meta.tooltip}
      className={`inline-flex items-center rounded border font-medium uppercase tracking-wider ${pad} ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}
