// demo90: the demo scenario end to end on two screens, the mission console and the astronaut's
// cuff. Console and cuff stay in step, a storm alert reaches both, the console draws the red
// thread home, and both recover on clear.
//
// E2E_MODE=demo (default): the web app replays contracts/fixtures/ws-state.jsonl (SYNTHETIC),
// locked to the wall clock: storm alert at t = 30, home at t = 38, clear at t = 50.
// E2E_MODE=live: a real session on mission-control; alert and clear are sent with the console
// buttons.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Browser, type BrowserContext, type Page, type TestInfo } from '@playwright/test'
import {
  mode,
  parseClock,
  parsePos,
  snap,
  socketReader,
  storeReader,
  threadPixels,
  type StateReader,
} from './helpers'

const MODE = mode()
const DEMO = MODE === 'demo'

/** Fixture times (contracts/fixtures/ws-state.jsonl, docs/PLAN_CHANGES.md F4). */
const FX = { session: 'fx-session', alert: 30, home: 38, clear: 50, last: 59, haven: [60, 60] as const }

/**
 * The DEMO replay is locked to the wall clock (web/src/app/demo.ts): one fixture minute per 0.5 s,
 * 60 frames plus a 6-frame pause, so one loop takes 33 s. A slow runner (CI renders WebGL on the CPU)
 * can spend seconds on one screenshot, so DEMO checks never assume where in the loop they are: each
 * phase first waits for the replay to reach it, in this loop or the next.
 */
const LOOP_MS = 33_000

/** Fixture position by fixture minute, to check that a screen shows one coherent replay frame. */
const FX_POS = new Map<number, [number, number]>(
  readFileSync(fileURLToPath(new URL('../../contracts/fixtures/ws-state.jsonl', import.meta.url)), 'utf-8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l))
    .filter((f) => f.type === 'state')
    .map((f) => [f.t_min, [f.pos[0], f.pos[1]]] as [number, [number, number]]),
)

/**
 * How many replay frames (0.5 s each) the console may trail the cuff in DEMO. A GPU-less CI runner
 * draws the console's WebGL map on the CPU, so the console's main thread applies each frame up to
 * ~1 s late, while the light cuff keeps up. On a real screen both show the same frame.
 */
const DEMO_LAG_FRAMES = 3

/** E2E_CPU_THROTTLE=4 slows both pages 4x (Chrome DevTools CPU throttling) to reproduce CI locally. */
const CPU_THROTTLE = Number(process.env.E2E_CPU_THROTTLE || 0)

/** Waits until the console's replay time satisfies `ok` (DEMO only), up to just over one loop. */
async function waitForReplay(reader: StateReader, what: string, ok: (t: number) => boolean) {
  await expect
    .poll(async () => {
      const t = (await reader.read())?.t_min
      return t !== undefined && ok(t)
    }, { message: `replay reaches ${what}`, timeout: LOOP_MS + 7_000, intervals: [100] })
    .toBe(true)
}

/** A calm moment far enough from the alert and from the loop's end for a few seconds of checks. */
const calmWindow = (t: number) => t < FX.alert - 8 || (t >= FX.clear && t <= FX.last - 5)

/** A context with its own video, written under the test's output folder. */
async function newScreen(browser: Browser, testInfo: TestInfo, name: string, size: { width: number; height: number }) {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: size,
    recordVideo: { dir: testInfo.outputPath(`video-${name}`), size },
  })
  const page = await context.newPage()
  if (CPU_THROTTLE > 1) {
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE })
  }
  return { context, page }
}

async function consoleClock(page: Page): Promise<number> {
  return parseClock(await page.getByTestId('bar-clock').textContent())
}

async function cuffClock(page: Page): Promise<number> {
  return parseClock(await page.getByTestId('cuff-clock').textContent())
}

/** Both clocks move forward over `waitMs` of wall time. */
async function expectClocksAdvance(con: Page, cuff: Page, waitMs: number) {
  const c1 = await consoleClock(con)
  const k1 = await cuffClock(cuff)
  await con.waitForTimeout(waitMs)
  expect(await consoleClock(con), 'console clock advances').toBeGreaterThan(c1)
  expect(await cuffClock(cuff), 'cuff clock advances').toBeGreaterThan(k1)
}

/**
 * At one moment, console and cuff show the same simulated time and the same position. Live: exactly
 * the same state. DEMO: each screen shows a coherent fixture frame, at most DEMO_LAG_FRAMES apart.
 * The values are read in parallel (read one after another on a slow runner they span more than one
 * 0.5 s frame) and retried until one sample agrees.
 */
async function expectSameState(con: Page, reader: StateReader, cuff: Page) {
  await expect(async () => {
    const [s, cuffT, cuffPosText, conT] = await Promise.all([
      reader.read(),
      cuffClock(cuff),
      cuff.getByTestId('cuff-pos').textContent(),
      consoleClock(con),
    ])
    expect(s, 'console has a state').not.toBeNull()
    const cuffPos = parsePos(cuffPosText)
    if (DEMO) {
      // Each screen shows one coherent fixture frame (its time and its position together) ...
      const conFx = FX_POS.get(s!.t_min)
      expect(conFx, `console state t = ${s!.t_min} is a fixture frame`).toBeDefined()
      expect(Math.abs(s!.pos[0] - conFx![0]) + Math.abs(s!.pos[1] - conFx![1]), 'console position = fixture').toBeLessThanOrEqual(1)
      const cuffFrame = Math.round(cuffT)
      expect(Math.abs(cuffT - cuffFrame), 'cuff clock is on a fixture minute').toBeLessThan(1 / 60)
      const cuffFx = FX_POS.get(cuffFrame)
      expect(cuffFx, `cuff clock t = ${cuffFrame} is a fixture frame`).toBeDefined()
      // The cuff rounds the position to whole metres.
      expect(Math.abs(cuffPos[0] - cuffFx![0]), 'cuff x = fixture').toBeLessThanOrEqual(1)
      expect(Math.abs(cuffPos[1] - cuffFx![1]), 'cuff y = fixture').toBeLessThanOrEqual(1)
      // ... of the same replay, within the console's render lag on a slow runner (DEMO_LAG_FRAMES).
      expect(Math.abs(cuffT - s!.t_min), 'cuff and console on the same replay').toBeLessThanOrEqual(DEMO_LAG_FRAMES)
      expect(Math.abs(conT - Math.floor(s!.t_min)), 'console clock = console state').toBeLessThanOrEqual(1)
    } else {
      // The cuff clock has seconds; the console bar shows whole minutes (floored).
      expect(Math.abs(cuffT - s!.t_min), 'cuff clock = console state').toBeLessThan(1 / 60)
      expect(conT, 'console clock = console state').toBe(Math.floor(s!.t_min))
      // The cuff rounds the position to whole metres.
      expect(Math.abs(cuffPos[0] - s!.pos[0]), 'x matches').toBeLessThanOrEqual(1)
      expect(Math.abs(cuffPos[1] - s!.pos[1]), 'y matches').toBeLessThanOrEqual(1)
    }
  }).toPass({ timeout: 20_000, intervals: [50, 100, 200] })
}

/**
 * Thread-coloured pixels on the console map, from a screenshot taken while the console's alert
 * state is `alert` both before and after the capture (DEMO: retried into the next loop if the
 * replay moves on during a slow screenshot).
 */
async function threadPixelsWhile(con: Page, reader: StateReader, alert: boolean, check: (px: number) => void) {
  await expect(async () => {
    expect((await reader.read())?.alert, 'alert state before the screenshot').toBe(alert)
    const px = await mapThreadPixels(con)
    expect((await reader.read())?.alert, 'alert state after the screenshot').toBe(alert)
    check(px)
  }).toPass({ timeout: DEMO ? 2 * LOOP_MS : 15_000 })
}

async function mapThreadPixels(con: Page): Promise<number> {
  return threadPixels(con, await con.locator('.cx-map').screenshot())
}

test('demo90: console and cuff through a storm alert', async ({ browser }, testInfo) => {
  testInfo.annotations.push({ type: 'mode', description: MODE })
  // DEMO may wait into the next 33 s loop at a few phases on a slow runner.
  if (DEMO) test.setTimeout(240_000)
  const screens: { context: BrowserContext; page: Page }[] = []

  try {
    // 1. Console.
    const con = await newScreen(browser, testInfo, 'console', { width: 1440, height: 900 })
    screens.push(con)
    const reader = DEMO ? storeReader(con.page) : socketReader(con.page)
    await con.page.goto(DEMO ? '/?demo=1' : '/')

    let sessionId: string
    if (DEMO) {
      await expect(con.page.getByText('DEMO DATA')).toBeVisible()
      await expect(con.page.getByTestId('session-status')).toHaveText('DEMO replay')
      sessionId = FX.session
    } else {
      await con.page.getByRole('button', { name: /Create session|New session/ }).click()
      await expect(con.page).toHaveURL(/[?&]s=[^&]+/, { timeout: 30_000 })
      sessionId = new URL(con.page.url()).searchParams.get('s')!
      await expect(con.page.getByTestId('session-status')).toContainText('Connected')
      await expect(con.page.getByTestId('session-status')).toContainText(sessionId)
    }

    // 2. Pair the cuff from the console's QR dialog and open it in a second context.
    await con.page.getByRole('button', { name: 'Pair cuff' }).click()
    const pairUrl = await con.page.getByTestId('pair-url').getAttribute('href')
    expect(pairUrl).toBeTruthy()
    if (!DEMO) expect(pairUrl).toContain(`s=${encodeURIComponent(sessionId)}`)
    await con.page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()

    const cuff = await newScreen(browser, testInfo, 'cuff', { width: 390, height: 844 })
    screens.push(cuff)
    // Same origin as the console under test (the QR URL names the console's own origin).
    const u = new URL(pairUrl!)
    await cuff.page.goto(u.pathname + u.search)
    await expect(cuff.page.getByText(`Session ${sessionId}`)).toBeVisible()
    await expect(cuff.page.getByTestId('cuff-pos')).toContainText(/x \d+ m/)

    // 3. Start. DEMO: the replay already runs; wait for the start of a replay loop so every later
    // step happens at a known simulated time.
    if (DEMO) {
      await expect
        .poll(async () => (await reader.read())?.t_min ?? -1, { timeout: 40_000, intervals: [100] })
        .toBeLessThanOrEqual(3)
      await expect.poll(async () => (await reader.read())?.t_min ?? -1, { intervals: [100] }).toBeGreaterThanOrEqual(0)
    } else {
      // Slowest speed, so the walk home is still under way when the alert is cleared.
      await con.page.getByLabel('Speed').selectOption('1')
      await con.page.getByRole('button', { name: /^Start/ }).click()
      await expect(cuff.page.getByText('Running')).toBeVisible()
    }

    // 4. Both clocks advance; both screens show the same time and position.
    if (DEMO) await waitForReplay(reader, 'a calm stretch', calmWindow)
    await expectClocksAdvance(con.page, cuff.page, 2_500)
    await expectSameState(con.page, reader, cuff.page)
    if (DEMO) await waitForReplay(reader, 'a calm stretch', calmWindow)
    await expect(con.page.getByTestId('storm-strip')).toBeHidden()
    await expect(cuff.page.getByTestId('cuff-alert')).toBeHidden()
    let calm = 0
    await threadPixelsWhile(con.page, reader, false, (px) => (calm = px))
    await snap(testInfo, '01-running', { console: con.page, cuff: cuff.page })

    // 5. Storm alert: from the fixture replay (DEMO, at t = 30 of this loop or the next) or the
    // console button (live).
    if (!DEMO) await con.page.getByRole('button', { name: /^Storm alert/ }).click()
    await expect(con.page.getByTestId('storm-strip')).toBeVisible({ timeout: DEMO ? LOOP_MS + 7_000 : 30_000 })
    await expect(con.page.getByTestId('storm-strip')).toContainText(/STORM ALERT · time to storm \d+:\d{2}/)
    await expect(con.page.getByTestId('storm-chip')).toContainText(/Storm in \d+ min/)
    await expect(cuff.page.getByTestId('cuff-alert')).toBeVisible()
    await expect(cuff.page.getByTestId('cuff-alert')).toContainText('STORM ALERT')
    await expect(cuff.page.getByTestId('alert-storm')).toContainText(/\d+:\d{2}/)
    // The console draws the thread: listed as a layer and red pixels on the map.
    await expect(con.page.getByRole('checkbox', { name: /Way home before the storm/ })).toBeChecked()
    let stormy = 0
    // A CI runner without a GPU screenshots a full-screen WebGL map slowly.
    await threadPixelsWhile(con.page, reader, true, (px) => {
      stormy = px
      expect(px, `thread pixels (before the alert: ${calm})`).toBeGreaterThan(calm + 300)
    })
    testInfo.annotations.push({ type: 'thread pixels', description: `before ${calm}, during alert ${stormy}` })
    await snap(testInfo, '02-alert', { console: con.page, cuff: cuff.page })

    if (DEMO) {
      // The fixture walks the thread home and stops there (t = 38), still under the alert until
      // t = 50. Wait for that stretch (this loop or the next) with a few seconds left for the checks.
      await waitForReplay(reader, 'home under the alert', (t) => t >= FX.home && t <= FX.clear - 4)
      await expect(cuff.page.getByTestId('cuff-pos')).toContainText(`x ${FX.haven[0]} m · y ${FX.haven[1]} m`, {
        timeout: 3_000,
      })
      await expect(cuff.page.getByTestId('cuff-alert')).toBeVisible({ timeout: 3_000 })
      await snap(testInfo, '02b-home', { console: con.page, cuff: cuff.page })
    } else {
      await expectSameState(con.page, reader, cuff.page)
    }

    // 6. Clear: from the fixture replay (DEMO) or the console button (live).
    if (!DEMO) await con.page.getByRole('button', { name: /^Clear/ }).click()

    // 7. Recovery on both screens. DEMO: the clear at t = 50 (this loop or the next).
    await expect(con.page.getByTestId('storm-strip')).toBeHidden({ timeout: DEMO ? LOOP_MS + 7_000 : 20_000 })
    if (DEMO) await waitForReplay(reader, 'the calm after clear', calmWindow)
    await expect(con.page.getByTestId('storm-chip')).toBeHidden()
    await expect(cuff.page.getByTestId('cuff-alert')).toBeHidden()
    await expect(cuff.page.getByTestId('cuff-margin')).toBeVisible()
    await expect(cuff.page.getByTestId('cuff-next')).not.toContainText('Heading to')
    await expect(con.page.getByRole('checkbox', { name: /Way home before the storm/ })).toHaveCount(0)
    await threadPixelsWhile(con.page, reader, false, (px) =>
      expect(px, `thread pixels after clear (before ${calm}, during ${stormy})`).toBeLessThan(calm + 100),
    )
    // Clocks keep going: DEMO replays on (checked away from the loop's wrap); live resumes the plan
    // from where the alert left off.
    if (DEMO) await waitForReplay(reader, 'a calm stretch', calmWindow)
    await expectClocksAdvance(con.page, cuff.page, 1_500)
    await expectSameState(con.page, reader, cuff.page)
    await snap(testInfo, '03-clear', { console: con.page, cuff: cuff.page })
  } finally {
    // Closing a context finishes its video; attach both so CI keeps them with the report.
    for (const s of screens) {
      const video = s.page.video()
      await s.context.close()
      if (video) {
        const path = await video.path()
        await testInfo.attach(`video-${path.includes('video-cuff') ? 'cuff' : 'console'}`, {
          path,
          contentType: 'video/webm',
        })
      }
    }
  }
})
