import type { Manifest, RoundSummary } from '../types'
import { locate } from './playhead'

export interface RoundTick {
  round: number
  fraction: number
}

const NICE_INTERVALS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

function clampFraction(fraction: number): number {
  if (!Number.isFinite(fraction)) return 0
  return Math.min(Math.max(fraction, 0), 1)
}

export function turnFraction(manifest: Manifest, turnIndex: number): number {
  return manifest.turns.length ? turnIndex / manifest.turns.length : 0
}

export function stepFraction(manifest: Manifest, step: number): number {
  const position = locate(manifest, step)
  const turn = manifest.turns[position.turnIndex]
  if (!turn) return 0
  const within = (position.stepInTurn + 1) / Math.max(1, turn.stepCount)
  return (position.turnIndex + within) / manifest.turns.length
}

export function turnAtFraction(manifest: Manifest, fraction: number): number {
  const count = manifest.turns.length
  return Math.min(Math.max(0, count - 1), Math.floor(clampFraction(fraction) * count))
}

export function stepAtFraction(manifest: Manifest, fraction: number): number {
  const turnIndex = turnAtFraction(manifest, fraction)
  const turn = manifest.turns[turnIndex]
  if (!turn) return 0
  const within = clampFraction(fraction) * manifest.turns.length - turnIndex
  const offset = Math.min(Math.max(1, turn.stepCount) - 1, Math.floor(within * turn.stepCount))
  return turn.firstStep + Math.max(0, offset)
}

export function roundTicks(rounds: readonly RoundSummary[], turnCount: number, maxLabels: number): RoundTick[] {
  if (!rounds.length || !turnCount) return []
  const interval = NICE_INTERVALS.find((size) => rounds.length / size <= maxLabels) ?? rounds.length
  return rounds
    .filter((entry, index) => index === 0 || entry.round % interval === 0)
    .map((entry) => ({ round: entry.round, fraction: (entry.turns[0] ?? 0) / turnCount }))
}

export interface TurnMark {
  index: number
  actor: string
  failedCommands: number
  failedTurn: boolean
  highlight: string | null
  sessionStart: boolean
  roundStart: boolean
}

export function turnMarks(manifest: Manifest): TurnMark[] {
  const highlights = new Map(manifest.highlights.map((entry) => [entry.turnIndex, entry.title]))
  const sessionStarts = new Set(manifest.sessions.slice(1).map((session) => session.firstTurn))
  return manifest.turns.map((turn, index) => ({
    index,
    actor: turn.actor,
    failedCommands: turn.failedCommands,
    failedTurn: turn.status === 'error' || turn.errors > 0,
    highlight: highlights.get(index) ?? null,
    sessionStart: sessionStarts.has(index),
    roundStart: index > 0 && manifest.turns[index - 1]?.round !== turn.round,
  }))
}
