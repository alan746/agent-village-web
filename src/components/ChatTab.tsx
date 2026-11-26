import { memo, useRef, type CSSProperties } from 'react'
import { useStickToBottom } from '../hooks/useStickToBottom'
import { formatClock, formatNumber } from '../format'
import type { ChatMessage, Manifest } from '../types'
import { accentVar } from '../state/village'
import { ClippedMarkdown } from './Markdown'

interface ChatTabProps {
  manifest: Manifest
  messages: ChatMessage[]
  onSeek: (step: number) => void
}

const ChatEntry = memo(function ChatEntry({
  message,
  accent,
  round,
  newest,
  onSeek,
}: {
  message: ChatMessage
  accent: string
  round: number | undefined
  newest: boolean
  onSeek: (step: number) => void
}) {
  return (
    <li
      className={`chat-message${newest ? ' is-newest' : ''}`}
      style={{ '--accent': accent } as CSSProperties}
    >
      <button
        type="button"
        className="chat-jump"
        onClick={() => onSeek(message.step)}
        title="Move the playhead to this message"
      >
        <span className="chat-actor">{message.actor}</span>
        <span className="chat-when">
          {round !== undefined && `round ${round} · `}
          {formatClock(message.ts)}
        </span>
      </button>
      <ClippedMarkdown text={message.content} maxLines={9} maxChars={1400} className="chat-text" />
    </li>
  )
})

export function ChatTab({ manifest, messages, onSeek }: ChatTabProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const onScroll = useStickToBottom(listRef, String(messages.length), manifest.id)
  const newestId = messages[messages.length - 1]?.eventId
  return (
    <div className="tab-scroll" ref={listRef} onScroll={onScroll}>
      <p className="tab-caption">
        {formatNumber(messages.length)} of {formatNumber(manifest.chat.length)} messages so far
      </p>
      {messages.length === 0 ? (
        <p className="tab-empty">Nobody has posted to the chat yet.</p>
      ) : (
        <ol className="chat-list">
          {messages.map((message) => (
            <ChatEntry
              key={message.eventId}
              message={message}
              accent={accentVar(manifest.villagers, message.actor)}
              round={manifest.turns[message.turn]?.round}
              newest={message.eventId === newestId}
              onSeek={onSeek}
            />
          ))}
        </ol>
      )}
    </div>
  )
}
