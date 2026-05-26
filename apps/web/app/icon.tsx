import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ImageResponse } from 'next/og';

// Auto-discovered favicon. Renders a real PNG via next/og, using the
// vendored Bagel Fat One Latin-subset font so the Z matches the wordmark.
//
// We read the font via fs.readFile from process.cwd() — Vercel's
// documented pattern for next/og local fonts. The earlier
// `new URL(..., import.meta.url)` pattern got bundled into
// /_next/static/media/* and then failed to fetch() it at static
// prerender time (no base URL in that context).
//
// PNG output beats SVG in browser tab bars: Safari/Chrome desaturate
// inline SVG icons in dark-mode chrome.
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default async function Icon() {
  const fontData = await readFile(
    join(process.cwd(), 'app', '_fonts', 'BagelFatOne-Latin.woff2'),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#22577A',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FAFAF8',
          fontFamily: 'Bagel',
          fontSize: 64,
          lineHeight: 1,
          paddingTop: 4,
        }}
      >
        Z
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Bagel', data: fontData, style: 'normal', weight: 400 }],
    },
  );
}
