import { ImageResponse } from 'next/og';

// Default OG image used by every page that doesn't declare its own.
// Auto-discovered by Next.js 15 from `app/opengraph-image.tsx`.
//
// Rendered with next/og's bundled default font (system sans). An earlier
// version fetched Bagel Fat One from Google Fonts at build time, but
// Google returned HTML (not TTF) without a browser User-Agent and the
// build crashed with "Unsupported OpenType signature <!DO". Sticking
// with the default keeps the build deterministic; later we can vendor
// the font binary in the repo if we want the wordmark look.

export const alt = 'Zola — long-form reading';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#22577A',
          color: '#FAFAF8',
          padding: '0 96px',
        }}
      >
        <div
          style={{
            fontSize: 240,
            lineHeight: 1,
            fontWeight: 900,
            letterSpacing: '-0.04em',
          }}
        >
          Zola
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 44,
            lineHeight: 1.2,
            opacity: 0.85,
            textAlign: 'center',
            fontStyle: 'italic',
          }}
        >
          Essays worth your evening
        </div>
      </div>
    ),
    size,
  );
}
