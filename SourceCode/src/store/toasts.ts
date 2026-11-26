import { create } from 'zustand'

/** A short notification shown at the top of the canvas. */
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
/** Every toast closes itself after this long, unless the pointer is resting on it. */
export const TOAST_MS = 3000
const timers = new Map<number, number>()

/** Toast queue. At most three are visible and a repeated message replaces the old one. */
export const useToasts = create<ToastState>((set, get) => {
  const arm = (id: number) => {
    window.clearTimeout(timers.get(id))
    timers.set(
      id,
      window.setTimeout(() => get().dismiss(id), TOAST_MS),
    )
  }
  return {
    toasts: [],
    show: (toast) => {
      const id = nextId++
      const replaced = get().toasts.filter((t) => t.message === toast.message)
      replaced.forEach((t) => window.clearTimeout(timers.get(t.id)))
      set((s) => ({
        toasts: [...s.toasts.filter((t) => !t.leaving && t.message !== toast.message).slice(-2), { ...toast, id }],
      }))
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
