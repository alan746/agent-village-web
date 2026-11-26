import type { CSSProperties } from 'react'
import { formatDateTime, formatNumber, formatSpan } from '../format'
import { accentVar } from '../state/village'
import type { Highlight, Limits, Manifest, Session } from '../types'

interface RunTabProps {
  manifest: Manifest
  activeHighlight: number | null
  onHighlight: (highlight: Highlight) => void
}

function maybe(value: number | null | undefined, suffix = ''): string {
  return value === null || value === undefined ? 'not recorded' : `${formatNumber(value)}${suffix}`
}

function LimitsList({ limits, network }: { limits: Limits; network: boolean | null }) {
  return (
    <dl className="facts">
      <dt>Rounds in session</dt>
      <dd>{maybe(limits.rounds)}</dd>
      <dt>Max tool rounds</dt>
      <dd>{maybe(limits.maxToolRounds)}</dd>
      <dt>Input budget</dt>
      <dd>{maybe(limits.inputBudget)}</dd>
      <dt>Output budget</dt>
      <dd>{maybe(limits.outputBudget)}</dd>
      <dt>Compact trigger</dt>
      <dd>{maybe(limits.compactTrigger)}</dd>
      <dt>Command timeout</dt>
      <dd>{maybe(limits.commandTimeout, ' s')}</dd>
      <dt>Network</dt>
      <dd>{network === null ? 'not recorded' : network ? 'on' : 'off'}</dd>
    </dl>
  )
}

function SessionBlock({ session, index }: { session: Session; index: number }) {
  return (
    <div className="session">
      <h4>
        Session {index + 1}: {session.mode === 'start' ? 'started' : session.mode === 'resume' ? 'resumed' : session.mode}{' '}
        at round {session.round ?? '?'}
      </h4>
      <p className="muted">
        {formatDateTime(session.ts)} · {session.attempted} turns attempted, {session.ok} succeeded, {session.failed} failed ·
        stopped because: {session.stopText}
      </p>
      <LimitsList limits={session.limits} network={session.network} />
    </div>
  )
}

export function RunTab({ manifest, activeHighlight, onHighlight }: RunTabProps) {
  const { totals } = manifest
  const span = manifest.startTs !== null && manifest.endTs !== null ? formatSpan(manifest.endTs - manifest.startTs) : ''
  return (
    <div className="tab-scroll run-tab">
      {manifest.highlights.length > 0 && (
        <section>
          <h3>Highlights</h3>
          <ol className="highlight-list">
            {manifest.highlights.map((highlight) => (
              <li key={`${highlight.round}-${highlight.turn}`}>
                <button
                  type="button"
                  className={`highlight-card${activeHighlight === highlight.turnIndex ? ' is-active' : ''}`}
                  style={{ '--accent': accentVar(manifest.villagers, highlight.actor) } as CSSProperties}
                  onClick={() => onHighlight(highlight)}
                >
                  <span className="highlight-where">
                    Round {highlight.round} · turn {highlight.turn} · {highlight.actor}
                  </span>
                  <span className="highlight-title">{highlight.title}</span>
                  {highlight.note && <span className="highlight-note">{highlight.note}</span>}
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section>
        <h3>Run</h3>
        <dl className="facts">
          <dt>Started</dt>
          <dd>{formatDateTime(manifest.startTs)}</dd>
          <dt>Ended</dt>
          <dd>
            {formatDateTime(manifest.endTs)}
            {span && <span className="muted"> · {span}</span>}
          </dd>
          <dt>Rounds</dt>
          <dd>{formatNumber(totals.rounds)}</dd>
          <dt>Turns</dt>
          <dd>
            {formatNumber(totals.turns)} · {formatNumber(totals.okTurns)} succeeded · {formatNumber(totals.failedTurns)} failed
            {totals.unfinishedTurns > 0 && ` · ${formatNumber(totals.unfinishedTurns)} with no recorded end`}
          </dd>
          <dt>Commands</dt>
          <dd>
            {formatNumber(totals.commands)} · {formatNumber(totals.failedCommands)} failed
          </dd>
          <dt>Model calls</dt>
          <dd>{formatNumber(totals.usage.calls)}</dd>
        </dl>
        {!manifest.marked && (
          <p className="muted">
            This run was recorded before turn markers existed, so rounds are inferred from the order of turns.
          </p>
        )}
      </section>
      <section>
        <h3>Villagers, whole run</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Villager</th>
                <th scope="col">Model</th>
                <th scope="col" className="num">Turns</th>
                <th scope="col" className="num">Calls</th>
                <th scope="col" className="num">Input</th>
                <th scope="col" className="num">Output</th>
                <th scope="col" className="num">Cmds</th>
                <th scope="col" className="num">Failed</th>
                <th scope="col" className="num">Chat</th>
              </tr>
            </thead>
            <tbody>
              {manifest.villagers.map((villager) => {
                const row = totals.perVillager.find((entry) => entry.name === villager.name)
                return (
                  <tr key={villager.name} style={{ '--accent': accentVar(manifest.villagers, villager.name) } as CSSProperties}>
                    <th scope="row">
                      <span className="who">
                        <span className="panel-swatch" aria-hidden="true" />
                        {villager.name}
                      </span>
                      {villager.role && <span className="role-tag">{villager.role}</span>}
                    </th>
                    <td className="mono-cell">{villager.model}</td>
                    <td className="num">{formatNumber(row?.turns ?? 0)}</td>
                    <td className="num">{formatNumber(row?.usage.calls ?? 0)}</td>
                    <td className="num">{formatNumber(row?.usage.input ?? 0)}</td>
                    <td className="num">{formatNumber(row?.usage.output ?? 0)}</td>
                    <td className="num">{formatNumber(row?.commands ?? 0)}</td>
                    <td className="num">{formatNumber(row?.failedCommands ?? 0)}</td>
                    <td className="num">{formatNumber(row?.chatMessages ?? 0)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="muted small">
          Input counts every prompt token, cached or not: {formatNumber(totals.usage.cacheRead)} cache read and{' '}
          {formatNumber(totals.usage.cacheWrite)} cache write in total.
        </p>
      </section>
      <section>
        <h3>Sessions and limits</h3>
        {manifest.sessions.length === 0 ? (
          <p className="muted">No configuration was recorded for this run.</p>
        ) : (
          manifest.sessions.map((session, index) => <SessionBlock key={session.eventId} session={session} index={index} />)
        )}
      </section>
      <section>
        <h3>Goal</h3>
        <p className="goal-full">{manifest.goal || 'No goal recorded.'}</p>
      </section>
    </div>
  )
}
