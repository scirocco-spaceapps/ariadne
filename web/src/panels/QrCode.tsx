import { useMemo } from 'react'
import { encode } from 'uqr'

interface QrCodeProps {
  value: string
  /** Rendered width and height in CSS pixels. */
  size?: number
  title?: string
}

/** A QR code as an inline SVG: dark modules on white with a 4-module quiet zone, so it scans on any UI. */
export function QrCode({ value, size = 240, title }: QrCodeProps) {
  const { n, path } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 4 })
    // One path of 1x1 squares keeps the DOM small (a few hundred modules for a URL).
    let d = ''
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`
      }),
    )
    return { n: qr.size, path: d }
  }, [value])

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? `QR code for ${value}`}
      data-testid="qr-code"
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}
