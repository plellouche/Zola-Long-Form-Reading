import Image from 'next/image';

const FALLBACK_COLORS = [
  'bg-rose-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-sky-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-fuchsia-500',
] as const;

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function fallbackColor(seed: string): string {
  return FALLBACK_COLORS[hashString(seed) % FALLBACK_COLORS.length];
}

const SIZE_PX: Record<NonNullable<AvatarProps['size']>, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 64,
  xl: 96,
};

const SIZE_TEXT: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-xl',
  xl: 'text-3xl',
};

export type AvatarProps = {
  src?: string | null;
  name?: string | null;
  seed: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

export function Avatar({ src, name, seed, size = 'md', className }: AvatarProps) {
  const px = SIZE_PX[size];
  const text = SIZE_TEXT[size];
  const initial = (name ?? seed).trim().charAt(0).toUpperCase() || '?';

  if (src) {
    return (
      <Image
        src={src}
        alt={name ?? ''}
        width={px}
        height={px}
        className={`rounded-full object-cover ${className ?? ''}`}
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`inline-flex items-center justify-center rounded-full font-medium text-white ${fallbackColor(
        seed,
      )} ${text} ${className ?? ''}`}
      style={{ width: px, height: px }}
    >
      {initial}
    </span>
  );
}
