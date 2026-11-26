import type { Manifest, Tally, TurnRecord, TurnSummary, Usage } from '../types'

export type { Tally }

export interface VillageTally {
  perVillager: Record<string, Tally>
  village: Tally
}

export function emptyUsage(): Usage {
  return { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
}

export function emptyTally(): Tally {
  return { usage: emptyUsage(), commands: 0, failedCommands: 0 }
}

export function addUsage(left: Usage, right: Usage): Usage {
  return {
    calls: left.calls + right.calls,
    input: left.input + right.input,
    output: left.output + right.output,
    cacheRead: left.cacheRead + right.cacheRead,
    cacheWrite: left.cacheWrite + right.cacheWrite,
  }
}

export function addTally(left: Tally, right: Tally): Tally {
  return {
    usage: addUsage(left.usage, right.usage),
    commands: left.commands + right.commands,
    failedCommands: left.failedCommands + right.failedCommands,
  }
}

function tallyOfTurn(turn: TurnSummary): Tally {
  return { usage: turn.usage, commands: turn.commands, failedCommands: turn.failedCommands }
}

export function tallyRecords(records: readonly TurnRecord[], step: number): Tally {
  let counted = emptyTally()
  let pending = emptyUsage()
  for (const record of records) {
    if (record.kind === 'spend') {
      pending = addUsage(pending, { ...record, calls: 1 })
      continue
    }
    if (record.step > step) return counted
    const isCommand = record.kind === 'command'
    counted = addTally(counted, {
      usage: pending,
      commands: isCommand ? 1 : 0,
      failedCommands: isCommand && record.failed ? 1 : 0,
    })
    pending = emptyUsage()
  }
  return addTally(counted, { ...emptyTally(), usage: pending })
}

function latestTurnOf(manifest: Manifest, name: string, turnIndex: number): TurnSummary | undefined {
  for (let index = Math.min(turnIndex, manifest.turns.length - 1); index >= 0; index -= 1) {
    const turn = manifest.turns[index]
    if (turn?.actor === name) return turn
  }
  return undefined
}

function villagerTally(manifest: Manifest, name: string, turnIndex: number, currentTurn: Tally | null): Tally {
  const turn = latestTurnOf(manifest, name, turnIndex)
  if (!turn) return emptyTally()
  if (turn.index < turnIndex) return addTally(turn.before.actor, tallyOfTurn(turn))
  return addTally(turn.before.actor, currentTurn ?? emptyTally())
}

export function tallyAt(manifest: Manifest, turnIndex: number, currentTurn: Tally | null): VillageTally {
  const perVillager: Record<string, Tally> = {}
  for (const villager of manifest.villagers) {
    perVillager[villager.name] = villagerTally(manifest, villager.name, turnIndex, currentTurn)
  }
  const current = manifest.turns[turnIndex]
  const village = current ? addTally(current.before.village, currentTurn ?? emptyTally()) : emptyTally()
  return { perVillager, village }
}
