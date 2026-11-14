import type { Page, TestInfo } from '@playwright/test'

export type Mode = 'demo' | 'live'

export function mode(): Mode {
  const m = (process.env.E2E_MODE || 'demo').toLowerCase()
  if (m !== 'demo' && m !== 'live') throw new Error(`E2E_MODE must be "demo" or "live", not "${m}"`)
  return m
}

/** Minutes from an EVA clock: console "T+ 0:12" (h:mm) or cuff "T+ 00:12:30" (hh:mm:ss). */
export function parseClock(text: string | null): number {
  const m = /T\+\s*(\d+):(\d{2})(?::(\d{2}))?/.exec(text ?? '')
  if (!m) throw new Error(`not an EVA clock: ${JSON.stringify(text)}`)
  return Number(m[1]) * 60 + Number(m[2]) + (m[3] ? Number(m[3]) / 60 : 0)
}

/** [x, y] in metres from the cuff's position line "x 380 m · y 300 m". */
export function parsePos(text: string | null): [number, number] {
  const m = /x\s+(-?\d+(?:\.\d+)?)\s*m\s*·\s*y\s+(-?\d+(?:\.\d+)?)\s*m/.exec(text ?? '')
  if (!m) throw new Error(`not a cuff position: ${JSON.stringify(text)}`)
  return [Number(m[1]), Number(m[2])]
}

export interface StateView {
  t_min: number
  pos: [number, number]
  running: boolean
  alert: boolean
}

/**
 * What the console last received, for checks the screen cannot give (the console shows the
 * astronaut only on the WebGL map). DEMO: the console's own store, read through the Vite dev
 * server's module graph (same module instance as the app; read-only). Live: the last `state` frame
 * on the console's WebSocket.
 */
export interface StateReader {
  read(): Promise<StateView | null>
}

export function storeReader(page: Page): StateReader {
  return {
    async read() {
      // A string expression, so the test transpiler leaves the dynamic import alone.
      return page.evaluate(`(async () => {
        const { useMission } = await import('/src/app/store.ts')
        const s = useMission.getState().session.state
        return s ? { t_min: s.t_min, pos: [s.pos[0], s.pos[1]], running: s.running, alert: !!s.alert } : null
      })()`) as Promise<StateView | null>
    },
  }
}

export function socketReader(page: Page): StateReader {
  let last: StateView | null = null
  page.on('websocket', (ws) => {
    ws.on('framereceived', ({ payload }) => {
      if (typeof payload !== 'string') return
      try {
        const m = JSON.parse(payload)
        if (m.type === 'state') last = { t_min: m.t_min, pos: [m.pos[0], m.pos[1]], running: m.running, alert: !!m.alert }
      } catch {
        // not JSON: ignore
      }
    })
  })
  return { read: async () => last }
}

/** The red thread colour (visual brief --thread #ff5d6c, web/src/map/buildLayers.ts THREAD_RGB). */
const THREAD: [number, number, number] = [255, 93, 108]

/**
 * Number of thread-coloured pixels in a PNG. Decoded inside the browser (createImageBitmap), so
 * the test needs no image library.
 */
export async function threadPixels(page: Page, png: Buffer): Promise<number> {
  return page.evaluate(
    async ({ b64, rgb }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = new OffscreenCanvas(bmp.width, bmp.height)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(bmp, 0, 0)
      const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data
      let n = 0
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - rgb[0]) <= 30 && Math.abs(d[i + 1] - rgb[1]) <= 35 && Math.abs(d[i + 2] - rgb[2]) <= 35) n++
      }
      return n
    },
    { b64: png.toString('base64'), rgb: THREAD },
  )
}

/** Full-page screenshot of console and cuff, saved under the test's output folder and attached. */
export async function snap(testInfo: TestInfo, name: string, pages: Record<string, Page>): Promise<void> {
  for (const [who, page] of Object.entries(pages)) {
    const path = testInfo.outputPath(`${name}-${who}.png`)
    await page.screenshot({ path })
    await testInfo.attach(`${name}-${who}`, { path, contentType: 'image/png' })
  }
}
