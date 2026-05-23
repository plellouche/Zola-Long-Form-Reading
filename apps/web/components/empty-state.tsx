import Link from 'next/link';
import type { ReactNode } from 'react';

type CTA = {
  label: string;
  href: string;
};

type Props = {
  title: string;
  body?: string;
  icon?: ReactNode;
  cta?: CTA;
  children?: ReactNode;
};

export function EmptyState({ title, body, icon, cta, children }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[hsl(var(--border))] p-12 text-center">
      {icon && (
        <div className="mb-3 text-[hsl(var(--muted-foreground))]">{icon}</div>
      )}
      <h3 className="text-base font-medium">{title}</h3>
      {body && (
        <p className="mt-1 max-w-sm text-sm text-[hsl(var(--muted-foreground))]">
          {body}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="mt-4 rounded-md bg-[hsl(var(--primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--primary-foreground))]"
        >
          {cta.label}
        </Link>
      )}
      {children}
    </div>
  );
}
