import { readFile } from 'node:fs/promises'
import { getPreset, presets } from '../src/presets'
import { expect, fitAll, importFile, kthFromEndJSON, loadPreset, nodesOutsidePanes, openApp, openTab, savedMachine, skipToEnd, test, toast } from './helpers'

const abb = getPreset('thompson-abb')!

test.describe('Convert', () => {
  for (const preset of presets) {
    test(`${preset.id}: skipping to the end builds ${preset.expectedDfaStates} DFA states`, async ({ page }) => {
      await openApp(page)
      await loadPreset(page, preset.id)
      await openTab(page, 'Convert')
      await skipToEnd(page)
      const n = preset.expectedDfaStates!
      await expect(page.getByText(`${n} of ${n} states found`)).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Conversion complete' })).toBeVisible()
    })
  }

  test('(a|b)*abb: the DFA table is the textbook A–E table', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    await openTab(page, 'Convert')
    await skipToEnd(page)
    const table = page.locator('table').filter({ has: page.locator('thead th', { hasText: /^State$/ }) })
    const rows = table.locator('tbody tr')
    await expect(rows).toHaveCount(abb.expectedDfaTable!.length)
    for (const [i, row] of abb.expectedDfaTable!.entries()) {
      const tr = rows.nth(i)
      await expect(tr.locator('th')).toContainText(row.state)
      await expect(tr.locator('th')).toContainText(`{${row.subset.join(',')}}`)
      await expect(tr.locator('td')).toHaveText([row.on.a, row.on.b])
    }
  })

  test('the dead-state toggle adds and removes ∅', async ({ page }) => {
    const preset = getPreset('dead-state')!
    const n = preset.expectedDfaStates!
    await openApp(page)
    await loadPreset(page, 'dead-state')
    await openTab(page, 'Convert')
    await skipToEnd(page)
    await expect(page.getByText(`${n} of ${n} states found`)).toBeVisible()
    await expect(page.getByRole('row', { name: /∅/ }).first()).toBeVisible()
    await page.getByText('Show dead state ∅').click()
    await skipToEnd(page)
    await expect(page.getByText(`${n - 1} of ${n - 1} states found`)).toBeVisible()
    await expect(page.locator('table tbody th', { hasText: '= ∅' })).toHaveCount(0)
  })

  test('a 13-state machine with a 4096-state DFA opens the guarded view without crashing', async ({ page }) => {
    await openApp(page)
    await importFile(page, 'twelfth-from-end.json', kthFromEndJSON(12))
    await expect(toast(page)).toContainText('Imported twelfth-from-end.json')
    await openTab(page, 'Convert')
    await expect(page.getByRole('heading', { name: 'DFA diagram hidden' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/4096 states: the 2ⁿ worst case/).first()).toBeVisible()
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0)
    // The ε-NFA gets the full width above the notice, so its 13-state chain stays inside the pane.
    await page.waitForTimeout(500)
    for (const pane of await nodesOutsidePanes(page)) expect(pane.outside).toEqual([])
  })
})

test.describe('Minimize', () => {
  test('(a|b)*abb minimizes to 4 states: {A,C}, {B}, {D}, {E}', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    await openTab(page, 'Minimize')
    await skipToEnd(page)
    await expect(page.getByRole('heading', { name: 'Minimization complete' })).toBeVisible()
    await expect(page.getByText('4 states (was 5)')).toBeVisible()
    const blocks = await page.getByRole('list', { name: 'Blocks of the partition' }).getByRole('listitem').allInnerTexts()
    expect(blocks.map((b) => b.trim()).sort()).toEqual(['{A,C}', '{B}', '{D}', '{E}'])
  })
})

test.describe('Test', () => {
  const input = (page: import('@playwright/test').Page) => page.getByRole('textbox', { name: 'Input string' })
  const verdict = (page: import('@playwright/test').Page, machine: 'ε-NFA' | 'DFA') =>
    page.getByRole('region', { name: 'Result' }).locator('div', { hasText: new RegExp(`^${machine}`) }).last()

  test('abb is accepted and ab is rejected by both machines', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    await openTab(page, 'Test')
    await input(page).fill('abb')
    await skipToEnd(page)
    await expect(verdict(page, 'ε-NFA')).toContainText('ACCEPTED')
    await expect(verdict(page, 'DFA')).toContainText('ACCEPTED')
    await expect(page.getByText('Both machines agree')).toBeVisible()

    await input(page).fill('ab')
    await skipToEnd(page)
    await expect(verdict(page, 'ε-NFA')).toContainText('REJECTED')
    await expect(verdict(page, 'DFA')).toContainText('REJECTED')
  })

  test('the empty string ε is handled (and rejected by (a|b)*abb)', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    await openTab(page, 'Test')
    await page.getByRole('button', { name: 'Use the empty string ε' }).click()
    await expect(input(page)).toHaveValue('')
    await expect(page.getByText('ε · empty input')).toBeVisible()
    await skipToEnd(page)
    await expect(verdict(page, 'ε-NFA')).toContainText('REJECTED')
    await expect(verdict(page, 'DFA')).toContainText('REJECTED')
  })

  test('abc shows the invalid-symbol error at position 2, not a rejection', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    await openTab(page, 'Test')
    await input(page).fill('abc')
    const error = page.getByRole('alert').filter({ hasText: 'not in Σ' })
    await expect(error).toContainText('“c” at position 2 is not in Σ = {a, b}.')
    await expect(error).toContainText('This is an invalid input, not a rejection.')
    await expect(page.getByText('REJECTED')).toHaveCount(0)
  })

  test('batch tester: "Load expected strings" passes every row', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    await openTab(page, 'Test')
    await page.getByRole('button', { name: 'Load expected strings' }).click()
    const total = abb.expected.accepts.length + abb.expected.rejects.length
    await expect(page.getByRole('status').filter({ hasText: `${total} strings` })).toContainText(`${total} pass, 0 fail`)
    await expect(page.getByText('PASS', { exact: true })).toHaveCount(total)
  })

  test('the equivalence check passes', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    await openTab(page, 'Test')
    await page.getByRole('button', { name: 'Verify' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'agree on all' })).toContainText('ε-NFA and DFA agree on all 511 strings over Σ up to length 8.')
  })
})

test.describe('Downloads and import', () => {
  test('the DFA downloads as .json and .jff, and both import again', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    await openTab(page, 'Convert')
    await skipToEnd(page)

    const save = async (format: string) => {
      await page.getByRole('button', { name: 'Download DFA' }).click()
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: new RegExp(format) }).click()])
      const path = await download.path()
      return { name: download.suggestedFilename(), text: await readFile(path, 'utf8') }
    }
    const json = await save('JSON \\(\\.json\\)')
    expect(json.name).toMatch(/\.json$/)
    const jff = await save('JFLAP file \\(\\.jff\\)')
    expect(jff.name).toMatch(/\.jff$/)
    expect(jff.text).toContain('<type>fa</type>')

    const dfa = JSON.parse(json.text)
    expect(dfa.states).toEqual(['A', 'B', 'C', 'D', 'E'])

    await importFile(page, json.name, json.text)
    await expect(toast(page)).toContainText(`Imported ${json.name}`)
    const fromJson = await savedMachine(page)
    expect(fromJson).toMatchObject({ states: dfa.states, alphabet: dfa.alphabet, start: dfa.start, finals: dfa.finals, transitions: dfa.transitions })

    await importFile(page, jff.name, jff.text)
    await expect(toast(page)).toContainText(`Imported ${jff.name} (JFLAP)`)
    const fromJff = await savedMachine(page)
    expect(fromJff).toMatchObject({ states: dfa.states, start: dfa.start, finals: dfa.finals, transitions: dfa.transitions })
  })

  test('importing broken JSON shows a friendly error and keeps the machine', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    const before = await savedMachine(page)
    await importFile(page, 'broken.json', '{"format":"enfa", "states": [')
    await expect(toast(page)).toContainText('Could not import broken.json. This looks like a JSON file, but not valid JSON')
    await expect(page.getByRole('alert').filter({ hasText: 'Could not import' })).toBeVisible()
    expect(await savedMachine(page)).toEqual(before)
  })
})

test.describe('Layout at 1366×768', () => {
  for (const tab of ['Convert', 'Test', 'Minimize'] as const) {
    test(`${tab}: after Fit every node is inside its pane`, async ({ page }) => {
      await openApp(page)
      await loadPreset(page, 'thompson-abb')
      await openTab(page, tab)
      await skipToEnd(page)
      await fitAll(page)
      const panes = await nodesOutsidePanes(page)
      expect(panes.length).toBeGreaterThanOrEqual(2)
      for (const pane of panes) {
        expect(pane.nodes).toBeGreaterThan(0)
        expect(pane.outside).toEqual([])
      }
    })
  }

  test('every tab opens with the whole graph in view', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    for (const tab of ['Convert', 'Test', 'Minimize'] as const) {
      await openTab(page, tab)
      await page.waitForTimeout(600)
      for (const pane of await nodesOutsidePanes(page)) expect(pane.outside, `${tab} first view`).toEqual([])
    }
  })
})

test.describe('Worst cases', () => {
  test('switching tabs quickly while animations play does not crash', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    for (const tab of ['Convert', 'Test', 'Minimize'] as const) {
      await openTab(page, tab)
      await page.getByRole('button', { name: /^Play/ }).click()
      await page.waitForTimeout(150)
    }
    for (let i = 0; i < 16; i++) await page.getByRole('tab', { name: ['Define', 'Convert', 'Test', 'Minimize'][i % 4] }).click()
    await openTab(page, 'Convert')
    await page.setViewportSize({ width: 1000, height: 640 })
    await page.getByRole('button', { name: /^Play/ }).click()
    await page.setViewportSize({ width: 1366, height: 768 })
    await skipToEnd(page)
    await expect(page.getByText('5 of 5 states found')).toBeVisible()
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0)
  })

  test('a blank machine and a machine without a start state open every tab', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'New' }).click()
    for (const tab of ['Convert', 'Test', 'Minimize', 'Define'] as const) await openTab(page, tab)
    await loadPreset(page, 'thompson-abb')
    await page.getByRole('button', { name: 'Delete state 0' }).click()
    await expect(page.getByText('No start state is set.').first()).toBeVisible()
    for (const tab of ['Convert', 'Test', 'Minimize'] as const) {
      await openTab(page, tab)
      await expect(page.getByText('This machine can’t be converted yet')).toBeVisible()
    }
    await expect(page.getByText(/Something went wrong/i)).toHaveCount(0)
  })

  test('a 5,003-symbol input is run as text with a capped tape', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    await openTab(page, 'Test')
    await page.getByRole('textbox', { name: 'Input string' }).fill('ab'.repeat(2500) + 'abb')
    await expect(page.getByText('Run shown as text')).toBeVisible()
    await expect(page.getByRole('list', { name: 'Input tape' }).getByRole('listitem')).toHaveCount(201)
    await expect(page.getByRole('list', { name: 'Symbols' }).getByText('+4,803 more')).toBeVisible()
    await expect(page.getByText('Both machines agree')).toBeVisible()
  })

  test('junk and empty files give friendly import errors', async ({ page }) => {
    await openApp(page)
    await importFile(page, 'garbage.jff', 'PK\u0003\u0004 not xml at all')
    await expect(toast(page)).toContainText('Could not import garbage.jff.')
    await importFile(page, 'empty.json', '')
    await expect(toast(page)).toContainText('Could not import empty.json. The file is empty.')
    await importFile(page, 'notes.txt', 'this is not a machine\n')
    await expect(toast(page)).toContainText('Could not import notes.txt.')
  })

  test('toasts sit in the sidebar, never over a graph', async ({ page }) => {
    await openApp(page)
    await loadPreset(page, 'thompson-abb')
    await openTab(page, 'Minimize')
    await skipToEnd(page)
    await page.getByRole('button', { name: 'Download minimized DFA' }).click()
    await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /JSON/ }).click()])
    const box = await toast(page).boundingBox()
    const canvas = await page.getByRole('region', { name: 'DFA and minimal DFA diagrams' }).boundingBox()
    expect(box && canvas).toBeTruthy()
    expect(box!.x).toBeGreaterThanOrEqual(canvas!.x + canvas!.width)
    // Success toasts close themselves after about 2.5 s.
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 4_000 })
  })
})
