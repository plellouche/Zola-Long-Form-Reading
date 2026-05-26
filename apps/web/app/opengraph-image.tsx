import { ImageResponse } from 'next/og';

// Default OG image used by every page that doesn't declare its own.
// Auto-discovered by Next.js 15 from `app/opengraph-image.tsx`.
//
// Rendered to a real PNG at request time (cached by edge). Uses
// Bagel Fat One for the wordmark to match the nav's display font.

export const alt = 'Zola — long-form reading';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

async function bagelFatOne(): Promise<ArrayBuffer> {
  // Google Fonts static TTF URL for Bagel Fat One.
  const res = await fetch(
    'https://fonts.gstatic.com/s/bagelfatone/v6/hYkPPucsQOr5dy02WmQr5Zkd0BFy.ttf',
  );
  return await res.arrayBuffer();
}

async function spectral(): Promise<ArrayBuffer> {
  // Spectral medium-weight; used for the tagline.
  const res = await fetch(
    'https://fonts.gstatic.com/s/spectral/v17/rnCs-xNNww_2s0amA9mAtMAg5OlGZSJ7.ttf',
  );
  return await res.arrayBuffer();
}

export default async function OG() {
  const [bagelData, spectralData] = await Promise.all([bagelFatOne(), spectral()]);

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
            fontFamily: 'Spectral',
            fontSize: 48,
            lineHeight: 1.2,
            opacity: 0.85,
            textAlign: 'center',
          }}
        >
          Essays worth your evening
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Bagel', data: bagelData, style: 'normal', weight: 400 },
        { name: 'Spectral', data: spectralData, style: 'normal', weight: 500 },
      ],
    },
  );
}
