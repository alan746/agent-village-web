import { useState } from 'react'
import { formatCompact, formatDate, formatNumber, percent } from '../format'
import type { Theme } from '../hooks/useTheme'
import type { Manifest, RunListEntry, Tally } from '../types'
import { MarkIcon, MoonIcon, SunIcon } from './Icons'

interface TopBarProps {
  manifest: Manifest | null
  runs: RunListEntry[]
  round: number | null
  village: Tally | null
  budget: { input: number | null; output: number | null }
  theme: Theme
  onTheme: () => void
  onRun: (runId: string) => void
}

function Meter({ label, used, budget }: { label: string; used: number; budget: number | null }) {
  const share = percent(used, budget)
  return (
    <div className="meter" title={`${formatNumber(used)} ${label} tokens used${budget ? ` of a ${formatNumber(budget)} budget` : ''}`}>
      <span className="meter-label">{label}</span>
      <span className="meter-value mono">
        {formatCompact(used)}
        {budget ? <span className="muted"> / {formatCompact(budget)}</span> : null}
      </span>
      {budget ? (
        <span className="meter-bar" aria-hidden="true">
          <span style={{ width: `${share}%` }} className={share > 90 ? 'is-high' : ''} />
        </span>
      ) : null}
    </div>
  )
}

function Goal({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <div className={`goal${open ? ' is-open' : ''}`}>
      <span className="goal-label">Goal</span>
      <p className="goal-text">{text}</p>
      <button type="button" className="link-button" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'less' : 'more'}
      </button>
    </div>
  )
}

export function TopBar({ manifest, runs, round, village, budget, theme, onTheme, onRun }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="brand">
          <MarkIcon />
          <span>Village Replay</span>
        </div>
        {manifest && (
          <div className="run-title">
            <h1 title={manifest.title}>{manifest.title}</h1>
            <span className="run-id mono">
              {manifest.id}
              {manifest.startTs !== null && ` · ${formatDate(manifest.startTs)}`}
            </span>
          </div>
        )}
        <span className="topbar-spacer" />
        {runs.length > 1 && (
          <label className="run-picker">
            <span className="visually-hidden">Run</span>
            <select value={manifest?.id ?? ''} onChange={(event) => onRun(event.target.value)}>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.id} · {run.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className="icon-button"
          onClick={onTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
      {manifest && (
        <div className="topbar-row topbar-detail">
          <Goal text={manifest.goal} />
          <div className="stats">
            <div className="stat">
              <span className="meter-label">Round</span>
              <span className="mono">
                {round ?? '–'}
                <span className="muted"> / {manifest.totals.rounds}</span>
              </span>
            </div>
            {village && (
              <>
                <Meter label="input" used={village.usage.input} budget={budget.input} />
                <Meter label="output" used={village.usage.output} budget={budget.output} />
                <div className="stat">
                  <span className="meter-label">Commands</span>
                  <span className="mono">
                    {formatNumber(village.commands)}
                    {village.failedCommands > 0 && (
                      <span className="is-failed-text"> · {formatNumber(village.failedCommands)} failed</span>
                    )}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
