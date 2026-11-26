import { beforeEach, describe, expect, it } from 'vitest'
import { addState } from '../src/model/edits'
import { useApp } from '../src/store/automaton'

const states = () => useApp.getState().nfa.states.length

describe('app store undo and redo', () => {
  beforeEach(() => {
    useApp.getState().loadPreset('thompson-abb')
    useApp.setState({ history: [], future: [] })
  })

  it('redo re-applies an undone edit', () => {
    const before = states()
    useApp.getState().commit(addState(useApp.getState().nfa).nfa, 'table')
    expect(states()).toBe(before + 1)
    expect(useApp.getState().undo()).toBe(true)
    expect(states()).toBe(before)
    expect(useApp.getState().redo()).toBe(true)
    expect(states()).toBe(before + 1)
    expect(useApp.getState().redo()).toBe(false)
  })

  it('a new edit clears the redo stack', () => {
    useApp.getState().commit(addState(useApp.getState().nfa).nfa, 'table')
    useApp.getState().undo()
    expect(useApp.getState().future).toHaveLength(1)
    useApp.getState().commit(addState(useApp.getState().nfa).nfa, 'graph')
    expect(useApp.getState().future).toHaveLength(0)
    expect(useApp.getState().redo()).toBe(false)
  })

  it('undo with no history does nothing', () => {
    expect(useApp.getState().undo()).toBe(false)
  })

  it('requestFocus opens the text section only for text targets', () => {
    useApp.getState().setEditorView('table')
    useApp.getState().requestFocus({ kind: 'cell', row: 0, symbol: 'a' })
    expect(useApp.getState().editorView).toBe('table')
    useApp.getState().requestFocus({ kind: 'text', line: 2 })
    expect(useApp.getState().editorView).toBe('text')
    useApp.getState().requestFocus({ kind: 'start' })
    expect(useApp.getState().editorView).toBe('text')
  })
})
