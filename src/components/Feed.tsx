import { memo, useState } from 'react'
import { describeTask, fileVerb, firstLine, formatToolArgs } from '../state/describe'
import { formatBytes, formatClock } from '../format'
import type { ChatRecord, FileRecord, StepRecord, TaskRecord, ToolRecord } from '../types'
import { ClippedText } from './ClippedText'
import { CommandBlock } from './CommandBlock'
import { ClippedMarkdown } from './Markdown'
import { AlertIcon, BoardIcon, ChatIcon, FileReadIcon, FileWriteIcon, ToolIcon } from './Icons'

const PROSE_LINES = 24
const PROSE_CHARS = 4000
const QUOTE_LINES = 10
const QUOTE_CHARS = 1600
const CONTENT_LINES = 16
const CONTENT_CHARS = 3000

function Say({ text }: { text: string }) {
  return <ClippedMarkdown text={text} maxLines={PROSE_LINES} maxChars={PROSE_CHARS} className="say" />
}

function ChatPost({ record }: { record: ChatRecord }) {
  return (
    <div className="chat-post">
      <div className="line-label">
        <ChatIcon size={14} />
        <span>posted to chat</span>
      </div>
      <ClippedMarkdown text={record.text} maxLines={QUOTE_LINES} maxChars={QUOTE_CHARS} className="chat-post-text" />
    </div>
  )
}

function FileLine({ record }: { record: FileRecord }) {
  const [open, setOpen] = useState(false)
  const failed = record.status !== 'ok'
  const content = record.kind === 'write_file' ? record.content : null
  return (
    <div className={`one-liner${failed ? ' is-failed' : ''}`}>
      <div className="one-liner-row">
        {record.kind === 'read_file' ? <FileReadIcon size={14} /> : <FileWriteIcon size={14} />}
        <span className="one-liner-text">
          {fileVerb(record)} <code className="path">{record.path}</code>
        </span>
        {record.kind === 'write_file' && record.status === 'ok' && (
          <span className="one-liner-meta">{formatBytes(record.bytes)}</span>
        )}
        {content && (
          <button type="button" className="link-button" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'hide content' : 'show content'}
          </button>
        )}
      </div>
      {failed && record.detail && <div className="one-liner-detail">{firstLine(record.detail, 300)}</div>}
      {open && content && (
        <div className="file-content">
          <ClippedText text={content} maxLines={CONTENT_LINES} maxChars={CONTENT_CHARS} mono className="term-output" />
        </div>
      )}
    </div>
  )
}

function TaskLine({ record }: { record: TaskRecord }) {
  const body = record.action === 'post_task' ? record.description : record.action === 'submit_task' ? record.result : ''
  return (
    <div className={`one-liner${record.ok ? '' : ' is-failed'}`}>
      <div className="one-liner-row">
        <BoardIcon size={14} />
        <span className="one-liner-text">{describeTask(record)}</span>
        {record.action === 'submit_task' && record.ok && record.version && record.version > 1 && (
          <span className="one-liner-meta">version {record.version}</span>
        )}
      </div>
      {!record.ok && <div className="one-liner-detail">{record.outcome}</div>}
      {body && <ClippedMarkdown text={body} maxLines={3} maxChars={600} className="one-liner-body" />}
    </div>
  )
}

function ToolLine({ record }: { record: ToolRecord }) {
  const args = formatToolArgs(record.args)
  return (
    <div className="one-liner is-quiet">
      <div className="one-liner-row">
        <ToolIcon size={14} />
        <span className="one-liner-text">
          checked <code>{record.name}</code>
          {args && <span className="one-liner-meta"> {firstLine(args, 120)}</span>}
        </span>
      </div>
    </div>
  )
}

function Body({ record }: { record: StepRecord }) {
  switch (record.kind) {
    case 'say':
      return <Say text={record.text} />
    case 'command':
      return <CommandBlock record={record} />
    case 'chat':
      return <ChatPost record={record} />
    case 'read_file':
    case 'write_file':
      return <FileLine record={record} />
    case 'task':
      return <TaskLine record={record} />
    case 'tool':
      return <ToolLine record={record} />
    case 'compact':
      return (
        <div className="divider" role="separator">
          <span>memory compacted · {record.text}</span>
        </div>
      )
    case 'note':
      return (
        <div className="note">
          {record.type.replaceAll('_', ' ')}: {record.text}
        </div>
      )
    case 'turn_error':
      return (
        <div className="turn-error">
          <div className="line-label">
            <AlertIcon size={14} />
            <span>turn failed</span>
          </div>
          <ClippedText text={record.text} maxLines={8} maxChars={1500} mono className="turn-error-text" />
        </div>
      )
    case 'idle':
      return <div className="note">did nothing visible this turn</div>
  }
}

interface FeedItemProps {
  record: StepRecord
  current: boolean
}

export const FeedItem = memo(function FeedItem({ record, current }: FeedItemProps) {
  return (
    <li className={`feed-item kind-${record.kind}${current ? ' is-current' : ''}`} title={formatClock(record.ts) + ' UTC'}>
      <Body record={record} />
    </li>
  )
})
