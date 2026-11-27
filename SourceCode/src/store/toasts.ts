import { create } from 'zustand'

/** A short notification shown at the bottom of the right sidebar. */
export interface Toast {
  id: number
  message: string
  tone: 'info' | 'success' | 'error'
  action?: { label: string; run: () => void }
  leaving?: boolean
}

interface ToastState {
  toasts: Toast[]
  show: (toast: Omit<Toast, 'id' | 'leaving'>) => void
  dismiss: (id: number) => void
  /** Stops a toast's timer while the pointer is over it. */
  hold: (id: number) => void
  /** Restarts a held toast's timer. */
  release: (id: number) => void
}

let nextId = 1
const EXIT_MS = 160
/**
 * How long each kind of toast stays, in ms, unless the pointer is resting on
 * it: confirmations go quickly, errors stay long enough to read.
 */
export const TOAST_MS: Readonly<Record<Toast['tone'], number>> = { success: 2500, info: 3000, error: 6000 }
const timers = new Map<number, number>()

/** Toast store. At most one toast is visible: a new toast replaces the current one. */
export const useToasts = create<ToastState>((set, get) => {
  const arm = (id: number) => {
    window.clearTimeout(timers.get(id))
    const tone = get().toasts.find((t) => t.id === id)?.tone ?? 'info'
    timers.set(
      id,
      window.setTimeout(() => get().dismiss(id), TOAST_MS[tone]),
    )
  }
  return {
    toasts: [],
    show: (toast) => {
      const id = nextId++
      for (const t of get().toasts) {
        window.clearTimeout(timers.get(t.id))
        timers.delete(t.id)
      }
      set({ toasts: [{ ...toast, id }] })
      arm(id)
    },
    dismiss: (id) => {
      window.clearTimeout(timers.get(id))
      timers.delete(id)
      if (!get().toasts.some((t) => t.id === id && !t.leaving)) return
      set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }))
      window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), EXIT_MS)
    },
    hold: (id) => window.clearTimeout(timers.get(id)),
    release: (id) => {
      if (get().toasts.some((t) => t.id === id && !t.leaving)) arm(id)
    },
  }
})

/** Shows a toast from outside React. */
export const toast = (t: Omit<Toast, 'id' | 'leaving'>) => useToasts.getState().show(t)
