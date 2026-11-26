import { Fragment, useMemo, useState } from 'react'
import type { Block, Inline, Line, ListBlock } from '../state/markdown'
import { parseMarkdownCached } from '../state/markdown'
import { clipMarkdown } from '../state/markdownClip'
import { ExpandButton } from './ClippedText'

function InlineNode({ node }: { node: Inline }) {
  switch (node.kind) {
    case 'text':
      return node.text
    case 'code':
      return <code className="md-code-inline">{node.text}</code>
    case 'strong':
      return (
        <strong>
          <Inlines nodes={node.children} />
        </strong>
      )
    case 'emphasis':
      return (
        <em>
          <Inlines nodes={node.children} />
        </em>
      )
    case 'link':
      return (
        <a href={node.href} target="_blank" rel="noopener noreferrer">
          <Inlines nodes={node.children} />
        </a>
      )
  }
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return nodes.map((node, index) => <InlineNode key={index} node={node} />)
}

function Lines({ lines }: { lines: Line[] }) {
  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      <Inlines nodes={line} />
    </Fragment>
  ))
}

function List({ list }: { list: ListBlock }) {
  const items = list.items.map((item, index) => (
    <li key={index} value={item.number ?? undefined}>
      <Lines lines={item.lines} />
      {item.children.map((child, childIndex) => (
        <List key={childIndex} list={child} />
      ))}
    </li>
  ))
  return list.ordered ? <ol className="md-list">{items}</ol> : <ul className="md-list">{items}</ul>
}

function BlockNode({ block }: { block: Block }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <p className="md-paragraph">
          <Lines lines={block.lines} />
        </p>
      )
    case 'heading':
      return (
        <p className={`md-heading md-heading-${block.level}`}>
          <Inlines nodes={block.content} />
        </p>
      )
    case 'code':
      return (
        <pre className="md-code-block" data-language={block.language || undefined}>
          <code>{block.lines.join('\n')}</code>
        </pre>
      )
    case 'list':
      return <List list={block} />
  }
}

function MarkdownBlocks({ blocks }: { blocks: Block[] }) {
  return blocks.map((block, index) => <BlockNode key={index} block={block} />)
}

interface ClippedMarkdownProps {
  text: string
  maxLines: number
  maxChars: number
  className: string
}

export function ClippedMarkdown({ text, maxLines, maxChars, className }: ClippedMarkdownProps) {
  const [expanded, setExpanded] = useState(false)
  const blocks = useMemo(() => parseMarkdownCached(text), [text])
  const clipped = useMemo(() => clipMarkdown(blocks, maxLines, maxChars), [blocks, maxLines, maxChars])
  return (
    <>
      <div className={`markdown ${className}`}>
        <MarkdownBlocks blocks={expanded ? blocks : clipped.blocks} />
      </div>
      {clipped.clipped && (
        <ExpandButton expanded={expanded} hiddenLines={clipped.hiddenLines} onToggle={() => setExpanded(!expanded)} />
      )}
    </>
  )
}
