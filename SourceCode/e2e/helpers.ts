import { test as base, expect, type Locator, type Page } from '@playwright/test'

/** The four modes in the navbar. */
export type Tab = 'Define' | 'Convert' | 'Test' | 'Minimize'

/**
 * A test whose page fails the test on any console error or warning, or any
 * uncaught exception, so every flow also checks that the production build
 * runs cleanly.
 */
export const test = base.extend<{ consoleProblems: string[] }>({
  consoleProblems: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`)
      })
      page.on('pageerror', (e) => problems.push(`uncaught: ${e.message}`))
      await use(problems)
      expect(problems, 'console errors or warnings').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

/** Opens the app on a clean slate (each test has its own empty storage). */
export async function openApp(page: Page): Promise<void> {
  await page.goto('./')
  await expect(page.getByRole('tab', { name: 'Define' })).toBeVisible()
}

/** Switches mode. */
export async function openTab(page: Page, tab: Tab): Promise<void> {
  await page.getByRole('tab', { name: tab }).click()
  await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true')
}

/** Loads an example machine from the Examples menu. */
export async function loadPreset(page: Page, id: string): Promise<void> {
  await page.getByRole('combobox', { name: 'Examples' }).selectOption(id)
}

/** Clicks the player's "Skip to the end" (when it is not already there). */
export async function skipToEnd(page: Page): Promise<void> {
  const skip = page.getByRole('button', { name: 'Skip to the end' })
  if (await skip.isEnabled()) await skip.click()
  await expect(skip).toBeDisabled()
}

/** Imports a file through the navbar's hidden file input. */
export async function importFile(page: Page, name: string, contents: string | Buffer): Promise<void> {
  await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(contents) })
}

/** The toast currently shown, if any. */
export function toast(page: Page): Locator {
  return page.locator('.toast').last()
}

/** The machine the app saved to localStorage, as JSON. */
export async function savedMachine(page: Page): Promise<{ states: string[]; alphabet: string[]; start: string; finals: string[]; transitions: Record<string, Record<string, string[]>> }> {
  const raw = await page.evaluate(() => localStorage.getItem('enfa-sim.nfa.v1'))
  expect(raw).not.toBeNull()
  return JSON.parse(raw!)
}

/**
 * For each React Flow pane on screen: how many visible nodes it has and
 * which of them stick out of the pane.
 */
export async function nodesOutsidePanes(page: Page): Promise<{ nodes: number; outside: string[] }[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.react-flow')].map((pane) => {
      const box = pane.getBoundingClientRect()
      const nodes = [...pane.querySelectorAll<HTMLElement>('.react-flow__node')].filter((n) => getComputedStyle(n).visibility !== 'hidden' && n.offsetParent !== null)
      const outside = nodes
        .filter((n) => {
          const r = n.getBoundingClientRect()
          return r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5
        })
        .map((n) => n.getAttribute('data-id') ?? '?')
      return { nodes: nodes.length, outside }
    }),
  )
}

/** Clicks every pane's Fit button and waits for the camera to settle. */
export async function fitAll(page: Page): Promise<void> {
  for (const b of await page.getByRole('button', { name: 'Fit', exact: true }).all()) await b.click()
  await page.waitForTimeout(400)
}

/** Waits until no toast is on screen. */
export async function noToast(page: Page): Promise<void> {
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 10_000 })
}

/** The "k-th symbol from the end is a" NFA: k + 1 states, 2^k DFA states. */
export function kthFromEndJSON(k: number): string {
  const states = Array.from({ length: k + 1 }, (_, i) => `q${i}`)
  const transitions: Record<string, Record<string, string[]>> = { q0: { a: ['q0', 'q1'], b: ['q0'] } }
  for (let i = 1; i < k; i++) transitions[`q${i}`] = { a: [`q${i + 1}`], b: [`q${i + 1}`] }
  return JSON.stringify({ format: 'enfa', version: 1, states, alphabet: ['a', 'b'], start: 'q0', finals: [`q${k}`], transitions })
}
