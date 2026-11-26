import type { Manifest, RoundSummary, Session } from '../types'

export type VillagerStatus = 'acting' | 'done' | 'waiting'

export interface VillagerView {
  name: string
  status: VillagerStatus
  turnIndex: number | null
}

function latestTurnOf(manifest: Manifest, name: string, turnIndex: number): number | null {
  for (let index = turnIndex; index >= 0; index -= 1) {
    if (manifest.turns[index]?.actor === name) return index
  }
  return null
}

export function villagerViews(manifest: Manifest, turnIndex: number): VillagerView[] {
  const current = manifest.turns[turnIndex]
  return manifest.villagers.map(({ name }) => {
    const shown = latestTurnOf(manifest, name, turnIndex)
    if (current && current.actor === name) return { name, status: 'acting', turnIndex: shown }
    const shownTurn = shown === null ? undefined : manifest.turns[shown]
    const actedThisRound = current !== undefined && shownTurn !== undefined && shownTurn.round === current.round
    return { name, status: actedThisRound ? 'done' : 'waiting', turnIndex: shown }
  })
}

export function roundsToLoad(manifest: Manifest, turnIndex: number): number[] {
  const rounds = new Set<number>()
  for (const view of villagerViews(manifest, turnIndex)) {
    const turn = view.turnIndex === null ? undefined : manifest.turns[view.turnIndex]
    if (turn) rounds.add(turn.round)
  }
  const current = manifest.turns[turnIndex]
  if (current) rounds.add(current.round)
  return [...rounds].sort((a, b) => a - b)
}

export function roundAfter(rounds: readonly RoundSummary[], round: number): number | null {
  const index = rounds.findIndex((entry) => entry.round === round)
  return index >= 0 ? rounds[index + 1]?.round ?? null : null
}

export function sessionAt(sessions: readonly Session[], turnIndex: number): Session | null {
  let found: Session | null = sessions[0] ?? null
  for (const session of sessions) {
    if (session.firstTurn <= turnIndex) found = session
  }
  return found
}

export const ACCENT_COUNT = 6

export function accentIndex(villagers: readonly { name: string }[], name: string): number {
  const index = villagers.findIndex((villager) => villager.name === name)
  return index < 0 ? ACCENT_COUNT - 1 : index % ACCENT_COUNT
}

export function accentVar(villagers: readonly { name: string }[], name: string): string {
  return `var(--v${accentIndex(villagers, name)})`
}
