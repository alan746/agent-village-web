import { useMemo, useState } from 'react'
import { clipText } from '../state/clip'
import { formatNumber } from '../format'

interface ClippedTextProps {
  text: string
  maxLines: number
  maxChars: number
  className?: string
  mono?: boolean
}

export function ClippedText({ text, maxLines, maxChars, className, mono }: ClippedTextProps) {
  const [expanded, setExpanded] = useState(false)
  const clipped = useMemo(() => clipText(text, maxLines, maxChars), [text, maxLines, maxChars])
  const Tag = mono ? 'pre' : 'div'
  return (
    <>
      <Tag className={className}>{expanded ? text : clipped.text}</Tag>
      {clipped.clipped && (
        <ExpandButton expanded={expanded} hiddenLines={clipped.hiddenLines} onToggle={() => setExpanded(!expanded)} />
      )}
    </>
  )
}

interface ExpandButtonProps {
  expanded: boolean
  hiddenLines: number
  onToggle: () => void
}

export function ExpandButton({ expanded, hiddenLines, onToggle }: ExpandButtonProps) {
  const label = expanded
    ? 'Show less'
    : hiddenLines > 0
      ? `Show ${formatNumber(hiddenLines)} more ${hiddenLines === 1 ? 'line' : 'lines'}`
      : 'Show all'
  return (
    <button
      type="button"
      className="expand-button"
      aria-expanded={expanded}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      {label}
    </button>
  )
}
