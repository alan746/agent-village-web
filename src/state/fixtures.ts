import type { Manifest, RoundSummary, Tally, TaskEvent, TurnRecord, TurnSummary, Usage } from '../types'

export function usage(input: number, output: number, calls = 1): Usage {
  return { calls, input, output, cacheRead: 0, cacheWrite: 0 }
}

interface TurnSpec {
  round: number
  actor: string
  steps: number
  commands?: number
  failedCommands?: number
  usage?: Usage
  status?: string | null
}

function zeroTally(): Tally {
  return { usage: usage(0, 0, 0), commands: 0, failedCommands: 0 }
}

function grow(tally: Tally, turn: TurnSummary): Tally {
  const { usage: add, commands, failedCommands } = turn
  return {
    usage: {
      calls: tally.usage.calls + add.calls,
      input: tally.usage.input + add.input,
      output: tally.usage.output + add.output,
      cacheRead: tally.usage.cacheRead + add.cacheRead,
      cacheWrite: tally.usage.cacheWrite + add.cacheWrite,
    },
    commands: tally.commands + commands,
    failedCommands: tally.failedCommands + failedCommands,
  }
}

function attachRunningTotals(turns: TurnSummary[]): TurnSummary[] {
  const zero = zeroTally()
  let village = zero
  const actors = new Map<string, Tally>()
  return turns.map((turn) => {
    const actor = actors.get(turn.actor) ?? zero
    const withTotals = { ...turn, before: { village, actor } }
    village = grow(village, turn)
    actors.set(turn.actor, grow(actor, turn))
    return withTotals
  })
}

function buildTurns(specs: readonly TurnSpec[]): TurnSummary[] {
  const positions = new Map<number, number>()
  let firstStep = 0
  return attachRunningTotals(specs.map((spec, index) => {
    const position = (positions.get(spec.round) ?? 0) + 1
    positions.set(spec.round, position)
    const turn: TurnSummary = {
      index,
      round: spec.round,
      position,
      actor: spec.actor,
      logStep: index,
      status: spec.status === undefined ? 'ok' : spec.status,
      startTs: 1000 + index * 100,
      endTs: 1090 + index * 100,
      firstEventId: index * 50 + 1,
      lastEventId: index * 50 + 49,
      firstStep,
      stepCount: spec.steps,
      usage: spec.usage ?? usage(100, 10),
      commands: spec.commands ?? 0,
      failedCommands: spec.failedCommands ?? 0,
      errors: spec.status === 'error' ? 1 : 0,
      before: { village: zeroTally(), actor: zeroTally() },
    }
    firstStep += spec.steps
    return turn
  }))
}

function buildRounds(turns: readonly TurnSummary[]): RoundSummary[] {
  const numbers = [...new Set(turns.map((turn) => turn.round))]
  return numbers.map((round) => {
    const own = turns.filter((turn) => turn.round === round)
    return {
      round,
      file: `rounds/${String(round).padStart(3, '0')}.json`,
      turns: own.map((turn) => turn.index),
      startTs: own[0]?.startTs ?? 0,
      endTs: own[own.length - 1]?.endTs ?? 0,
      stepCount: own.reduce((sum, turn) => sum + turn.stepCount, 0),
      commands: own.reduce((sum, turn) => sum + turn.commands, 0),
      failedCommands: own.reduce((sum, turn) => sum + turn.failedCommands, 0),
      failedTurns: own.filter((turn) => turn.status === 'error').length,
      usage: usage(0, 0, 0),
    }
  })
}

export function buildManifest(specs: readonly TurnSpec[], names = ['ann', 'bob', 'cy']): Manifest {
  const turns = buildTurns(specs)
  const limits = {
    rounds: 2,
    maxToolRounds: 5,
    inputBudget: 1000,
    outputBudget: 100,
    compactTrigger: 400,
    commandTimeout: 30,
  }
  const session = {
    mode: 'start',
    round: 1,
    logStep: 0,
    ts: 990,
    eventId: 0,
    firstTurn: 0,
    network: true,
    limits,
    attempted: turns.length,
    ok: turns.length,
    failed: 0,
    stopReason: null,
    stopText: 'not recorded',
  }
  return {
    format: 1,
    id: 'demo',
    title: 'Demo run',
    goal: 'Build a tiny tool.',
    startTs: 990,
    endTs: 2000,
    marked: true,
    villagers: names.map((name, index) => ({ name, role: index ? 'worker' : 'leader', model: `model-${name}` })),
    sessions: [session, { ...session, mode: 'resume', firstTurn: 3, limits: { ...limits, inputBudget: 5000 } }],
    totals: {
      rounds: new Set(turns.map((turn) => turn.round)).size,
      turns: turns.length,
      okTurns: turns.length,
      failedTurns: 0,
      unfinishedTurns: 0,
      steps: turns.reduce((sum, turn) => sum + turn.stepCount, 0),
      commands: 0,
      failedCommands: 0,
      chatMessages: 0,
      usage: usage(0, 0, 0),
      perVillager: [],
    },
    rounds: buildRounds(turns),
    turns,
    chat: [],
    taskEvents: [],
    highlights: [],
  }
}

export function threeVillagerRun(): Manifest {
  return buildManifest([
    { round: 1, actor: 'ann', steps: 3, commands: 1, usage: usage(100, 10, 2) },
    { round: 1, actor: 'bob', steps: 2, commands: 2, failedCommands: 1, usage: usage(200, 20) },
    { round: 1, actor: 'cy', steps: 1, usage: usage(50, 5) },
    { round: 2, actor: 'ann', steps: 4, commands: 3, usage: usage(300, 30) },
    { round: 2, actor: 'bob', steps: 2, usage: usage(400, 40) },
    { round: 2, actor: 'cy', steps: 1, usage: usage(60, 6) },
  ])
}

export function taskEvent(step: number, actor: string, fields: Partial<TaskEvent>): TaskEvent {
  return {
    eventId: step * 10,
    turn: 0,
    actor,
    ts: 1000 + step,
    step,
    action: 'take_task',
    taskId: 1,
    ok: true,
    outcome: '',
    ...fields,
  }
}

export function spend(id: number, input: number, output: number): TurnRecord {
  return { id, ts: id, kind: 'spend', phase: 'thinking', input, output, cacheRead: 0, cacheWrite: 0 }
}

export function say(id: number, step: number, text = 'thinking aloud'): TurnRecord {
  return { id, ts: id, kind: 'say', step, text }
}

export function command(id: number, step: number, failed = false): TurnRecord {
  return {
    id,
    ts: id,
    kind: 'command',
    step,
    command: 'pytest -q',
    exitCode: failed ? 1 : 0,
    timedOut: false,
    duration: 0.4,
    stdout: 'line one\nline two\n',
    stderr: '',
    failed,
  }
}
