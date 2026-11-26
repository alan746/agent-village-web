import type { TaskEvent } from '../types'

export type TaskStatus = 'open' | 'partly_taken' | 'full' | 'done'

export interface Submission {
  worker: string
  result: string
  version: number
  step: number
}

export interface Task {
  id: number
  creator: string
  description: string
  maxWorkers: number
  workers: string[]
  submissions: Submission[]
  done: boolean
  status: TaskStatus
  postedStep: number
  updatedStep: number
}

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'open',
  partly_taken: 'in progress, can take more workers',
  full: 'in progress, full',
  done: 'done',
}

function statusOf(task: Task): TaskStatus {
  if (task.done) return 'done'
  if (task.workers.length === 0) return 'open'
  return task.workers.length < task.maxWorkers ? 'partly_taken' : 'full'
}

function submit(task: Task, event: TaskEvent): void {
  const previous = task.submissions.find((submission) => submission.worker === event.actor)
  const version = event.version ?? (previous ? previous.version + 1 : 1)
  const submission = { worker: event.actor, result: event.result ?? '', version, step: event.step }
  task.submissions = previous
    ? task.submissions.map((entry) => (entry === previous ? submission : entry))
    : [...task.submissions, submission]
}

function apply(tasks: Map<number, Task>, event: TaskEvent): void {
  if (!event.ok || event.taskId === null) return
  if (event.action === 'post_task') {
    tasks.set(event.taskId, {
      id: event.taskId,
      creator: event.actor,
      description: event.description ?? '',
      maxWorkers: event.maxWorkers ?? 1,
      workers: [],
      submissions: [],
      done: false,
      status: 'open',
      postedStep: event.step,
      updatedStep: event.step,
    })
    return
  }
  const task = tasks.get(event.taskId)
  if (!task) return
  if (event.action === 'take_task' && !task.workers.includes(event.actor)) task.workers = [...task.workers, event.actor]
  if (event.action === 'submit_task') submit(task, event)
  if (event.action === 'done_task') task.done = true
  task.updatedStep = event.step
}

export function boardAt(events: readonly TaskEvent[], step: number): Task[] {
  const tasks = new Map<number, Task>()
  for (const event of events) {
    if (event.step > step) break
    apply(tasks, event)
  }
  return [...tasks.values()]
    .map((task) => ({ ...task, status: statusOf(task) }))
    .sort((left, right) => left.id - right.id)
}

export function countByStatus(tasks: readonly Task[]): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = { open: 0, partly_taken: 0, full: 0, done: 0 }
  for (const task of tasks) counts[task.status] += 1
  return counts
}
