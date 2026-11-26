import { describe, expect, it } from 'vitest'
import { taskEvent } from './fixtures'
import { boardAt, countByStatus } from './taskBoard'

const events = [
  taskEvent(1, 'ann', { action: 'post_task', taskId: 1, description: 'Write the parser', maxWorkers: 2 }),
  taskEvent(2, 'ann', { action: 'post_task', taskId: 2, description: 'Write the docs', maxWorkers: 1 }),
  taskEvent(4, 'bob', { action: 'take_task', taskId: 1 }),
  taskEvent(5, 'cy', { action: 'take_task', taskId: 2 }),
  taskEvent(6, 'bob', { action: 'take_task', taskId: 2, ok: false, outcome: 'Task 2 already has the maximum' }),
  taskEvent(7, 'bob', { action: 'submit_task', taskId: 2, ok: false, result: 'sneaky' }),
  taskEvent(8, 'cy', { action: 'take_task', taskId: 1 }),
  taskEvent(9, 'bob', { action: 'submit_task', taskId: 1, result: 'first draft', version: 1 }),
  taskEvent(10, 'ann', { action: 'done_task', taskId: 2, ok: false, outcome: 'Task 2 has no submissions yet' }),
  taskEvent(12, 'bob', { action: 'submit_task', taskId: 1, result: 'second draft', version: 2 }),
  taskEvent(13, 'cy', { action: 'submit_task', taskId: 1, result: 'review notes', version: 1 }),
  taskEvent(15, 'ann', { action: 'done_task', taskId: 1 }),
]

describe('boardAt', () => {
  it('is empty before the first task is posted', () => {
    expect(boardAt(events, 0)).toEqual([])
  })

  it('shows posted tasks as open with their creator', () => {
    const board = boardAt(events, 2)
    expect(board.map((task) => [task.id, task.creator, task.status, task.maxWorkers])).toEqual([
      [1, 'ann', 'open', 2],
      [2, 'ann', 'open', 1],
    ])
    expect(board[0]?.description).toBe('Write the parser')
  })

  it('tracks workers and fills tasks up to their limit', () => {
    const board = boardAt(events, 5)
    expect(board.map((task) => [task.workers, task.status])).toEqual([
      [['bob'], 'partly_taken'],
      [['cy'], 'full'],
    ])
  })

  it('ignores rejected actions', () => {
    const board = boardAt(events, 10)
    expect(board[1]?.workers).toEqual(['cy'])
    expect(board[1]?.submissions).toEqual([])
    expect(board[1]?.done).toBe(false)
    expect(board[0]?.workers).toEqual(['bob', 'cy'])
  })

  it('replaces a worker submission with its newer version', () => {
    expect(boardAt(events, 9)[0]?.submissions).toEqual([{ worker: 'bob', result: 'first draft', version: 1, step: 9 }])
    expect(boardAt(events, 13)[0]?.submissions).toEqual([
      { worker: 'bob', result: 'second draft', version: 2, step: 12 },
      { worker: 'cy', result: 'review notes', version: 1, step: 13 },
    ])
  })

  it('marks a task done and remembers when it last changed', () => {
    const board = boardAt(events, 15)
    expect([board[0]?.status, board[0]?.updatedStep, board[0]?.postedStep]).toEqual(['done', 15, 1])
    expect(board[1]?.updatedStep).toBe(5)
  })

  it('counts versions itself when the log does not give one', () => {
    const board = boardAt([
      taskEvent(1, 'ann', { action: 'post_task', taskId: 3, description: 'x', maxWorkers: 1 }),
      taskEvent(2, 'bob', { action: 'take_task', taskId: 3 }),
      taskEvent(3, 'bob', { action: 'submit_task', taskId: 3, result: 'a' }),
      taskEvent(4, 'bob', { action: 'submit_task', taskId: 3, result: 'b' }),
    ], 4)
    expect(board[0]?.submissions).toEqual([{ worker: 'bob', result: 'b', version: 2, step: 4 }])
  })

  it('does not change earlier results when asked again', () => {
    const early = boardAt(events, 4)
    boardAt(events, 15)
    expect(early[0]?.workers).toEqual(['bob'])
  })
})

describe('countByStatus', () => {
  it('counts tasks per status', () => {
    expect(countByStatus(boardAt(events, 5))).toEqual({ open: 0, partly_taken: 1, full: 1, done: 0 })
    expect(countByStatus(boardAt(events, 15))).toEqual({ open: 0, partly_taken: 0, full: 1, done: 1 })
  })
})
