import { create } from 'zustand'

/** A short notification shown at the bottom of the window. */
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
}

let nextId = 1
const EXIT_MS = 160

/** Toast queue. At most three are visible; each closes itself after a few seconds. */
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  show: (toast) => {
    const id = nextId++
    // A repeat of a visible message replaces it instead of stacking.
    set((s) => ({
      toasts: [...s.toasts.filter((t) => !t.leaving && t.message !== toast.message).slice(-2), { ...toast, id }],
    }))
    const ms = toast.tone === 'error' ? 7000 : toast.action ? 6000 : 3500
    window.setTimeout(() => get().dismiss(id), ms)
  },
  dismiss: (id) => {
    if (!get().toasts.some((t) => t.id === id && !t.leaving)) return
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }))
    window.setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), EXIT_MS)
  },
}))

/** Shows a toast from outside React. */
export const toast = (t: Omit<Toast, 'id' | 'leaving'>) => useToasts.getState().show(t)
