import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'LA Mattress Store — five Los Angeles showrooms';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#1B2C5E',
          color: '#FFFFFF',
          padding: 80,
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 6, height: 36, background: '#D8232A', borderRadius: 3 }} />
          <div
            style={{
              fontSize: 22,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#FFFFFF',
              opacity: 0.85,
            }}
          >
            LA Mattress Store
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontSize: 96,
              lineHeight: 1.05,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              maxWidth: 960,
            }}
          >
            Sleep, engineered in Los Angeles.
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.3,
              opacity: 0.85,
              maxWidth: 880,
            }}
          >
            Five LA showrooms. Premium mattress brands. Same-day white-glove delivery.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 28,
            borderTop: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          <div style={{ display: 'flex', gap: 36, fontSize: 18, opacity: 0.85 }}>
            <span>Tempur-Pedic</span>
            <span>Stearns &amp; Foster</span>
            <span>Helix</span>
            <span>Diamond</span>
          </div>
          <div style={{ fontSize: 18, color: '#FFFFFF', opacity: 0.85 }}>
            mattressstoreslosangeles.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
