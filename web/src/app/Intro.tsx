import { useEffect, useState } from 'react'
import './intro.css'

const KEY = 'ariadne.intro.seen'
const FADE_AT_MS = 2700
const SHOW_MS = 3400
/** Play even if the page never fires load (a stuck image), so the console is never hidden for long. */
const MAX_WAIT_MS = 5000

function seenBefore(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * First-load title card on the console: the thread is drawn across the screen and loops home, then
 * the one-line idea, then it fades into the console. Once per browser tab; click or any key skips.
 * It never blocks: pointer events pass through, so the console is usable from the first frame.
 */
export function Intro() {
  const [show, setShow] = useState(() => !seenBefore())
  // wait: a plain backdrop hides the half-loaded console; play: the thread draws; out: fade away.
  const [phase, setPhase] = useState<'wait' | 'play' | 'out'>('wait')

  useEffect(() => {
    if (!show) return
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      // private mode: show it once per load
    }
    const timers: number[] = []
    let raf = 0
    let idle = 0
    const done = () => setShow(false)
    const play = () => {
      if (raf) return
      // After load, once the main thread is idle (the map has initialised), so the drawing is smooth.
      const start = () => {
        setPhase('play')
        timers.push(window.setTimeout(() => setPhase('out'), FADE_AT_MS))
        timers.push(window.setTimeout(done, SHOW_MS))
      }
      raf = 1
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(start, { timeout: 2500 })
      else timers.push(globalThis.setTimeout(start, 600) as unknown as number)
    }
    if (document.readyState === 'complete') play()
    else window.addEventListener('load', play, { once: true })
    timers.push(window.setTimeout(play, MAX_WAIT_MS))
    window.addEventListener('keydown', done, { once: true })
    window.addEventListener('pointerdown', done, { once: true })
    return () => {
      timers.forEach(clearTimeout)
      if (idle) window.cancelIdleCallback(idle)
      window.removeEventListener('load', play)
      window.removeEventListener('keydown', done)
      window.removeEventListener('pointerdown', done)
    }
  }, [show])

  if (!show) return null
  return (
    <div className={phase === 'out' ? 'intro intro--out' : 'intro'} aria-hidden="true">
      {phase !== 'wait' && (
        <>
          <svg className="intro-thread" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid meet">
            <path
              className="intro-path"
              d="M40 230 C 200 40, 320 280, 470 150 S 700 40, 800 170 S 1010 260, 1080 140 S 1140 80, 1120 130"
            />
            <circle className="intro-home" cx="1120" cy="140" r="16" />
          </svg>
          <div className="intro-text">
            <p className="intro-name">Ariadne</p>
            <p className="intro-line">Every step on Mars knows the way home.</p>
            <p className="intro-place">Bright Angel · Jezero crater · a walking-scale EVA map</p>
          </div>
        </>
      )}
    </div>
  )
}
