/**
 * Report figures: `npm run screenshots` saves each view to ../Screenshots
 * at 1440×900, device scale factor 2, with no toast or hover state showing.
 */
import { resolve } from 'node:path'
import type { Page } from '@playwright/test'
import { expect, fitAll, importFile, kthFromEndJSON, loadPreset, openApp, openTab, skipToEnd, test } from './helpers'

const OUT = resolve(process.cwd(), '..', 'Screenshots')

/** Closes every toast, parks the pointer on a neutral spot and lets motion settle. */
async function clean(page: Page, settle = 450): Promise<void> {
  for (const b of await page.locator('.toast').getByRole('button', { name: 'Dismiss' }).all()) await b.click().catch(() => {})
  await expect(page.locator('.toast')).toHaveCount(0)
  await page.mouse.move(1, 1)
  await page.waitForTimeout(settle)
}

async function shot(page: Page, name: string, settle?: number): Promise<void> {
  await clean(page, settle)
  await page.screenshot({ path: `${OUT}/${name}.png` })
}

/** Scrolls the right sidebar so the section with this heading is at its top. */
async function scrollInspectorTo(page: Page, heading: string | RegExp): Promise<void> {
  await page
    .getByRole('complementary', { name: 'Inspector' })
    .getByRole('heading', { name: heading })
    .evaluate((h) => {
      const aside = h.closest('aside')!
      aside.scrollTop += h.getBoundingClientRect().top - aside.getBoundingClientRect().top - 12
    })
}

/** Starts the app with the (a|b)*abb Thompson ε-NFA loaded. */
async function abb(page: Page): Promise<void> {
  await openApp(page)
  await loadPreset(page, 'thompson-abb')
}

test('01 define table', async ({ page }) => {
  await abb(page)
  // Builder scrolled to the very top, so no section header is cut off.
  await page.getByRole('complementary', { name: 'Builder' }).evaluate((aside) => (aside.scrollTop = 0))
  await fitAll(page)
  await shot(page, '01-define-table')
})

test('02 define graph', async ({ page }) => {
  await abb(page)
  await fitAll(page)
  await shot(page, '02-define-graph')
})

test('03 validation errors', async ({ page }) => {
  await openApp(page)
  // A machine with typical mistakes: a symbol outside Σ, an undeclared target and an unreachable state.
  await page.evaluate(() =>
    localStorage.setItem(
      'enfa-sim.nfa.v1',
      JSON.stringify({
        format: 'enfa',
        version: 1,
        states: ['q0', 'q1', 'q2', 'q3'],
        alphabet: ['a', 'b'],
        start: 'q0',
        finals: ['q2'],
        transitions: { q0: { a: ['q1'], ε: ['q1'] }, q1: { b: ['q2'], c: ['q2'] }, q2: { a: ['q5'] } },
      }),
    ),
  )
  await page.reload()
  await expect(page.getByText(/errors?/).first()).toBeVisible()
  await fitAll(page)
  await shot(page, '03-validation-errors')
})

test('04 closure table', async ({ page }) => {
  await abb(page)
  await openTab(page, 'Convert')
  await scrollInspectorTo(page, 'ε-closures')
  await page.getByRole('button', { name: /^ε-cl\(3\)/ }).click()
  await shot(page, '04-closure-table', 700)
})

test('05 subset step mid', async ({ page }) => {
  await abb(page)
  await openTab(page, 'Convert')
  await clean(page, 300)
  // Step 2 is move(A, a): play it and catch the a-tokens half way along 2 → 3 and 7 → 8.
  await page.getByRole('button', { name: 'Step forward (→)' }).click()
  await page.mouse.move(1, 1)
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/05-subset-step-mid.png` })
})

test('06 subset final', async ({ page }) => {
  await abb(page)
  await openTab(page, 'Convert')
  await skipToEnd(page)
  await shot(page, '06-subset-final', 700)
})

test('07 dead state', async ({ page }) => {
  await openApp(page)
  await loadPreset(page, 'dead-state')
  await openTab(page, 'Convert')
  await skipToEnd(page)
  await scrollInspectorTo(page, 'Conversion complete')
  await shot(page, '07-dead-state', 700)
})

async function testString(page: Page, input: string): Promise<void> {
  await abb(page)
  await openTab(page, 'Test')
  await page.getByRole('textbox', { name: 'Input string' }).fill(input)
  const skip = page.getByRole('button', { name: 'Skip to the end' })
  if ((await skip.count()) > 0 && (await skip.isEnabled())) await skip.click()
}

test('08 test accepted', async ({ page }) => {
  await testString(page, 'babb')
  await shot(page, '08-test-accepted', 700)
})

test('09 test rejected', async ({ page }) => {
  await testString(page, 'abba')
  await shot(page, '09-test-rejected', 700)
})

test('10 test invalid symbol', async ({ page }) => {
  await testString(page, 'abc')
  await shot(page, '10-test-invalid-symbol')
})

test('11 batch tester', async ({ page }) => {
  await testString(page, 'abb')
  await page.getByRole('button', { name: 'Load expected strings' }).click()
  await scrollInspectorTo(page, 'Batch test')
  await shot(page, '11-batch-tester')
})

test('12 equivalence', async ({ page }) => {
  await testString(page, 'abb')
  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByText(/agree on all/)).toBeVisible()
  await scrollInspectorTo(page, 'Equivalence check')
  await shot(page, '12-equivalence')
})

test('13 minimize rounds', async ({ page }) => {
  await abb(page)
  await openTab(page, 'Minimize')
  await page.getByRole('button', { name: /^R1/ }).click()
  await shot(page, '13-minimize-rounds', 1600)
})

test('14 minimized dfa', async ({ page }) => {
  await abb(page)
  await openTab(page, 'Minimize')
  await skipToEnd(page)
  await shot(page, '14-minimized-dfa', 900)
})

test('15 docs', async ({ page }) => {
  await abb(page)
  await page.getByRole('button', { name: 'Docs' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await shot(page, '15-docs')
})

test('16 download menu', async ({ page }) => {
  await abb(page)
  await openTab(page, 'Convert')
  await skipToEnd(page)
  await clean(page)
  await page.getByRole('button', { name: 'Download', exact: true }).click()
  await expect(page.getByRole('menu', { name: 'Download' })).toBeVisible()
  await page.mouse.move(1, 1)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/16-download-menu.png` })
})

test('17 large dfa guard', async ({ page }) => {
  await openApp(page)
  await importFile(page, 'twelfth-from-end.json', kthFromEndJSON(12))
  await openTab(page, 'Convert')
  await expect(page.getByRole('heading', { name: 'DFA diagram hidden' })).toBeVisible({ timeout: 30_000 })
  await shot(page, '17-large-dfa-guard')
})

test('18 about', async ({ page }) => {
  await abb(page)
  await page.getByRole('button', { name: 'About' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await shot(page, '18-about')
})

test('19 from regex', async ({ page }) => {
  await openApp(page)
  await loadPreset(page, 'epsilon-cycle')
  await page.getByRole('textbox', { name: 'Regular expression' }).fill('(a|b)*abb')
  await page.getByRole('button', { name: 'Build', exact: true }).click()
  await expect(page.locator('.toast').last()).toContainText('Built the Thompson ε-NFA')
  await page.getByRole('complementary', { name: 'Builder' }).evaluate((aside) => (aside.scrollTop = 0))
  await fitAll(page)
  // Keep the typed regex visible: dismissing the toast does not clear the input.
  await shot(page, '19-from-regex')
})

test('20 working table', async ({ page }) => {
  await abb(page)
  await openTab(page, 'Convert')
  await skipToEnd(page)
  await page.getByRole('button', { name: /Working table/ }).click()
  await scrollInspectorTo(page, /Working table/)
  await shot(page, '20-working-table', 700)
})
