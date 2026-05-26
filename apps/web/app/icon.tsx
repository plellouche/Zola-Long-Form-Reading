import { ImageResponse } from 'next/og';

// Auto-discovered favicon. Renders a real PNG via next/og, using the
// vendored Bagel Fat One Latin-subset font so the Z matches the wordmark
// in the nav. The `_fonts/` directory's leading underscore stops Next.js
// from treating it as a route.
//
// PNG output is more reliable in tab bars than SVG: Safari/Chrome
// desaturate inline SVG icons in dark-mode chrome.
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default async function Icon() {
  const fontData = await fetch(
    new URL('./_fonts/BagelFatOne-Latin.woff2', import.meta.url),
  ).then((r) => r.arrayBuffer());

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
