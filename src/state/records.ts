import type { RoundFile, StepRecord, TurnRecord } from '../types'

export function isStep(record: TurnRecord): record is StepRecord {
  return record.kind !== 'spend'
}

export function recordsOfTurn(round: RoundFile | undefined, turnIndex: number): TurnRecord[] | undefined {
  return round?.turns.find((turn) => turn.index === turnIndex)?.records
}

export function stepsUpTo(records: readonly TurnRecord[], step: number): StepRecord[] {
  const shown: StepRecord[] = []
  for (const record of records) {
    if (!isStep(record)) continue
    if (record.step > step) break
    shown.push(record)
  }
  return shown
}

export function allSteps(records: readonly TurnRecord[]): StepRecord[] {
  return records.filter(isStep)
}

export function stepRecord(records: readonly TurnRecord[] | undefined, step: number): StepRecord | undefined {
  return records?.find((record): record is StepRecord => isStep(record) && record.step === step)
}
