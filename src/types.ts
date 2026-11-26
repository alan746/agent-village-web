export interface Usage {
  calls: number
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export interface Tally {
  usage: Usage
  commands: number
  failedCommands: number
}

export interface Villager {
  name: string
  role: string
  model: string
}

export interface Limits {
  rounds: number | null
  maxToolRounds: number | null
  inputBudget: number | null
  outputBudget: number | null
  compactTrigger: number | null
  commandTimeout: number | null
}

export interface Session {
  mode: string | null
  round: number | null
  logStep: number | null
  ts: number
  eventId: number
  firstTurn: number
  network: boolean | null
  limits: Limits
  attempted: number
  ok: number
  failed: number
  stopReason: string | null
  stopText: string
}

export interface VillagerTotals {
  name: string
  turns: number
  usage: Usage
  commands: number
  failedCommands: number
  chatMessages: number
}

export interface Totals {
  rounds: number
  turns: number
  okTurns: number
  failedTurns: number
  unfinishedTurns: number
  steps: number
  commands: number
  failedCommands: number
  chatMessages: number
  usage: Usage
  perVillager: VillagerTotals[]
}

export interface RoundSummary {
  round: number
  file: string
  turns: number[]
  startTs: number
  endTs: number
  stepCount: number
  commands: number
  failedCommands: number
  failedTurns: number
  usage: Usage
}

export interface TurnSummary {
  index: number
  round: number
  position: number
  actor: string
  logStep: number | null
  status: string | null
  startTs: number
  endTs: number
  firstEventId: number
  lastEventId: number
  firstStep: number
  stepCount: number
  usage: Usage
  commands: number
  failedCommands: number
  errors: number
  before: { village: Tally; actor: Tally }
}

export interface ChatMessage {
  id: number | null
  actor: string
  content: string
  ts: number
  eventId: number
  step: number
  turn: number
}

export type TaskAction = 'post_task' | 'take_task' | 'submit_task' | 'done_task'

export interface TaskFields {
  action: TaskAction
  taskId: number | null
  ok: boolean
  outcome: string
  description?: string
  maxWorkers?: number | null
  result?: string
  version?: number | null
}

export interface TaskEvent extends TaskFields {
  eventId: number
  turn: number
  actor: string
  ts: number
  step: number
}

export interface Highlight {
  round: number
  turn: number
  turnIndex: number
  actor: string
  title: string
  note: string
}

export interface Manifest {
  format: number
  id: string
  title: string
  goal: string
  startTs: number | null
  endTs: number | null
  marked: boolean
  villagers: Villager[]
  sessions: Session[]
  totals: Totals
  rounds: RoundSummary[]
  turns: TurnSummary[]
  chat: ChatMessage[]
  taskEvents: TaskEvent[]
  highlights: Highlight[]
}

interface RecordBase {
  id: number
  ts: number
}

interface StepBase extends RecordBase {
  step: number
}

export interface SayRecord extends StepBase {
  kind: 'say'
  text: string
}

export interface CommandRecord extends StepBase {
  kind: 'command'
  command: string
  exitCode: number | null
  timedOut: boolean
  duration: number | null
  stdout: string
  stderr: string
  failed: boolean
}

export interface FileRecord extends StepBase {
  kind: 'read_file' | 'write_file'
  path: string
  status: 'ok' | 'failed' | 'rejected'
  detail: string
  bytes?: number | null
  content?: string | null
}

export interface ChatRecord extends StepBase {
  kind: 'chat'
  text: string
  chatId: number | null
}

export interface TaskRecord extends StepBase, TaskFields {
  kind: 'task'
}

export interface ToolRecord extends StepBase {
  kind: 'tool'
  name: string
  args: Record<string, unknown>
}

export interface CompactRecord extends StepBase {
  kind: 'compact'
  text: string
}

export interface NoteRecord extends StepBase {
  kind: 'note'
  type: string
  text: string
}

export interface TurnErrorRecord extends StepBase {
  kind: 'turn_error'
  text: string
}

export interface IdleRecord extends StepBase {
  kind: 'idle'
}

export interface SpendRecord extends RecordBase {
  kind: 'spend'
  phase: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type StepRecord =
  | SayRecord
  | CommandRecord
  | FileRecord
  | ChatRecord
  | TaskRecord
  | ToolRecord
  | CompactRecord
  | NoteRecord
  | TurnErrorRecord
  | IdleRecord

export type TurnRecord = StepRecord | SpendRecord

export interface RoundTurn {
  index: number
  actor: string
  position: number
  records: TurnRecord[]
}

export interface RoundFile {
  format: number
  run: string
  round: number
  turns: RoundTurn[]
}

export interface RunListEntry {
  id: string
  title: string
  startTs: number | null
  endTs: number | null
  rounds: number
  turns: number
}

export interface RunList {
  format: number
  runs: RunListEntry[]
}
