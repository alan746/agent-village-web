import { describe, expect, it } from 'vitest'
import { command, say, spend, threeVillagerRun, usage } from './fixtures'
import { emptyTally, tallyAt, tallyRecords } from './tally'

const run = threeVillagerRun()
const records = [spend(1, 100, 10), say(2, 5), command(3, 6, true), spend(4, 50, 5), command(5, 7), spend(6, 20, 2)]

describe('tallyRecords', () => {
  it('counts a model call once its first result is on screen', () => {
    expect(tallyRecords(records, 4)).toEqual(emptyTally())
    expect(tallyRecords(records, 5)).toEqual({ usage: usage(100, 10), commands: 0, failedCommands: 0 })
    expect(tallyRecords(records, 6)).toEqual({ usage: usage(100, 10), commands: 1, failedCommands: 1 })
  })

  it('includes trailing model calls at the end of the turn', () => {
    expect(tallyRecords(records, 7)).toEqual({ usage: usage(170, 17, 3), commands: 2, failedCommands: 1 })
    expect(tallyRecords(records, 99)).toEqual(tallyRecords(records, 7))
  })

  it('is empty for a turn without records', () => {
    expect(tallyRecords([], 3)).toEqual(emptyTally())
  })
})

describe('tallyAt', () => {
  it('sums completed turns per villager', () => {
    const tally = tallyAt(run, 4, null)
    expect(tally.perVillager.ann).toEqual({ usage: usage(400, 40, 3), commands: 4, failedCommands: 0 })
    expect(tally.perVillager.bob).toEqual({ usage: usage(200, 20), commands: 2, failedCommands: 1 })
    expect(tally.perVillager.cy).toEqual({ usage: usage(50, 5), commands: 0, failedCommands: 0 })
    expect(tally.village).toEqual({ usage: usage(650, 65, 5), commands: 6, failedCommands: 1 })
  })

  it('adds the part of the current turn that has been played', () => {
    const partial = { usage: usage(7, 1), commands: 1, failedCommands: 1 }
    const tally = tallyAt(run, 4, partial)
    expect(tally.perVillager.bob).toEqual({ usage: usage(207, 21, 2), commands: 3, failedCommands: 2 })
    expect(tally.village.usage.input).toBe(657)
  })

  it('starts from zero for every villager', () => {
    const tally = tallyAt(run, 0, null)
    expect(Object.keys(tally.perVillager)).toEqual(['ann', 'bob', 'cy'])
    expect(tally.village).toEqual(emptyTally())
  })

  it('matches the turn summary once the whole turn is played', () => {
    const turnRecords = [spend(1, 150, 15), say(2, 3), spend(3, 50, 5), command(4, 4, true), command(5, 4.5)]
    const whole = tallyRecords(turnRecords, 99)
    expect(whole.usage.input).toBe(run.turns[1]?.usage.input)
    expect(whole.commands).toBe(run.turns[1]?.commands)
    expect(whole.failedCommands).toBe(run.turns[1]?.failedCommands)
  })
})
