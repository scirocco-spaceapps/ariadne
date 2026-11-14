// The mission store: everything the console and the cuff share. `session.state` is the last
// WsState from mission-control (or the DEMO replay), exactly as in contracts/ws-messages.md.
import { create } from 'zustand'
import type { SocketStatus } from '../lib/socket'
import type { Aoi, Conditions, RouteResponse, WsEvent, WsServerMessage, WsState } from '../lib/types'

export interface Budget {
  budget_min: number
  reserve_min: number
}

export interface MissionSession {
  id: string | null
  state: WsState | null
  status: SocketStatus | 'idle'
  /** Reason when status is 'rejected'. */
  statusDetail?: string
  /** Last event frame (storm_alert, clear, arrived). */
  lastEvent: WsEvent | null
}

export interface MissionStore {
  /** True when showing SYNTHETIC fixtures instead of live services. */
  demo: boolean
  aoi: Aoi | null
  route: RouteResponse | null
  session: MissionSession
  budget: Budget | null
  selectedStop: string | null
  selectedTarget: string | null
  conditions: Conditions | null

  setDemo: (demo: boolean) => void
  setAoi: (aoi: Aoi) => void
  setRoute: (route: RouteResponse | null) => void
  setBudget: (budget: Budget) => void
  setConditions: (conditions: Conditions | null) => void
  setSessionId: (id: string | null) => void
  setSessionStatus: (status: MissionSession['status'], detail?: string) => void
  /** Apply one server frame: a state replaces session.state, an event is kept as lastEvent. */
  receive: (msg: WsServerMessage) => void
  selectStop: (id: string | null) => void
  selectTarget: (id: string | null) => void
  reset: () => void
}

const emptySession: MissionSession = { id: null, state: null, status: 'idle', lastEvent: null }

const initial = {
  demo: false,
  aoi: null,
  route: null,
  session: emptySession,
  budget: null,
  selectedStop: null,
  selectedTarget: null,
  conditions: null,
}

export const useMission = create<MissionStore>()((set) => ({
  ...initial,
  setDemo: (demo) => set({ demo }),
  setAoi: (aoi) => set({ aoi }),
  setRoute: (route) => set({ route }),
  setBudget: (budget) => set({ budget }),
  setConditions: (conditions) => set({ conditions }),
  setSessionId: (id) => set((s) => (s.session.id === id ? s : { session: { ...emptySession, id } })),
  setSessionStatus: (status, statusDetail) => set((s) => ({ session: { ...s.session, status, statusDetail } })),
  receive: (msg) =>
    set((s) =>
      msg.type === 'state'
        ? { session: { ...s.session, state: msg } }
        : { session: { ...s.session, lastEvent: msg } },
    ),
  selectStop: (selectedStop) => set({ selectedStop }),
  selectTarget: (selectedTarget) => set({ selectedTarget }),
  reset: () => set(initial),
}))
