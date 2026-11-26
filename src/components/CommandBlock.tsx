import { memo, useMemo, useState } from 'react'
import { clipText, countLines, shareLines } from '../state/clip'
import { formatDuration } from '../format'
import type { CommandRecord } from '../types'
import { ClippedText, ExpandButton } from './ClippedText'

const OUTPUT_LINES = 12
const STDERR_LINES = 4
const FAILED_STDERR_LINES = 8
const OUTPUT_CHARS = 2400
const COMMAND_LINES = 6
const COMMAND_CHARS = 800

function exitLabel(record: CommandRecord): string {
  if (record.timedOut) return 'timed out'
  if (record.exitCode === null) return 'no exit code'
  return `exit ${record.exitCode}`
}

function Output({ record }: { record: CommandRecord }) {
  const [expanded, setExpanded] = useState(false)
  const clipped = useMemo(() => {
    const wanted = record.failed ? FAILED_STDERR_LINES : STDERR_LINES
    const [outLines, errLines] = shareLines(countLines(record.stdout), countLines(record.stderr), OUTPUT_LINES, wanted)
    return {
      stdout: clipText(record.stdout, Math.max(outLines, 1), OUTPUT_CHARS),
      stderr: clipText(record.stderr, Math.max(errLines, 1), OUTPUT_CHARS),
    }
  }, [record])
  const stdout = expanded ? record.stdout : clipped.stdout.text
  const stderr = expanded ? record.stderr : clipped.stderr.text
  if (record.stdout.trim() === '' && record.stderr.trim() === '') return <div className="term-empty">no output</div>
  const separator = stdout !== '' && stderr !== '' && !stdout.endsWith('\n') ? '\n' : ''
  const isClipped = clipped.stdout.clipped || clipped.stderr.clipped
  return (
    <>
      <pre className="term-output">
        {stdout && <span className="term-stdout">{stdout}</span>}
        {separator}
        {stderr && <span className="term-stderr">{stderr}</span>}
      </pre>
      {isClipped && (
        <ExpandButton
          expanded={expanded}
          hiddenLines={clipped.stdout.hiddenLines + clipped.stderr.hiddenLines}
          onToggle={() => setExpanded(!expanded)}
        />
      )}
    </>
  )
}

export const CommandBlock = memo(function CommandBlock({ record }: { record: CommandRecord }) {
  return (
    <div className={`term${record.failed ? ' is-failed' : ''}`}>
      <div className="term-command">
        <span className="term-prompt" aria-hidden="true">
          $
        </span>
        <ClippedText text={record.command} maxLines={COMMAND_LINES} maxChars={COMMAND_CHARS} mono className="term-text" />
      </div>
      <Output record={record} />
      <div className="term-meta">
        <span className={`exit-chip${record.failed ? ' is-failed' : ''}`}>{exitLabel(record)}</span>
        {record.duration !== null && <span>{formatDuration(record.duration)}</span>}
      </div>
    </div>
  )
})
