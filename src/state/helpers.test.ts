import { describe, expect, it } from 'vitest'
import { clipText, countLines } from './clip'
import { describeRecord, fileVerb, formatToolArgs } from './describe'
import { buildManifest, command, say, threeVillagerRun } from './fixtures'
import { formatLink, parseLink, sameLink } from './link'
import { dwellMs } from './timing'
import { roundTicks, stepAtFraction, stepFraction, turnAtFraction, turnMarks } from './track'
import type { StepRecord } from '../types'

const run = threeVillagerRun()

describe('links', () => {
  it('parses run, round, turn and step from the hash', () => {
    expect(parseLink('#run=20261124_033232&round=34&turn=3')).toEqual({ run: '20261124_033232', round: 34, turn: 3 })
    expect(parseLink('#run=a&round=2&turn=1&step=5')).toEqual({ run: 'a', round: 2, turn: 1, step: 5 })
    expect(parseLink('')).toEqual({})
  })

  it('ignores positions that are not positive whole numbers', () => {
    expect(parseLink('#run=a&round=0&turn=2')).toEqual({ run: 'a' })
    expect(parseLink('#run=a&round=x')).toEqual({ run: 'a' })
    expect(parseLink('#run=a&round=3&turn=-1')).toEqual({ run: 'a', round: 3, turn: 1 })
    expect(parseLink('#turn=2&step=4')).toEqual({})
  })

  it('formats a link that parses back to itself', () => {
    const link = { run: 'demo', round: 3, turn: 2, step: 7 }
    expect(formatLink(link)).toBe('#run=demo&round=3&turn=2&step=7')
    expect(parseLink(formatLink(link))).toEqual(link)
    expect(formatLink({ run: 'demo' })).toBe('#run=demo')
    expect(formatLink({})).toBe('')
    expect(sameLink({ run: 'a', round: 1 }, { run: 'a', round: 1, turn: 1 })).toBe(true)
  })
})

describe('clipText', () => {
  it('leaves short text alone', () => {
    expect(clipText('one\ntwo\n', 12, 100)).toEqual({ text: 'one\ntwo\n', clipped: false, totalLines: 2, hiddenLines: 0 })
    expect(clipText('', 12, 100).clipped).toBe(false)
  })

  it('cuts after the line limit and reports what is hidden', () => {
    expect(clipText('a\nb\nc\nd\ne', 2, 100)).toEqual({ text: 'a\nb', clipped: true, totalLines: 5, hiddenLines: 3 })
  })

  it('cuts one very long line at the character limit', () => {
    const clipped = clipText('x'.repeat(5000), 12, 300)
    expect([clipped.text.length, clipped.clipped, clipped.hiddenLines]).toEqual([300, true, 0])
  })

  it('counts lines without a trailing newline', () => {
    expect([countLines(''), countLines('a'), countLines('a\n'), countLines('a\nb')]).toEqual([0, 1, 1, 2])
  })
})

describe('describeRecord', () => {
  it('summarises each kind of step in one line', () => {
    const records: StepRecord[] = [
      { id: 1, ts: 1, step: 0, kind: 'say', text: 'First line.\nSecond line.' },
      { id: 2, ts: 2, step: 1, kind: 'read_file', path: 'a.py', status: 'ok', detail: '' },
      { id: 3, ts: 3, step: 2, kind: 'write_file', path: 'b.py', status: 'rejected', detail: 'outside', bytes: null },
      { id: 4, ts: 4, step: 3, kind: 'task', action: 'take_task', taskId: 4, ok: true, outcome: 'You took task 4.' },
      { id: 5, ts: 5, step: 4, kind: 'task', action: 'done_task', taskId: 4, ok: false, outcome: 'no submissions' },
      { id: 6, ts: 6, step: 5, kind: 'tool', name: 'read_task', args: {} },
      { id: 7, ts: 7, step: 6, kind: 'idle' },
    ]
    expect(records.map(describeRecord)).toEqual([
      'First line.',
      'read a.py',
      'write of b.py rejected',
      'took task 4',
      'tried to mark done task 4',
      'checked read_task',
      'did nothing visible this turn',
    ])
  })

  it('names the file action and its outcome', () => {
    const base = { id: 1, ts: 1, step: 0, path: 'a.py', detail: '' } as const
    expect(fileVerb({ ...base, kind: 'read_file', status: 'ok' })).toBe('read')
    expect(fileVerb({ ...base, kind: 'write_file', status: 'ok' })).toBe('wrote')
    expect(fileVerb({ ...base, kind: 'write_file', status: 'rejected' })).toBe('write rejected')
    expect(fileVerb({ ...base, kind: 'read_file', status: 'failed' })).toBe('read failed')
  })

  it('shortens long commands', () => {
    const record = { ...command(1, 0), command: `echo ${'y'.repeat(300)}` } as StepRecord
    expect(describeRecord(record).length).toBeLessThanOrEqual(98)
  })

  it('prints tool arguments without empty values', () => {
    expect(formatToolArgs({ task_id: null, worker: 'bob' })).toBe('worker=bob')
    expect(formatToolArgs({ task_id: 4 })).toBe('task_id=4')
    expect(formatToolArgs({})).toBe('')
  })
})

describe('dwellMs', () => {
  it('gets shorter as the speed goes up and never reaches zero', () => {
    const record = say(1, 0, 'x'.repeat(100)) as StepRecord
    expect(dwellMs(record, 1)).toBe(1700)
    expect(dwellMs(record, 2)).toBe(850)
    expect(dwellMs(undefined, 16)).toBe(44)
    expect(dwellMs(undefined, 1000)).toBe(40)
  })

  it('caps the reading time of long text', () => {
    expect(dwellMs(say(1, 0, 'x'.repeat(50_000)) as StepRecord, 1)).toBe(3300)
  })
})

describe('timeline track', () => {
  it('places the playhead inside its turn', () => {
    expect(stepFraction(run, 0)).toBeCloseTo((0 + 1 / 3) / 6)
    expect(stepFraction(run, 2)).toBeCloseTo(1 / 6)
    expect(stepFraction(run, 12)).toBeCloseTo(1)
  })

  it('maps a fraction of the track back to a step', () => {
    expect(turnAtFraction(run, 0)).toBe(0)
    expect(turnAtFraction(run, 0.51)).toBe(3)
    expect(turnAtFraction(run, 1)).toBe(5)
    expect(stepAtFraction(run, 0)).toBe(0)
    expect(stepAtFraction(run, 0.16)).toBe(2)
    expect(stepAtFraction(run, 0.51)).toBe(6)
    expect(stepAtFraction(run, 1)).toBe(12)
    expect(stepAtFraction(run, -3)).toBe(0)
  })

  it('labels the first round and then round numbers at a readable interval', () => {
    expect(roundTicks(run.rounds, 6, 8)).toEqual([
      { round: 1, fraction: 0 },
      { round: 2, fraction: 0.5 },
    ])
    expect(roundTicks(run.rounds, 6, 1)).toEqual([
      { round: 1, fraction: 0 },
      { round: 2, fraction: 0.5 },
    ])
    expect(roundTicks([], 0, 8)).toEqual([])
  })
})

describe('turnMarks', () => {
  it('flags failed commands, failed turns, highlights and session and round starts', () => {
    const manifest = buildManifest([
      { round: 1, actor: 'ann', steps: 1, failedCommands: 2 },
      { round: 1, actor: 'bob', steps: 1, status: 'error' },
      { round: 2, actor: 'ann', steps: 1 },
      { round: 2, actor: 'bob', steps: 1 },
    ], ['ann', 'bob'])
    manifest.highlights = [{ round: 2, turn: 1, turnIndex: 2, actor: 'ann', title: 'Look here', note: '' }]
    expect(turnMarks(manifest).map((mark) => [mark.failedCommands, mark.failedTurn, mark.highlight, mark.sessionStart, mark.roundStart])).toEqual([
      [2, false, null, false, false],
      [0, true, null, false, false],
      [0, false, 'Look here', false, true],
      [0, false, null, true, false],
    ])
  })
})
