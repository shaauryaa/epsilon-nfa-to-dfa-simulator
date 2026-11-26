import { useToasts } from '../../store/toasts'
import { AlertIcon, CheckIcon, CloseIcon } from './Icons'

/** Renders the toast stack at the bottom centre of the window. */
export function Toaster() {
  const { toasts, dismiss } = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          data-leaving={t.leaving ? 'true' : 'false'}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className="toast pointer-events-auto flex max-w-[min(32rem,100%)] items-center gap-3 rounded-xl bg-slate-900 py-2.5 pr-2 pl-3.5 text-sm text-white shadow-lg shadow-slate-900/20"
        >
          {t.tone === 'error' ? (
            <AlertIcon className="shrink-0 text-red-300" />
          ) : t.tone === 'success' ? (
            <CheckIcon className="shrink-0 text-emerald-300" />
          ) : null}
          <span className="min-w-0">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="press shrink-0 rounded-md px-2 py-1 font-semibold text-accent-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-accent-200"
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-accent-200"
            onClick={() => dismiss(t.id)}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
