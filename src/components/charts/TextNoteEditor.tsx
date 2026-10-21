import { useEffect, useRef, useState } from 'react'

type TextNoteEditorProps = {
  /** Anchor of the note in chart coordinates; the text starts here. */
  x: number
  y: number
  initialText: string
  /** Called once with the final text: Enter, or leaving the field. Empty text is passed through. */
  onCommit: (text: string) => void
  onCancel: () => void
}

/**
 * Inline editor for a text note. Enter commits, Shift+Enter breaks a line, Escape cancels, and
 * leaving the field commits. Typing never reaches the chart's keyboard shortcuts.
 */
export function TextNoteEditor({ x, y, initialText, onCommit, onCancel }: TextNoteEditorProps) {
  const [text, setText] = useState(initialText)
  const settled = useRef(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const area = areaRef.current
    if (!area) return
    area.focus()
    area.setSelectionRange(area.value.length, area.value.length)
  }, [])

  const finish = (commit: boolean) => {
    if (settled.current) return
    settled.current = true
    if (commit) onCommit(text)
    else onCancel()
  }

  return (
    <textarea
      ref={areaRef}
      aria-label="Note text"
      data-testid="text-note-editor"
      value={text}
      rows={Math.max(1, text.split('\n').length)}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={(event) => {
        event.stopPropagation()
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          finish(true)
        } else if (event.key === 'Escape') {
          event.preventDefault()
          finish(false)
        }
      }}
      onBlur={() => finish(true)}
      onMouseDown={(event) => event.stopPropagation()}
      className="bg-carbon-950/90 border-brass-500/50 text-silver-100 absolute z-20 min-w-[120px] resize-none rounded border px-1.5 py-0.5 font-mono text-[11px] outline-none"
      style={{ left: x, top: y - 13 }}
    />
  )
}
