import { useEffect } from 'react'
import { isLocalHost } from './pairing'
import { QrCode } from './QrCode'

interface PairCuffProps {
  url: string
  demo: boolean
  onClose: () => void
  /** Injected in tests; defaults to this page's hostname. */
  hostname?: string
}

/** Overlay with the QR code a phone scans to open /cuff for the current session. */
export function PairCuff({ url, demo, onClose, hostname = location.hostname }: PairCuffProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="pair-backdrop" onClick={onClose}>
      <div
        className="pair-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pair-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pair-title">Pair cuff</h2>
        <p className="pair-hint">Scan with the phone that will be the astronaut&rsquo;s cuff.</p>
        <QrCode value={url} size={260} />
        <a className="pair-url" href={url} target="_blank" rel="noreferrer" data-testid="pair-url">
          {url}
        </a>
        {demo && (
          <p className="pair-note">DEMO: the phone replays the same SYNTHETIC fixture, locked to the clock.</p>
        )}
        {isLocalHost(hostname) && (
          <p className="pair-warn" role="alert">
            A phone cannot open {hostname}. Run <code>npm run dev:lan</code> and open the console on this
            computer&rsquo;s network address.
          </p>
        )}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
