import { ImageResponse } from 'next/og';

// Auto-discovered favicon. Renders a real PNG via next/og's bundled
// default sans (no external font fetch — that path crashed the build
// when Google Fonts returned HTML). The default sans is heavy enough at
// this size to approximate the Bagel Fat One feel without dependencies.
//
// PNG output is more reliable in tab bars than SVG: Safari/Chrome
// desaturate inline SVG icons in dark-mode chrome (they grayscale the
// brand color). PNGs keep their pixel colors as-is.
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
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
          fontSize: 56,
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        Z
      </div>
    ),
    size,
  );
}
