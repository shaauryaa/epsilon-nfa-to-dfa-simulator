// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomPanel } from '../src/components/BottomPanel'
import { ConvertPanel } from '../src/components/convert/ConvertPanel'
import { ErrorBoundary } from '../src/components/ErrorBoundary'
import { BOOT_KEY } from '../src/lib/boot'
import { useApp } from '../src/store/automaton'
import { kthFromEnd } from './helpers'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('Convert with a 4096-state DFA', () => {
  it('renders the guarded view: notice, stats, a paged table, no timeline pills', () => {
    act(() => useApp.getState().commit(kthFromEnd(12), 'import'))
    act(() => useApp.getState().setActiveTab('convert'))
    act(() =>
      root.render(
        <>
          <ConvertPanel />
          <BottomPanel />
        </>,
      ),
    )
    const text = host.textContent ?? ''
    expect(text).toContain('4096 states: the 2ⁿ worst case (2¹²). The diagram and step animation are hidden; the table is complete.')
    expect(text).toContain('1–100 of 4,096')
    expect(text).toContain('The step timeline is hidden')
    expect(host.querySelectorAll('tbody tr').length).toBeLessThanOrEqual(100 + 13)
    expect(text).not.toContain('Step 1 of')
    const next = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Next')!
    act(() => next.click())
    expect(host.textContent).toContain('101–200 of 4,096')
  })

  it('a machine past the state cap shows the cap message instead of the error list', () => {
    act(() => useApp.getState().commit(kthFromEnd(13), 'import'))
    act(() => root.render(<ConvertPanel />))
    expect(host.textContent).toMatch(/stopped at 4,096 DFA states/)
    expect(host.textContent).not.toMatch(/Fix .* first/)
  })
})

describe('ErrorBoundary', () => {
  function Boom(): never {
    throw new Error('kaboom')
  }

  it('shows a friendly card, marks the session as crashed and resets storage', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem('enfa-sim.tab.v1', 'convert')
    localStorage.setItem('unrelated', 'keep')
    act(() =>
      root.render(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>,
      ),
    )
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Something went wrong')
    expect(host.textContent).toContain('kaboom')
    expect(localStorage.getItem(BOOT_KEY)).toBe('crashed')
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload, href: 'http://localhost/' })
    const reset = [...host.querySelectorAll('button')].find((b) => b.textContent === 'Reset to example')!
    reset.click()
    expect(reload).toHaveBeenCalled()
    expect(localStorage.getItem('enfa-sim.tab.v1')).toBeNull()
    expect(localStorage.getItem(BOOT_KEY)).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep')
    vi.unstubAllGlobals()
    err.mockRestore()
  })
})
