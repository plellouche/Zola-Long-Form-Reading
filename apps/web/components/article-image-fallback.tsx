// Visual placeholder for articles with no og:image. Many essayists (Paul
// Graham, the Public Domain Review's older pieces, some Aeon archive) don't
// emit OpenGraph tags, so without a fallback their cards land in the feed
// as bare text against a flat background and read like errors. This
// component renders a muted gradient block that's deterministic per article,
// so a card always looks the same on every load.
//
// Palette intentionally avoids loud color: long-form aesthetic, not Pinterest.

const GRADIENTS = [
  'from-[#22577A]/30 to-[#22577A]/10',     // brand teal
  'from-[#40916C]/30 to-[#40916C]/10',     // sea green accent
  'from-amber-900/25 to-amber-700/10',     // warm parchment
  'from-stone-700/30 to-stone-500/10',     // slate
  'from-rose-900/25 to-rose-700/10',       // muted brick
  'from-indigo-900/25 to-indigo-700/10',   // dusk
  'from-emerald-900/25 to-emerald-700/10', // forest
  'from-orange-900/25 to-orange-700/10',   // ember
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function gradientFor(seed: string): string {
  return GRADIENTS[hashString(seed) % GRADIENTS.length];
}

export function ArticleImageFallback({
  seed,
  sourceName,
  className = '',
}: {
  seed: string;
  /** Optional small label rendered in the corner to give the empty space
   *  a tiny bit of identity — usually the source name in caps. */
  sourceName?: string;
  className?: string;
}) {
  const grad = gradientFor(seed);
  return (
    <div
      className={`relative flex h-full w-full items-center justify-center bg-gradient-to-br ${grad} ${className}`}
    >
      {sourceName && (
        <span className="font-display text-[clamp(1.5rem,8vw,3.5rem)] leading-none text-[hsl(var(--foreground))]/15">
          {sourceName.charAt(0)}
        </span>
      )}
    </div>
  );
}
