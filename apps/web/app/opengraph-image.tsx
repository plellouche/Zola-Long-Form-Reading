import { ImageResponse } from 'next/og';

// Default OG image used by every page that doesn't declare its own.
// Auto-discovered by Next.js 15 from `app/opengraph-image.tsx`.
//
// Uses the vendored Bagel Fat One font (apps/web/app/_fonts) so the
// wordmark matches the in-app nav. We tried fetching from Google Fonts
// at build time but the response was HTML without a browser UA — vendor
// it instead.

export const alt = 'Zola — long-form reading';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG() {
  const fontData = await fetch(
    new URL('./_fonts/BagelFatOne-Latin.woff2', import.meta.url),
  ).then((r) => r.arrayBuffer());

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
            fontFamily: 'Bagel',
            fontSize: 280,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          Zola
        </div>
        <div
          style={{
            marginTop: 24,
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
    {
      ...size,
      fonts: [{ name: 'Bagel', data: fontData, style: 'normal', weight: 400 }],
    },
  );
}
