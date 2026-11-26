import type { FileRecord, StepRecord, TaskRecord } from '../types'

const SUMMARY_LIMIT = 96

const TASK_VERBS: Record<TaskRecord['action'], string> = {
  post_task: 'posted task',
  take_task: 'took task',
  submit_task: 'submitted to task',
  done_task: 'marked done task',
}

const TASK_ATTEMPTS: Record<TaskRecord['action'], string> = {
  post_task: 'tried to post a task',
  take_task: 'tried to take task',
  submit_task: 'tried to submit to task',
  done_task: 'tried to mark done task',
}

export function firstLine(text: string, limit = SUMMARY_LIMIT): string {
  const line = text.trim().split('\n', 1)[0] ?? ''
  return line.length > limit ? `${line.slice(0, limit - 1).trimEnd()}…` : line
}

export function describeFile(record: FileRecord): string {
  const verb = record.kind === 'read_file' ? 'read' : 'write'
  if (record.status === 'rejected') return `${verb} of ${record.path} rejected`
  if (record.status === 'failed') return `${verb} of ${record.path} failed`
  return `${record.kind === 'read_file' ? 'read' : 'wrote'} ${record.path}`
}

export function describeTask(record: Pick<TaskRecord, 'action' | 'ok' | 'taskId'>): string {
  const verb = record.ok ? TASK_VERBS[record.action] : TASK_ATTEMPTS[record.action]
  return record.taskId === null ? verb : `${verb} ${record.taskId}`
}

export function formatToolArgs(args: Record<string, unknown>): string {
  return Object.entries(args)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(', ')
}

export function describeRecord(record: StepRecord): string {
  switch (record.kind) {
    case 'say':
      return firstLine(record.text)
    case 'command':
      return `$ ${firstLine(record.command)}`
    case 'read_file':
    case 'write_file':
      return describeFile(record)
    case 'chat':
      return `posted to chat: ${firstLine(record.text, SUMMARY_LIMIT - 16)}`
    case 'task':
      return describeTask(record)
    case 'tool':
      return `checked ${record.name}`
    case 'compact':
      return 'memory compacted'
    case 'note':
      return record.type.replaceAll('_', ' ')
    case 'turn_error':
      return `turn failed: ${firstLine(record.text, SUMMARY_LIMIT - 13)}`
    case 'idle':
      return 'did nothing visible this turn'
  }
}

export function fileVerb(record: FileRecord): string {
  const verb = record.kind === 'read_file' ? 'read' : 'write'
  if (record.status === 'rejected') return `${verb} rejected`
  if (record.status === 'failed') return `${verb} failed`
  return record.kind === 'read_file' ? 'read' : 'wrote'
}
