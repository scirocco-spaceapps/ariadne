// Reconnecting WebSocket client for mission-control (contracts/ws-messages.md).
import type { Role } from './config'
import type { WsServerMessage } from './types'

export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'rejected' | 'closed'

export interface SocketOptions {
  url: string
  role: Role
  onMessage: (msg: WsServerMessage) => void
  onStatus?: (status: SocketStatus, detail?: string) => void
  /** Injected in tests. */
  WebSocketImpl?: typeof WebSocket
  minDelayMs?: number
  maxDelayMs?: number
}

/** Close codes after which reconnecting cannot help. */
const FATAL_CODES: Record<number, string> = { 4404: 'unknown session', 4400: 'bad role' }

/**
 * Opens the socket, sends hello, and reconnects with exponential backoff until close() is called.
 * No replay on reconnect: the first state after hello is the truth.
 */
export function connectSession(opts: SocketOptions): { close: () => void } {
  const Impl = opts.WebSocketImpl ?? WebSocket
  const minDelay = opts.minDelayMs ?? 500
  const maxDelay = opts.maxDelayMs ?? 5000
  let delay = minDelay
  let ws: WebSocket | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false

  const open = (first: boolean) => {
    opts.onStatus?.(first ? 'connecting' : 'reconnecting')
    const sock = new Impl(opts.url)
    ws = sock
    sock.onopen = () => {
      delay = minDelay
      sock.send(JSON.stringify({ type: 'hello', role: opts.role }))
      opts.onStatus?.('open')
    }
    sock.onmessage = (ev: MessageEvent) => {
      try {
        opts.onMessage(JSON.parse(String(ev.data)) as WsServerMessage)
      } catch {
        // ignore a malformed frame; the next state is the truth
      }
    }
    sock.onclose = (ev: CloseEvent) => {
      if (ws !== sock || stopped) return
      const fatal = FATAL_CODES[ev.code]
      if (fatal) {
        opts.onStatus?.('rejected', fatal)
        return
      }
      opts.onStatus?.('reconnecting')
      timer = setTimeout(() => open(false), delay)
      delay = Math.min(delay * 2, maxDelay)
    }
  }

  open(true)
  return {
    close: () => {
      stopped = true
      if (timer) clearTimeout(timer)
      ws?.close()
      opts.onStatus?.('closed')
    },
  }
}
