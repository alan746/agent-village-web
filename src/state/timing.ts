import type { StepRecord } from '../types'
import { countLines } from './clip'

export const SPEEDS = [1, 2, 4, 8, 16] as const

const BASE_MS = 700
const MS_PER_CHARACTER = 10
const MS_PER_OUTPUT_LINE = 60
const MAX_EXTRA_MS = 2600
const MIN_MS = 40

function readingMs(record: StepRecord | undefined): number {
  if (!record) return 0
  if (record.kind === 'say' || record.kind === 'chat') return record.text.length * MS_PER_CHARACTER
  if (record.kind === 'command') {
    const lines = Math.min(12, countLines(record.stdout) + countLines(record.stderr))
    return 300 + lines * MS_PER_OUTPUT_LINE
  }
  if (record.kind === 'task') return (record.description ?? record.result ?? '').length * MS_PER_CHARACTER
  return 0
}

export function dwellMs(record: StepRecord | undefined, speed: number): number {
  const extra = Math.min(MAX_EXTRA_MS, readingMs(record))
  return Math.max(MIN_MS, Math.round((BASE_MS + extra) / Math.max(1, speed)))
}
