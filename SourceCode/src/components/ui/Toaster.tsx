import { useToasts } from '../../store/toasts'
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from './Icons'

/**
 * Renders the toast over the bottom of the right sidebar, never over the
 * canvas, so a toast can not hide a state or an edge of any graph, nor the
 * player and input at the top of the sidebar. It must sit inside the
 * sidebar's positioned wrapper.
 */
export function Toaster() {
  const { toasts, dismiss, hold, release } = useToasts()
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 bottom-3 z-50 flex flex-col-reverse items-stretch gap-2 px-3"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          data-leaving={t.leaving ? 'true' : 'false'}
          role={t.tone === 'error' ? 'alert' : 'status'}
          onMouseEnter={() => hold(t.id)}
          onMouseLeave={() => release(t.id)}
          className="toast pointer-events-auto flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white py-2 pr-1.5 pl-3 text-[13px] text-slate-900 shadow-[0_4px_12px_rgb(15_23_42/0.08)]"
        >
          {t.tone === 'error' ? (
            <AlertIcon className="shrink-0 text-red-600" />
          ) : t.tone === 'success' ? (
            <CheckIcon className="shrink-0 text-emerald-600" />
          ) : (
            <InfoIcon className="shrink-0 text-slate-400" />
          )}
          <span className="min-w-0 flex-1 break-words">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="press shrink-0 rounded-md px-2 py-1 font-semibold text-blue-600 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-500"
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
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-500"
            onClick={() => dismiss(t.id)}
          >
            <CloseIcon size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
