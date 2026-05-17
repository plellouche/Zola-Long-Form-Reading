export type ContentPolicy = 'REDIRECT_ONLY' | 'EMBED_ALLOWED' | 'FULLTEXT_ALLOWED';

export type SourceKind =
  | 'PUBLICATION'
  | 'BLOG'
  | 'DISCOVERY_SURFACE'
  | 'PAYWALLED_FREE_SUBSET';

export interface Source {
  id: string;
  name: string;
  slug: string;
  homepageUrl: string;
  rssUrl: string | null;
  contentPolicy: ContentPolicy;
  kind: SourceKind;
  trustScore: number;
  isActive: boolean;
  lastIngestedAt: string | null;
  createdAt: string;
}
