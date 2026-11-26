import type { CSSProperties } from 'react'
import { formatNumber } from '../format'
import { SPEEDS } from '../state/timing'
import type { Manifest } from '../types'
import {
  LinkIcon,
  PauseIcon,
  PlayIcon,
  StepBackIcon,
  StepForwardIcon,
  TurnBackIcon,
  TurnForwardIcon,
} from './Icons'
import { Timeline } from './Timeline'

export interface TransportPosition {
  round: number
  position: number
  roundTurns: number
  actor: string
  accent: string
  clock: string
}

interface TransportProps {
  manifest: Manifest
  step: number
  playing: boolean
  speed: number
  where: TransportPosition | null
  copied: boolean
  onPlay: () => void
  onStep: (delta: number) => void
  onTurn: (delta: number) => void
  onSpeed: (speed: number) => void
  onSeek: (step: number) => void
  onCopyLink: () => void
}

function where(position: TransportPosition | null): string {
  if (!position) return 'No turns'
  return `Round ${position.round}, turn ${position.position} of ${position.roundTurns}, ${position.actor}, ${position.clock} UTC`
}

export function Transport(props: TransportProps) {
  const { manifest, step, playing, speed, where: position } = props
  const last = Math.max(0, manifest.totals.steps - 1)
  return (
    <footer className="transport">
      <div className="transport-row">
        <div className="transport-buttons" role="group" aria-label="Playback">
          <button type="button" className="icon-button" onClick={() => props.onTurn(-1)} aria-label="Previous turn" title="Previous turn (Shift+Left)">
            <TurnBackIcon />
          </button>
          <button type="button" className="icon-button" onClick={() => props.onStep(-1)} disabled={step <= 0} aria-label="Previous step" title="Previous step (Left)">
            <StepBackIcon />
          </button>
          <button
            type="button"
            className="play-button"
            onClick={props.onPlay}
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
          >
            {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
          </button>
          <button type="button" className="icon-button" onClick={() => props.onStep(1)} disabled={step >= last} aria-label="Next step" title="Next step (Right)">
            <StepForwardIcon />
          </button>
          <button type="button" className="icon-button" onClick={() => props.onTurn(1)} aria-label="Next turn" title="Next turn (Shift+Right)">
            <TurnForwardIcon />
          </button>
        </div>
        <div className="transport-where" aria-live="off" title={where(position)}>
          {position ? (
            <>
              <strong>Round {position.round}</strong>
              <span className="sep">·</span>
              <span>
                turn {position.position}/{position.roundTurns}
              </span>
              <span className="sep">·</span>
              <span className="who" style={{ '--accent': position.accent } as CSSProperties}>
                <span className="panel-swatch" aria-hidden="true" />
                {position.actor}
              </span>
              <span className="sep">·</span>
              <span className="mono">{position.clock} UTC</span>
            </>
          ) : (
            'No turns in this run'
          )}
        </div>
        <span className="transport-spacer" />
        <span className="transport-count mono" title="Visible steps">
          step {formatNumber(step + 1)} / {formatNumber(manifest.totals.steps)}
        </span>
        <div className="speed" role="radiogroup" aria-label="Playback speed">
          {SPEEDS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={speed === value}
              className="speed-button"
              onClick={() => props.onSpeed(value)}
            >
              {value}×
            </button>
          ))}
        </div>
        <button type="button" className="icon-button" onClick={props.onCopyLink} aria-label="Copy a link to this turn" title="Copy a link to this point">
          <LinkIcon />
        </button>
        <span className="copied" role="status">
          {props.copied ? 'Link copied' : ''}
        </span>
      </div>
      <Timeline manifest={manifest} step={step} label={where(position)} onSeek={props.onSeek} />
    </footer>
  )
}
