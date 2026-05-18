'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  initialQuery?: string;
  autoFocus?: boolean;
  /** Visual variant. 'page' = large, 'nav' = compact for the header. */
  variant?: 'page' | 'nav';
  placeholder?: string;
};

export function SearchInput({
  initialQuery = '',
  autoFocus,
  variant = 'page',
  placeholder = 'Search articles, people…',
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : '/search');
  }

  if (variant === 'nav') {
    return (
      <form onSubmit={submit} className="hidden md:block">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search"
          aria-label="Search"
          className="w-44 rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm focus:w-56 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--foreground))]"
        />
      </form>
    );
  }

  return (
    <form onSubmit={submit}>
      <input
        type="search"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-[hsl(var(--foreground))]"
      />
    </form>
  );
}
