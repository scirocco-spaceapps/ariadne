// Formatting helpers for the cuff. Pure, so they are tested without rendering.
import type { MissionSession } from '../app/store'

/** Simulated minutes as a mission clock: 31.5 → "T+ 00:31:30". */
export function formatClock(tMin: number): string {
  const total = Math.max(0, Math.round(tMin * 60))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `T+ ${pad(h)}:${pad(m)}:${pad(s)}`
}

/** What the connection pill says for each socket status. */
export const STATUS_LABEL: Record<MissionSession['status'], string> = {
  idle: 'No session',
  connecting: 'Connecting',
  open: 'Connected',
  reconnecting: 'Reconnecting',
  rejected: 'Rejected',
  closed: 'Closed',
}

/** Pill tone: ok while connected, warn while (re)connecting, bad when it cannot recover. */
export function statusTone(status: MissionSession['status']): 'ok' | 'warn' | 'bad' {
  if (status === 'open') return 'ok'
  if (status === 'connecting' || status === 'reconnecting') return 'warn'
  return 'bad'
}
