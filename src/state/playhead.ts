import type { Manifest, TurnSummary } from '../types'

export interface Position {
  step: number
  turnIndex: number
  stepInTurn: number
}

export interface Place {
  round?: number
  turn?: number
  step?: number
}

export function lastStep(manifest: Manifest): number {
  return Math.max(0, manifest.totals.steps - 1)
}

export function clampStep(manifest: Manifest, step: number): number {
  if (!Number.isFinite(step)) return 0
  return Math.min(Math.max(0, Math.trunc(step)), lastStep(manifest))
}

export function countAtOrBefore<T extends { step: number }>(items: readonly T[], step: number): number {
  let low = 0
  let high = items.length
  while (low < high) {
    const middle = (low + high) >> 1
    const item = items[middle]
    if (item !== undefined && item.step <= step) low = middle + 1
    else high = middle
  }
  return low
}

export function turnIndexAtStep(turns: readonly TurnSummary[], step: number): number {
  let low = 0
  let high = turns.length - 1
  while (low < high) {
    const middle = (low + high + 1) >> 1
    const turn = turns[middle]
    if (turn !== undefined && turn.firstStep <= step) low = middle
    else high = middle - 1
  }
  return low
}

export function locate(manifest: Manifest, step: number): Position {
  const clamped = clampStep(manifest, step)
  const turnIndex = turnIndexAtStep(manifest.turns, clamped)
  const turn = manifest.turns[turnIndex]
  return { step: clamped, turnIndex, stepInTurn: turn ? clamped - turn.firstStep : 0 }
}

export function turnEndStep(turn: TurnSummary): number {
  return turn.firstStep + Math.max(1, turn.stepCount) - 1
}

export function findTurn(manifest: Manifest, round: number, position: number): TurnSummary | undefined {
  return manifest.turns.find((turn) => turn.round === round && turn.position === position)
}

export function stepForPlace(manifest: Manifest, place: Place): number {
  if (place.round === undefined) return 0
  const turn = findTurn(manifest, place.round, place.turn ?? 1)
  if (!turn) return 0
  if (place.step === undefined) return turnEndStep(turn)
  const offset = Math.min(Math.max(1, place.step), Math.max(1, turn.stepCount)) - 1
  return turn.firstStep + offset
}

export function placeOfStep(manifest: Manifest, step: number): Required<Place> | null {
  const position = locate(manifest, step)
  const turn = manifest.turns[position.turnIndex]
  if (!turn) return null
  return { round: turn.round, turn: turn.position, step: position.stepInTurn + 1 }
}

export function nextTurnStep(manifest: Manifest, step: number): number {
  const position = locate(manifest, step)
  const turn = manifest.turns[position.turnIndex]
  if (!turn) return 0
  const end = turnEndStep(turn)
  if (position.step < end) return end
  const next = manifest.turns[position.turnIndex + 1]
  return next ? turnEndStep(next) : end
}

export function previousTurnStep(manifest: Manifest, step: number): number {
  const position = locate(manifest, step)
  const previous = manifest.turns[position.turnIndex - 1]
  return previous ? turnEndStep(previous) : 0
}
