import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

// Default OG image. Same font-loading pattern as icon.tsx — see notes there.
export const alt = 'Zola — long-form reading';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG() {
  const fontData = await readFile(
    join(process.cwd(), 'app', '_fonts', 'BagelFatOne-Latin.woff2'),
  );

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
