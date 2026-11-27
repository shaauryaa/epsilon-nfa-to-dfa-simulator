import { describe, expect, it } from 'vitest'
import { beginBoot, BOOT_KEY, clearAppStorage, finishBoot, type KeyValueStore } from '../src/lib/boot'

function fakeStorage(init: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(init))
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size
    },
  }
}

describe('boot guard', () => {
  it('a clean boot is not a crash; the flag is set until the boot finishes', () => {
    const st = fakeStorage()
    expect(beginBoot(st)).toBe(false)
    expect(st.data.has(BOOT_KEY)).toBe(true)
    finishBoot(st)
    expect(st.data.has(BOOT_KEY)).toBe(false)
    expect(beginBoot(st)).toBe(false)
  })

  it('a flag left over from the last session means it crashed', () => {
    const st = fakeStorage({ [BOOT_KEY]: '123' })
    expect(beginBoot(st)).toBe(true)
  })

  it('survives missing or throwing storage', () => {
    expect(beginBoot(null)).toBe(false)
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
      removeItem: () => {
        throw new Error('blocked')
      },
      key: () => null,
      length: 0,
    } satisfies KeyValueStore
    expect(beginBoot(broken)).toBe(false)
    expect(() => finishBoot(broken)).not.toThrow()
    expect(clearAppStorage(broken)).toEqual([])
  })

  it('reset clears only the app keys', () => {
    const st = fakeStorage({ 'enfa-sim.nfa.v1': '{}', 'enfa-sim.tab.v1': 'convert', [BOOT_KEY]: '1', 'other-site': 'keep' })
    expect(clearAppStorage(st).sort()).toEqual(['enfa-sim.booting.v1', 'enfa-sim.nfa.v1', 'enfa-sim.tab.v1'])
    expect([...st.data.keys()]).toEqual(['other-site'])
  })
})
