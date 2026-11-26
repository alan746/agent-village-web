import { describe, expect, it } from 'vitest'
import { buildManifest, threeVillagerRun } from './fixtures'
import { ACCENT_COUNT, accentIndex, accentVar, roundAfter, roundsToLoad, sessionAt, villagerViews } from './village'

const run = threeVillagerRun()

describe('villagerViews', () => {
  it('shows nobody else before the first villager has finished', () => {
    expect(villagerViews(run, 0)).toEqual([
      { name: 'ann', status: 'acting', turnIndex: 0 },
      { name: 'bob', status: 'waiting', turnIndex: null },
      { name: 'cy', status: 'waiting', turnIndex: null },
    ])
  })

  it('marks earlier villagers of the round as done', () => {
    expect(villagerViews(run, 2)).toEqual([
      { name: 'ann', status: 'done', turnIndex: 0 },
      { name: 'bob', status: 'done', turnIndex: 1 },
      { name: 'cy', status: 'acting', turnIndex: 2 },
    ])
  })

  it('shows the previous round for villagers still waiting', () => {
    expect(villagerViews(run, 4)).toEqual([
      { name: 'ann', status: 'done', turnIndex: 3 },
      { name: 'bob', status: 'acting', turnIndex: 4 },
      { name: 'cy', status: 'waiting', turnIndex: 2 },
    ])
  })

  it('handles a villager that skipped a round', () => {
    const uneven = buildManifest([
      { round: 1, actor: 'ann', steps: 1 },
      { round: 1, actor: 'bob', steps: 1 },
      { round: 2, actor: 'bob', steps: 1 },
    ], ['ann', 'bob'])
    expect(villagerViews(uneven, 2)).toEqual([
      { name: 'ann', status: 'waiting', turnIndex: 0 },
      { name: 'bob', status: 'acting', turnIndex: 2 },
    ])
  })
})

describe('roundsToLoad', () => {
  it('needs only the current round when everyone has acted in it', () => {
    expect(roundsToLoad(run, 0)).toEqual([1])
    expect(roundsToLoad(run, 5)).toEqual([2])
  })

  it('also needs the round holding the waiting villagers last turns', () => {
    expect(roundsToLoad(run, 3)).toEqual([1, 2])
  })
})

describe('roundAfter', () => {
  it('gives the next exported round', () => {
    expect(roundAfter(run.rounds, 1)).toBe(2)
    expect(roundAfter(run.rounds, 2)).toBeNull()
    expect(roundAfter(run.rounds, 7)).toBeNull()
  })
})

describe('sessionAt', () => {
  it('picks the session that was running at a turn', () => {
    expect(sessionAt(run.sessions, 0)?.mode).toBe('start')
    expect(sessionAt(run.sessions, 2)?.limits.inputBudget).toBe(1000)
    expect(sessionAt(run.sessions, 3)?.limits.inputBudget).toBe(5000)
    expect(sessionAt([], 3)).toBeNull()
  })
})

describe('accent colours', () => {
  it('follow the turn order, not the name', () => {
    const villagers = [{ name: 'zed' }, { name: 'amy' }]
    expect(accentIndex(villagers, 'zed')).toBe(0)
    expect(accentIndex(villagers, 'amy')).toBe(1)
    expect(accentVar(villagers, 'amy')).toBe('var(--v1)')
  })

  it('wrap around the palette and give strangers the last colour', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({ name: `v${index}` }))
    expect(accentIndex(many, 'v6')).toBe(0)
    expect(accentIndex(many, 'nobody')).toBe(ACCENT_COUNT - 1)
  })
})
