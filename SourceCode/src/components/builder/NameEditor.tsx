import { useState, type FormEvent } from 'react'
import { checkName } from '../../model/edits'
import { Button } from '../ui/Button'
import { TrashIcon } from '../ui/Icons'

interface NameEditorProps {
  kind: 'state' | 'symbol'
  name: string
  /** Names already taken by other items of the same kind. */
  taken: readonly string[]
  onRename: (to: string) => void
  onDelete: () => void
  deleteNote?: string
}

/** Popover body for renaming or deleting a state or symbol. */
export function NameEditor({ kind, name, taken, onRename, onDelete, deleteNote }: NameEditorProps) {
  const [value, setValue] = useState(name)
  const [touched, setTouched] = useState(false)
  const trimmed = value.trim()
  const error = trimmed === name ? null : checkName(trimmed, taken, kind)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (error) return
    onRename(trimmed)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-slate-500">Rename {kind}</span>
        <div className="flex gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setTouched(true)
            }}
            onFocus={(e) => e.target.select()}
            aria-invalid={touched && !!error}
            spellCheck={false}
            autoComplete="off"
            className={`h-9 min-w-0 flex-1 rounded-lg border bg-white px-2.5 text-sm outline-none focus:ring-2 ${
              touched && error ? 'border-red-400 focus:ring-red-200' : 'border-slate-300 focus:border-accent-500 focus:ring-accent-100'
            }`}
          />
          <Button type="submit" variant="primary" disabled={!!error || trimmed === name}>
            Save
          </Button>
        </div>
        {touched && error && <span className="text-xs text-red-600">{error}</span>}
      </label>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">{deleteNote}</span>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <TrashIcon size={14} /> Delete
        </Button>
      </div>
    </form>
  )
}
