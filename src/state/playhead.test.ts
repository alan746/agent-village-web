import { describe, expect, it } from 'vitest'
import { buildManifest, threeVillagerRun } from './fixtures'
import {
  clampStep,
  countAtOrBefore,
  findTurn,
  lastStep,
  locate,
  nextTurnStep,
  placeOfStep,
  previousTurnStep,
  stepForPlace,
  turnEndStep,
  turnIndexAtStep,
} from './playhead'

const run = threeVillagerRun()

describe('locate', () => {
  it('maps every step to its turn and offset', () => {
    expect(locate(run, 0)).toEqual({ step: 0, turnIndex: 0, stepInTurn: 0 })
    expect(locate(run, 2)).toEqual({ step: 2, turnIndex: 0, stepInTurn: 2 })
    expect(locate(run, 3)).toEqual({ step: 3, turnIndex: 1, stepInTurn: 0 })
    expect(locate(run, 5)).toEqual({ step: 5, turnIndex: 2, stepInTurn: 0 })
    expect(locate(run, 12)).toEqual({ step: 12, turnIndex: 5, stepInTurn: 0 })
  })

  it('clamps positions outside the run', () => {
    expect(lastStep(run)).toBe(12)
    expect(clampStep(run, -4)).toBe(0)
    expect(clampStep(run, 99)).toBe(12)
    expect(clampStep(run, Number.NaN)).toBe(0)
    expect(locate(run, 99).turnIndex).toBe(5)
  })

  it('survives a run without turns', () => {
    const empty = buildManifest([])
    expect(locate(empty, 3)).toEqual({ step: 0, turnIndex: 0, stepInTurn: 0 })
    expect(turnIndexAtStep(empty.turns, 0)).toBe(0)
    expect(placeOfStep(empty, 0)).toBeNull()
  })
})

describe('countAtOrBefore', () => {
  it('counts items whose step has been reached', () => {
    const items = [{ step: 2 }, { step: 2 }, { step: 7 }, { step: 9 }]
    expect(countAtOrBefore(items, 1)).toBe(0)
    expect(countAtOrBefore(items, 2)).toBe(2)
    expect(countAtOrBefore(items, 8)).toBe(3)
    expect(countAtOrBefore(items, 50)).toBe(4)
    expect(countAtOrBefore([], 5)).toBe(0)
  })
})

describe('links to places', () => {
  it('finds a turn by round and position', () => {
    expect(findTurn(run, 2, 2)?.index).toBe(4)
    expect(findTurn(run, 3, 1)).toBeUndefined()
  })

  it('opens a turn at its last step unless a step is given', () => {
    expect(stepForPlace(run, {})).toBe(0)
    expect(stepForPlace(run, { round: 2, turn: 1 })).toBe(9)
    expect(stepForPlace(run, { round: 2, turn: 1, step: 2 })).toBe(7)
    expect(stepForPlace(run, { round: 2, turn: 1, step: 40 })).toBe(9)
    expect(stepForPlace(run, { round: 2 })).toBe(9)
    expect(stepForPlace(run, { round: 9, turn: 1 })).toBe(0)
  })

  it('round-trips a step through its place', () => {
    for (let step = 0; step <= lastStep(run); step += 1) {
      const place = placeOfStep(run, step)
      expect(place).not.toBeNull()
      expect(stepForPlace(run, place ?? {})).toBe(step)
    }
    expect(placeOfStep(run, 7)).toEqual({ round: 2, turn: 1, step: 2 })
  })
})

describe('turn navigation', () => {
  it('moves forward to the end of the current turn, then of the next one', () => {
    expect(nextTurnStep(run, 0)).toBe(2)
    expect(nextTurnStep(run, 2)).toBe(4)
    expect(nextTurnStep(run, 12)).toBe(12)
  })

  it('moves back to the end of the previous turn', () => {
    expect(previousTurnStep(run, 4)).toBe(2)
    expect(previousTurnStep(run, 3)).toBe(2)
    expect(previousTurnStep(run, 1)).toBe(0)
  })

  it('gives the last step of a turn', () => {
    const turn = run.turns[3]
    expect(turn && turnEndStep(turn)).toBe(9)
  })
})
