/**
 * Crash recovery helpers: a "booting" flag that survives a crash, and a reset
 * that clears everything the app keeps in localStorage.
 *
 * The flag is written before the first render and cleared once the app has
 * rendered and stayed up briefly. If the page crashes or freezes before
 * that, the flag is still set on the next load, so the app knows not to
 * restore the tab that crashed.
 */

/** Prefix shared by every localStorage key the app writes. */
export const STORAGE_PREFIX = 'enfa-sim.'
/** Key of the booting flag. */
export const BOOT_KEY = `${STORAGE_PREFIX}booting.v1`

/** The subset of the Storage API these helpers use. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

/** Set once the error boundary has caught a crash; the flag then stays set. */
let crashed = false

function browserStorage(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

/**
 * Starts a boot: reports whether the previous session ended without
 * finishing its boot (a crash or a frozen tab), then sets the flag for this
 * one.
 *
 * @param storage - Where the flag lives (default: `localStorage`; `null` when unavailable).
 * @returns `true` if the flag was already set, i.e. the last session crashed.
 * @throws Never throws; storage errors count as "no crash".
 */
export function beginBoot(storage: KeyValueStore | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    const crashed = storage.getItem(BOOT_KEY) !== null
    storage.setItem(BOOT_KEY, String(Date.now()))
    return crashed
  } catch {
    return false
  }
}

/**
 * Marks the boot as finished by clearing the flag. Does nothing after
 * {@link markCrashed}, so a crash is still remembered on the next load.
 *
 * @param storage - See {@link beginBoot}.
 * @returns Nothing.
 * @throws Never throws.
 */
export function finishBoot(storage: KeyValueStore | null = browserStorage()): void {
  if (crashed) return
  try {
    storage?.removeItem(BOOT_KEY)
  } catch {
    // Storage blocked: nothing to clear.
  }
}

/**
 * Sets the flag again, e.g. when the error boundary catches a crash, so the
 * next load also starts on a safe tab.
 *
 * @param storage - See {@link beginBoot}.
 * @returns Nothing.
 * @throws Never throws.
 */
export function markCrashed(storage: KeyValueStore | null = browserStorage()): void {
  crashed = true
  try {
    storage?.setItem(BOOT_KEY, 'crashed')
  } catch {
    // Storage blocked: the next load simply restores normally.
  }
}

/**
 * Sets the flag now and clears it after `ms` of the page staying responsive.
 * Used before heavy work such as opening Convert: if the tab freezes or
 * crashes, the timer never runs and the next load starts on Define.
 *
 * @param ms - How long the page must stay up, in ms.
 * @param storage - See {@link beginBoot}.
 * @returns Nothing.
 * @throws Never throws.
 */
export function guardFor(ms: number, storage: KeyValueStore | null = browserStorage()): void {
  try {
    storage?.setItem(BOOT_KEY, String(Date.now()))
  } catch {
    return
  }
  if (typeof window !== 'undefined') window.setTimeout(() => finishBoot(storage), ms)
}

/**
 * Removes every key starting with {@link STORAGE_PREFIX} (saved machine,
 * tab, preset and the booting flag), leaving other sites' keys alone.
 *
 * @param storage - See {@link beginBoot}.
 * @returns The keys removed.
 * @throws Never throws.
 */
export function clearAppStorage(storage: KeyValueStore | null = browserStorage()): string[] {
  if (!storage) return []
  try {
    const keys: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i)
      if (k !== null && k.startsWith(STORAGE_PREFIX)) keys.push(k)
    }
    for (const k of keys) storage.removeItem(k)
    return keys
  } catch {
    return []
  }
}

/**
 * Builds the text copied by "Copy error details".
 *
 * @param error - The caught error.
 * @param componentStack - React's component stack for it.
 * @returns Message, stacks, page, browser and time, one per line.
 * @throws Never throws.
 */
export function errorDetails(error: Error, componentStack: string): string {
  return [
    `${error.name}: ${error.message}`,
    '',
    error.stack ?? '(no stack)',
    '',
    'Component stack:',
    componentStack.trim() || '(none)',
    '',
    `Page: ${typeof location !== 'undefined' ? location.href : ''}`,
    `Browser: ${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`,
    `Time: ${new Date().toISOString()}`,
  ].join('\n')
}

/**
 * Whether this page load follows a crashed session. Computed once, when
 * this module is first imported (before the store restores the saved tab).
 */
export const crashedLastSession: boolean = beginBoot()
