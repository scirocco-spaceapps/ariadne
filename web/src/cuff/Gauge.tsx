// Drawn in code (SVG): the margin ring and the bearing arrow on the cuff. No images.

/** A ring that empties as the margin to home shrinks. `frac` 0..1; colour comes from the caller. */
export function MarginRing({ frac, colour, children }: { frac: number | null; colour: string; children: React.ReactNode }) {
  const R = 92
  const C = 2 * Math.PI * R
  const f = frac === null ? 0 : Math.min(1, Math.max(0, frac))
  // 300° arc with the gap at the bottom, like a wrist instrument.
  const ARC = 300 / 360
  const track = C * ARC
  return (
    <div className="cf-ring" style={{ ['--ring' as string]: colour }}>
      <svg viewBox="0 0 220 220" aria-hidden="true" className="cf-ring-svg">
        <defs>
          <filter id="cf-ring-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        {/* Tick marks every 10 % of the arc. */}
        <g className="cf-ring-ticks" transform="rotate(120 110 110)">
          {Array.from({ length: 11 }, (_, i) => (
            <line key={i} x1="110" y1="6" x2="110" y2={i % 5 === 0 ? 16 : 11} transform={`rotate(${i * 30} 110 110)`} />
          ))}
        </g>
        <circle
          className="cf-ring-track"
          cx="110"
          cy="110"
          r={R}
          strokeDasharray={`${track} ${C}`}
          transform="rotate(120 110 110)"
        />
        <circle
          className="cf-ring-glow"
          cx="110"
          cy="110"
          r={R}
          strokeDasharray={`${track * f} ${C}`}
          transform="rotate(120 110 110)"
          filter="url(#cf-ring-glow)"
        />
        <circle
          className="cf-ring-fill"
          cx="110"
          cy="110"
          r={R}
          strokeDasharray={`${track * f} ${C}`}
          transform="rotate(120 110 110)"
        />
      </svg>
      <div className="cf-ring-body">{children}</div>
    </div>
  )
}

/** An arrow that points along the bearing, north-up like the console map. */
export function BearingArrow({ deg, size = 56 }: { deg: number; size?: number }) {
  return (
    <svg className="cf-bearing" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <circle cx="32" cy="32" r="30" className="cf-bearing-dial" />
      <text x="32" y="11" textAnchor="middle" className="cf-bearing-n">
        N
      </text>
      <g style={{ transform: `rotate(${deg}deg)`, transformOrigin: '32px 32px' }} className="cf-bearing-needle">
        <path d="M32 14 L41 40 L32 34 L23 40 Z" />
      </g>
    </svg>
  )
}
