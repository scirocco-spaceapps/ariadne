import { useState } from 'react'
import type { Photo } from '../lib/types'
import { photoUrl } from './format'

export interface PhotoViewerProps {
  photos: Photo[]
  /** Accessible label for the group, e.g. the stop name. */
  label: string
}

/**
 * Rover photos with prev/next. The credit line sits below the image and is always rendered, also
 * while the image is loading or when it fails to load.
 */
export function PhotoViewer({ photos, label }: PhotoViewerProps) {
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState<Record<string, boolean>>({})
  if (photos.length === 0) return <p className="stop-photo-none">No rover photo yet.</p>

  const i = Math.min(index, photos.length - 1)
  const p = photos[i]
  const many = photos.length > 1
  const go = (d: number) => setIndex((i + d + photos.length) % photos.length)

  return (
    <figure className="stop-photo" role="group" aria-label={`${label} photos`}>
      <div className="stop-photo-frame">
        {failed[p.file] ? (
          <div className="stop-photo-missing" role="img" aria-label={p.caption}>
            Image unavailable
          </div>
        ) : (
          <img
            key={p.file}
            src={photoUrl(p.file)}
            alt={p.caption}
            loading="lazy"
            onError={() => setFailed((f) => ({ ...f, [p.file]: true }))}
          />
        )}
      </div>
      {many && (
        <div className="stop-photo-nav">
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo">
            ‹
          </button>
          <span aria-live="polite">
            {i + 1} / {photos.length}
          </span>
          <button type="button" onClick={() => go(1)} aria-label="Next photo">
            ›
          </button>
        </div>
      )}
      <figcaption>
        <span className="stop-photo-credit" data-testid="photo-credit">
          Credit: {p.credit}
        </span>
        <span className="stop-photo-meta">
          Sol {p.sol} · {p.camera}
        </span>
        <span className="stop-photo-caption">{p.caption}</span>
        <a className="stop-photo-link" href={p.page_url} target="_blank" rel="noreferrer">
          Raw image page
        </a>
      </figcaption>
    </figure>
  )
}
