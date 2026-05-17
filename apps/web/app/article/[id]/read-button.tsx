'use client';

import { useState } from 'react';

import { getBrowserApiClient } from '@/lib/api';

export function ReadArticleButton({ articleId, url }: { articleId: string; url: string }) {
  const [pending, setPending] = useState(false);

  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Don't block the navigation — fire-and-forget the event.
    setPending(true);
    try {
      await getBrowserApiClient().request('/api/events', {
        method: 'POST',
        body: { event_type: 'LINK_CLICK', article_id: articleId },
      });
    } catch {
      // Tracking failure must not break the read flow.
    }
    setPending(false);
    // Let the default <a target="_blank"> behavior open the URL.
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--foreground))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--background))]"
    >
      {pending ? 'Opening…' : 'Read article'}
      <span aria-hidden>→</span>
    </a>
  );
}
