import { describe, expect, it } from 'vitest'
import { shareLines } from './clip'
import { command, say, spend } from './fixtures'
import { allSteps, recordsOfTurn, stepRecord, stepsUpTo } from './records'
import type { RoundFile } from '../types'

const records = [spend(1, 10, 1), say(2, 4), spend(3, 5, 1), command(4, 5), command(5, 6, true)]

describe('records of a turn', () => {
  it('lists the steps reached by the playhead and skips token spend', () => {
    expect(stepsUpTo(records, 3)).toEqual([])
    expect(stepsUpTo(records, 5).map((record) => record.step)).toEqual([4, 5])
    expect(allSteps(records).map((record) => record.step)).toEqual([4, 5, 6])
  })

  it('finds the record at a step', () => {
    expect(stepRecord(records, 6)?.kind).toBe('command')
    expect(stepRecord(records, 9)).toBeUndefined()
    expect(stepRecord(undefined, 4)).toBeUndefined()
  })

  it('finds a turn inside a round file', () => {
    const round: RoundFile = { format: 1, run: 'demo', round: 2, turns: [{ index: 7, actor: 'ann', position: 1, records }] }
    expect(recordsOfTurn(round, 7)).toBe(records)
    expect(recordsOfTurn(round, 8)).toBeUndefined()
    expect(recordsOfTurn(undefined, 7)).toBeUndefined()
  })
})

describe('shareLines', () => {
  it('keeps room for stderr and gives the rest to stdout', () => {
    expect(shareLines(40, 30, 12, 4)).toEqual([8, 4])
    expect(shareLines(2, 30, 12, 4)).toEqual([2, 10])
    expect(shareLines(40, 0, 12, 4)).toEqual([12, 0])
    expect(shareLines(3, 2, 12, 4)).toEqual([3, 2])
  })
})
