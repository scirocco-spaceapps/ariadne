// demo90: the demo scenario end to end on two screens, the mission console and the astronaut's
// cuff. Console and cuff stay in step, a storm alert reaches both, the console draws the red
// thread home, and both recover on clear.
//
// E2E_MODE=demo (default): the web app replays contracts/fixtures/ws-state.jsonl (SYNTHETIC),
// locked to the wall clock: storm alert at t = 30, home at t = 38, clear at t = 50.
// E2E_MODE=live: a real session on mission-control; alert and clear are sent with the console
// buttons.
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
const FX = { session: 'fx-session', alert: 30, home: 38, clear: 50, haven: [60, 60] as const }

/** A context with its own video, written under the test's output folder. */
async function newScreen(browser: Browser, testInfo: TestInfo, name: string, size: { width: number; height: number }) {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: size,
    recordVideo: { dir: testInfo.outputPath(`video-${name}`), size },
  })
  const page = await context.newPage()
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

/** At one moment, console and cuff show the same simulated time and the same position. */
async function expectSameState(con: Page, reader: StateReader, cuff: Page) {
  await expect(async () => {
    const s = await reader.read()
    expect(s, 'console has a state').not.toBeNull()
    const cuffT = await cuffClock(cuff)
    const cuffPos = parsePos(await cuff.getByTestId('cuff-pos').textContent())
    const conT = await consoleClock(con)
    // The cuff clock has seconds; the console bar shows whole minutes (floored).
    expect(Math.abs(cuffT - s!.t_min), 'cuff clock = console state').toBeLessThan(1 / 60)
    expect(conT, 'console clock = console state').toBe(Math.floor(s!.t_min))
    // The cuff rounds the position to whole metres.
    expect(Math.abs(cuffPos[0] - s!.pos[0]), 'x matches').toBeLessThanOrEqual(1)
    expect(Math.abs(cuffPos[1] - s!.pos[1]), 'y matches').toBeLessThanOrEqual(1)
  }).toPass({ timeout: 10_000, intervals: [50, 100, 200] })
}

async function mapThreadPixels(con: Page): Promise<number> {
  return threadPixels(con, await con.locator('.cx-map').screenshot())
}

test('demo90: console and cuff through a storm alert', async ({ browser }, testInfo) => {
  testInfo.annotations.push({ type: 'mode', description: MODE })
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
    await expectClocksAdvance(con.page, cuff.page, 2_500)
    await expectSameState(con.page, reader, cuff.page)
    await expect(con.page.getByTestId('storm-strip')).toBeHidden()
    await expect(cuff.page.getByTestId('cuff-alert')).toBeHidden()
    const calm = await mapThreadPixels(con.page)
    await snap(testInfo, '01-running', { console: con.page, cuff: cuff.page })

    // 5. Storm alert: from the fixture replay (DEMO) or the console button (live).
    if (DEMO) {
      expect((await reader.read())!.t_min, 'still before the fixture alert').toBeLessThan(FX.alert)
    } else {
      await con.page.getByRole('button', { name: /^Storm alert/ }).click()
    }
    await expect(con.page.getByTestId('storm-strip')).toBeVisible({ timeout: 30_000 })
    await expect(con.page.getByTestId('storm-strip')).toContainText(/STORM ALERT · time to storm \d+:\d{2}/)
    await expect(con.page.getByTestId('storm-chip')).toContainText(/Storm in \d+ min/)
    await expect(cuff.page.getByTestId('cuff-alert')).toBeVisible()
    await expect(cuff.page.getByTestId('cuff-alert')).toContainText('STORM ALERT')
    await expect(cuff.page.getByTestId('alert-storm')).toContainText(/\d+:\d{2}/)
    // The console draws the thread: listed as a layer and red pixels on the map.
    await expect(con.page.getByRole('checkbox', { name: /Way home before the storm/ })).toBeChecked()
    let stormy = 0
    await expect(async () => {
      stormy = await mapThreadPixels(con.page)
      expect(stormy, `thread pixels (before the alert: ${calm})`).toBeGreaterThan(calm + 300)
    }).toPass({ timeout: 5_000 })
    testInfo.annotations.push({ type: 'thread pixels', description: `before ${calm}, during alert ${stormy}` })
    await snap(testInfo, '02-alert', { console: con.page, cuff: cuff.page })

    if (DEMO) {
      // The fixture walks the thread home and stops there (t = 38), still under the alert.
      await expect
        .poll(async () => (await reader.read())?.t_min ?? -1, { timeout: 10_000, intervals: [100] })
        .toBeGreaterThanOrEqual(FX.home)
      await expect(cuff.page.getByTestId('cuff-pos')).toContainText(`x ${FX.haven[0]} m · y ${FX.haven[1]} m`)
      await expect(cuff.page.getByTestId('cuff-alert')).toBeVisible()
      await snap(testInfo, '02b-home', { console: con.page, cuff: cuff.page })
    } else {
      await expectSameState(con.page, reader, cuff.page)
    }

    // 6. Clear: from the fixture replay (DEMO) or the console button (live).
    if (!DEMO) await con.page.getByRole('button', { name: /^Clear/ }).click()

    // 7. Recovery on both screens.
    await expect(con.page.getByTestId('storm-strip')).toBeHidden({ timeout: 20_000 })
    await expect(con.page.getByTestId('storm-chip')).toBeHidden()
    await expect(cuff.page.getByTestId('cuff-alert')).toBeHidden()
    await expect(cuff.page.getByTestId('cuff-margin')).toBeVisible()
    await expect(cuff.page.getByTestId('cuff-next')).not.toContainText('Heading to')
    await expect(con.page.getByRole('checkbox', { name: /Way home before the storm/ })).toHaveCount(0)
    await expect(async () => {
      const after = await mapThreadPixels(con.page)
      expect(after, `thread pixels after clear (before ${calm}, during ${stormy})`).toBeLessThan(calm + 100)
    }).toPass({ timeout: 5_000 })
    // Clocks keep going: DEMO replays on; live resumes the plan from where the alert left off.
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
