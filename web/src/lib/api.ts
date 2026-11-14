// Typed REST clients for planner and mission-control (contracts/openapi.yaml).
import { mcUrl, plannerUrl } from './config'
import type {
  AbortRequest,
  AbortResponse,
  Ack,
  Conditions,
  Health,
  RouteRequest,
  RouteResponse,
  SessionControl,
  SessionCreate,
  SessionCreated,
  SessionEvent,
  SessionScript,
} from './types'

/** A non-2xx answer. `detail` is the contract's Error.detail as text. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(`HTTP ${status}: ${detail}`)
    this.status = status
    this.detail = detail
  }
}

async function request<T>(base: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const err = (await res.json()) as { detail?: unknown }
      detail = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail)
    } catch {
      // not JSON: keep the status text
    }
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as T
}

export const planner = {
  health: (signal?: AbortSignal) => request<Health>(plannerUrl, '/health', undefined, signal),
  route: (body: RouteRequest, signal?: AbortSignal) => request<RouteResponse>(plannerUrl, '/route', body, signal),
  abort: (body: AbortRequest, signal?: AbortSignal) => request<AbortResponse>(plannerUrl, '/abort', body, signal),
}

const sessionPath = (id: string, what: string) => `/sessions/${encodeURIComponent(id)}/${what}`

export const missionControl = {
  health: (signal?: AbortSignal) => request<Health>(mcUrl, '/health', undefined, signal),
  conditions: (signal?: AbortSignal) => request<Conditions>(mcUrl, '/conditions', undefined, signal),
  createSession: (body: SessionCreate) => request<SessionCreated>(mcUrl, '/sessions', body),
  control: (id: string, body: SessionControl) => request<Ack>(mcUrl, sessionPath(id, 'control'), body),
  event: (id: string, body: SessionEvent) => request<Ack>(mcUrl, sessionPath(id, 'events'), body),
  script: (id: string, body: SessionScript) => request<Ack>(mcUrl, sessionPath(id, 'script'), body),
}
