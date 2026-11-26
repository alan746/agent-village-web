import { memo, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { formatClock, plural } from '../format'
import { roundTicks, stepAtFraction, stepFraction, turnAtFraction, turnMarks, type TurnMark } from '../state/track'
import { accentVar } from '../state/village'
import type { Manifest } from '../types'

interface TimelineProps {
  manifest: Manifest
  step: number
  label: string
  onSeek: (step: number) => void
}

interface Hover {
  fraction: number
  turnIndex: number
}

const MAX_ROUND_LABELS = 12

function percent(value: number): string {
  return `${(value * 100).toFixed(4)}%`
}

const Segments = memo(function Segments({ manifest, marks }: { manifest: Manifest; marks: TurnMark[] }) {
  const width = 1 / Math.max(1, marks.length)
  return (
    <>
      {marks.map((mark) => (
        <span
          key={mark.index}
          className={`track-turn${mark.failedTurn ? ' is-failed' : ''}${mark.roundStart ? ' is-round-start' : ''}`}
          style={{ left: percent(mark.index * width), width: percent(width), '--accent': accentVar(manifest.villagers, mark.actor) } as CSSProperties}
        />
      ))}
      {marks
        .filter((mark) => mark.failedCommands > 0)
        .map((mark) => (
          <span key={`f${mark.index}`} className="track-fail" style={{ left: percent((mark.index + 0.5) * width) }} />
        ))}
      {marks
        .filter((mark) => mark.sessionStart)
        .map((mark) => (
          <span key={`s${mark.index}`} className="track-session" style={{ left: percent(mark.index * width) }} />
        ))}
      {marks
        .filter((mark) => mark.highlight)
        .map((mark) => (
          <span key={`h${mark.index}`} className="track-highlight" style={{ left: percent((mark.index + 0.5) * width) }} />
        ))}
    </>
  )
})

function Tooltip({ manifest, marks, hover }: { manifest: Manifest; marks: TurnMark[]; hover: Hover }) {
  const turn = manifest.turns[hover.turnIndex]
  const mark = marks[hover.turnIndex]
  if (!turn || !mark) return null
  const roundTurns = manifest.rounds.find((round) => round.round === turn.round)?.turns.length ?? 0
  const edge = hover.fraction < 0.15 ? 'is-left' : hover.fraction > 0.85 ? 'is-right' : ''
  return (
    <div className={`track-tooltip ${edge}`} style={{ left: percent(hover.fraction) }} role="presentation">
      <strong>
        Round {turn.round} · turn {turn.position}/{roundTurns} · {turn.actor}
      </strong>
      <span>
        {formatClock(turn.startTs)} UTC · {plural(turn.stepCount, 'step')} · {plural(turn.commands, 'command')}
        {turn.failedCommands > 0 && `, ${turn.failedCommands} failed`}
      </span>
      {mark.failedTurn && <span className="is-failed-text">The turn failed</span>}
      {mark.sessionStart && <span>The run was resumed here</span>}
      {mark.highlight && <span className="tooltip-highlight">{mark.highlight}</span>}
    </div>
  )
}

export function Timeline({ manifest, step, label, onSeek }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [hover, setHover] = useState<Hover | null>(null)
  const marks = useMemo(() => turnMarks(manifest), [manifest])
  const ticks = useMemo(() => roundTicks(manifest.rounds, manifest.turns.length, MAX_ROUND_LABELS), [manifest])
  const played = stepFraction(manifest, step)

  const fractionAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  }
  const seekTo = (event: PointerEvent<HTMLDivElement>) => onSeek(stepAtFraction(manifest, fractionAt(event)))

  return (
    <div className="timeline">
      <div
        ref={trackRef}
        className="track"
        role="slider"
        tabIndex={0}
        aria-label="Timeline"
        aria-valuemin={1}
        aria-valuemax={manifest.totals.steps}
        aria-valuenow={step + 1}
        aria-valuetext={label}
        onPointerDown={(event) => {
          dragging.current = true
          event.currentTarget.setPointerCapture(event.pointerId)
          seekTo(event)
        }}
        onPointerMove={(event) => {
          const fraction = fractionAt(event)
          setHover({ fraction, turnIndex: turnAtFraction(manifest, fraction) })
          if (dragging.current) seekTo(event)
        }}
        onPointerUp={(event) => {
          dragging.current = false
          event.currentTarget.releasePointerCapture(event.pointerId)
        }}
        onPointerCancel={() => {
          dragging.current = false
        }}
        onPointerLeave={() => setHover(null)}
      >
        <div className="track-lane">
          <Segments manifest={manifest} marks={marks} />
          <span className="track-future" style={{ left: percent(played) }} />
        </div>
        <span className="track-playhead" style={{ left: percent(played) }} />
        {hover && <Tooltip manifest={manifest} marks={marks} hover={hover} />}
      </div>
      <div className="track-ticks" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick.round} style={{ left: percent(tick.fraction) }}>
            {tick.round}
          </span>
        ))}
      </div>
    </div>
  )
}
