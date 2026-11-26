import { memo, useRef, type CSSProperties } from 'react'
import { useStickToBottom } from '../hooks/useStickToBottom'
import { formatClock, formatCompact, formatNumber, plural } from '../format'
import type { RoundState } from '../hooks/useRounds'
import type { VillagerStatus } from '../state/village'
import type { StepRecord, Tally, TurnSummary, Villager } from '../types'
import { FeedItem } from './Feed'
import { CheckIcon, CollapseIcon, ExpandIcon } from './Icons'

export interface PanelData {
  villager: Villager
  accent: string
  status: VillagerStatus
  tally: Tally
  turn: TurnSummary | undefined
  roundTurns: number
  records: StepRecord[] | undefined
  roundState: RoundState | undefined
  currentStep: number | null
}

interface VillagerPanelProps extends PanelData {
  expanded: boolean
  hiddenOnPhone: boolean
  onToggleExpand: (name: string) => void
  onRetry: (round: number) => void
}

const STATUS_LABELS: Record<VillagerStatus, string> = {
  acting: 'acting now',
  done: 'finished this round',
  waiting: 'waiting',
}

function StatusPill({ status }: { status: VillagerStatus }) {
  return (
    <span className={`status-pill is-${status}`}>
      {status === 'acting' && <span className="status-dot" aria-hidden="true" />}
      {status === 'done' && <CheckIcon size={12} />}
      {STATUS_LABELS[status]}
    </span>
  )
}

function Tokens({ tally }: { tally: Tally }) {
  const { input, output, calls } = tally.usage
  return (
    <span
      className="panel-tokens"
      title={`${formatNumber(input)} input and ${formatNumber(output)} output tokens in ${formatNumber(calls)} model calls up to the playhead`}
    >
      {formatCompact(input)} in · {formatCompact(output)} out
    </span>
  )
}

function TurnLine({ turn, roundTurns, status, tally }: {
  turn: TurnSummary | undefined
  roundTurns: number
  status: VillagerStatus
  tally: Tally
}) {
  if (!turn) {
    return (
      <div className="panel-sub">
        <span>No turn yet</span>
        <Tokens tally={tally} />
      </div>
    )
  }
  return (
    <div className="panel-sub">
      <span>
        {status === 'acting' ? 'Now' : 'Last turn'}: round {turn.round} · turn {turn.position}/{roundTurns}
      </span>
      <span>{formatClock(turn.startTs)} UTC</span>
      <span>{plural(turn.commands, 'command')}</span>
      {turn.failedCommands > 0 && <span className="is-failed-text">{turn.failedCommands} failed</span>}
      {turn.status === 'error' && <span className="is-failed-text">turn failed</span>}
      <Tokens tally={tally} />
    </div>
  )
}

function PanelBody({ records, roundState, currentStep, turn, onRetry }: Pick<
  VillagerPanelProps,
  'records' | 'roundState' | 'currentStep' | 'turn' | 'onRetry'
>) {
  if (!turn) return <p className="panel-empty">No turn yet.</p>
  if (roundState?.status === 'error') {
    return (
      <div className="panel-empty is-error">
        <p>Round {turn.round} could not be loaded: {roundState.message}</p>
        <button type="button" className="text-button" onClick={() => onRetry(turn.round)}>
          Try again
        </button>
      </div>
    )
  }
  if (!records) return <p className="panel-empty">Loading round {turn.round}…</p>
  return (
    <ol className="feed">
      {records.map((record) => (
        <FeedItem key={record.step} record={record} current={record.step === currentStep} />
      ))}
    </ol>
  )
}

export const VillagerPanel = memo(function VillagerPanel(props: VillagerPanelProps) {
  const { villager, accent, status, tally, turn, roundTurns, records, expanded, hiddenOnPhone } = props
  const feedRef = useRef<HTMLDivElement>(null)
  const onScroll = useStickToBottom(feedRef, `${records?.length ?? -1}`, `${turn?.index ?? -1}:${expanded}`)
  const classes = ['panel', `is-${status}`, expanded ? 'is-expanded' : '', hiddenOnPhone ? 'is-phone-hidden' : '']
  return (
    <section
      className={classes.filter(Boolean).join(' ')}
      style={{ '--accent': accent } as CSSProperties}
      aria-label={`${villager.name}, ${STATUS_LABELS[status]}`}
    >
      <header className="panel-head">
        <span className="panel-swatch" aria-hidden="true" />
        <h2 className="panel-name">{villager.name}</h2>
        {villager.role && <span className="role-tag">{villager.role}</span>}
        <span className="panel-model" title={villager.model}>
          {villager.model}
        </span>
        <span className="panel-spacer" />
        <StatusPill status={status} />
        <button
          type="button"
          className="icon-button"
          aria-label={expanded ? `Restore ${villager.name}'s panel` : `Expand ${villager.name}'s panel`}
          title={expanded ? 'Restore (Esc)' : 'Expand'}
          onClick={() => props.onToggleExpand(villager.name)}
        >
          {expanded ? <CollapseIcon /> : <ExpandIcon />}
        </button>
      </header>
      <TurnLine turn={turn} roundTurns={roundTurns} status={status} tally={tally} />
      <div className="panel-feed" ref={feedRef} onScroll={onScroll}>
        <PanelBody
          records={records}
          roundState={props.roundState}
          currentStep={props.currentStep}
          turn={turn}
          onRetry={props.onRetry}
        />
      </div>
    </section>
  )
})
