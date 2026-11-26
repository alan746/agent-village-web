import { memo, useMemo, type CSSProperties } from 'react'
import { TASK_STATUS_LABELS, countByStatus, type Task } from '../state/taskBoard'
import { accentVar } from '../state/village'
import type { Manifest } from '../types'
import { ClippedMarkdown } from './Markdown'

interface TasksTabProps {
  manifest: Manifest
  tasks: Task[]
  changedSince: number
  onSeek: (step: number) => void
}

function Who({ manifest, name }: { manifest: Manifest; name: string }) {
  return (
    <span className="who" style={{ '--accent': accentVar(manifest.villagers, name) } as CSSProperties}>
      <span className="panel-swatch" aria-hidden="true" />
      {name}
    </span>
  )
}

const TaskCard = memo(function TaskCard({
  manifest,
  task,
  changed,
  onSeek,
}: {
  manifest: Manifest
  task: Task
  changed: boolean
  onSeek: (step: number) => void
}) {
  return (
    <li className={`task-card is-${task.status}${changed ? ' is-changed' : ''}`}>
      <div className="task-head">
        <button type="button" className="task-id" onClick={() => onSeek(task.postedStep)} title="Jump to when it was posted">
          Task {task.id}
        </button>
        <span className={`task-status is-${task.status}`}>{TASK_STATUS_LABELS[task.status]}</span>
      </div>
      <ClippedMarkdown text={task.description} maxLines={4} maxChars={600} className="task-description" />
      <dl className="task-facts">
        <dt>Posted by</dt>
        <dd>
          <Who manifest={manifest} name={task.creator} />
        </dd>
        <dt>Workers</dt>
        <dd>
          {task.workers.length === 0 ? (
            <span className="muted">none yet</span>
          ) : (
            task.workers.map((worker) => <Who key={worker} manifest={manifest} name={worker} />)
          )}
          <span className="muted"> · up to {task.maxWorkers}</span>
        </dd>
      </dl>
      {task.submissions.length > 0 && (
        <ul className="submissions">
          {task.submissions.map((submission) => (
            <li key={submission.worker}>
              <div className="submission-head">
                <Who manifest={manifest} name={submission.worker} />
                <span className="muted">version {submission.version}</span>
                <button type="button" className="link-button" onClick={() => onSeek(submission.step)}>
                  jump
                </button>
              </div>
              <ClippedMarkdown text={submission.result} maxLines={4} maxChars={700} className="submission-text" />
            </li>
          ))}
        </ul>
      )}
    </li>
  )
})

export function TasksTab({ manifest, tasks, changedSince, onSeek }: TasksTabProps) {
  const counts = useMemo(() => countByStatus(tasks), [tasks])
  const newestFirst = useMemo(() => [...tasks].reverse(), [tasks])
  return (
    <div className="tab-scroll">
      <p className="tab-caption">
        {tasks.length} tasks, newest first · {counts.open} open · {counts.partly_taken + counts.full} in progress · {counts.done} done
      </p>
      {tasks.length === 0 ? (
        <p className="tab-empty">The task board is empty at this point.</p>
      ) : (
        <ol className="task-list">
          {newestFirst.map((task) => (
            <TaskCard
              key={task.id}
              manifest={manifest}
              task={task}
              changed={task.updatedStep >= changedSince}
              onSeek={onSeek}
            />
          ))}
        </ol>
      )}
    </div>
  )
}
