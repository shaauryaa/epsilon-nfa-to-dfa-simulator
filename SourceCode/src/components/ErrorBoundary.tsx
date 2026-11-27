import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearAppStorage, errorDetails, markCrashed } from '../lib/boot'

interface State {
  error: Error | null
  stack: string
  copied: boolean
}

/**
 * Top-level error boundary. Instead of a blank page it shows a short card
 * with "Reset to example" (clears every `enfa-sim.*` key and reloads) and
 * "Copy error details". It also marks the session as crashed, so a plain
 * reload opens Define rather than the tab that crashed.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, stack: '', copied: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    markCrashed()
    this.setState({ stack: info.componentStack ?? '' })
    console.error(error)
  }

  private reset = () => {
    clearAppStorage()
    location.reload()
  }

  private copy = async () => {
    if (!this.state.error) return
    try {
      await navigator.clipboard.writeText(errorDetails(this.state.error, this.state.stack))
      this.setState({ copied: true })
    } catch {
      this.setState({ copied: false })
    }
  }

  render() {
    const { error, copied } = this.state
    if (!error) return this.props.children
    return (
      <div className="grid h-full place-items-center bg-slate-50 p-6 text-slate-900">
        <div role="alert" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_rgb(15_23_42/0.08)]">
          <h1 className="text-base font-semibold">Something went wrong</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-pretty text-slate-600">
            The simulator hit an unexpected error and stopped drawing. Reset to the example machine to carry on, or copy the details to report the
            problem.
          </p>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs break-words text-slate-700">{error.message || error.name}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={this.reset}
              className="press rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              Reset to example
            </button>
            <button
              type="button"
              onClick={() => void this.copy()}
              className="press rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              {copied ? 'Copied' : 'Copy error details'}
            </button>
          </div>
          <p className="mt-3 text-[11px] text-slate-500">Reset clears the saved machine and settings in this browser, then reloads.</p>
        </div>
      </div>
    )
  }
}
