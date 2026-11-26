export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; fence: string; text: string }
  | { kind: 'strong'; marker: string; children: Inline[] }
  | { kind: 'emphasis'; marker: string; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] }

export type Line = Inline[]

export interface ListItem {
  marker: string
  number: number | null
  lines: Line[]
  children: ListBlock[]
}

export interface ListBlock {
  kind: 'list'
  ordered: boolean
  items: ListItem[]
}

export type Block =
  | { kind: 'paragraph'; lines: Line[] }
  | { kind: 'heading'; marker: string; level: number; content: Line }
  | { kind: 'code'; language: string; openFence: string; closeFence: string | null; lines: string[] }
  | ListBlock

interface Parsed {
  block: Block
  next: number
}

interface ItemStart {
  indent: number
  marker: string
  content: string
}

const FENCE_OPEN = /^( {0,3})(`{3,})([^`]*)$/
const FENCE_CLOSE = /^ {0,3}(`{3,})\s*$/
const HEADING = /^ {0,3}(#{1,6})[ \t]+(\S.*)$/
const LIST_ITEM = /^( *)([-*+]|\d{1,9}[.)]) +(\S.*)$/
const LINK = /^\[([^[\]\n]+)\]\((https?:\/\/[^\s()<>]+)\)/i
const NO_OPEN_AFTER = ',.;:!?)]}'
const NO_CLOSE_BEFORE = '([{'

function isBlank(line: string): boolean {
  return line.trim() === ''
}

function isSpace(char: string | undefined): boolean {
  return char !== undefined && /\s/.test(char)
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}]/u.test(char)
}

function runLength(text: string, start: number, char: string): number {
  let end = start
  while (text[end] === char) end += 1
  return end - start
}

function findRun(text: string, from: number, char: string, length: number): number {
  let index = from
  while (index < text.length) {
    if (text[index] !== char) {
      index += 1
      continue
    }
    const run = runLength(text, index, char)
    if (run === length) return index
    index += run
  }
  return -1
}

function skipCodeSpan(text: string, start: number): number {
  const run = runLength(text, start, '`')
  const close = findRun(text, start + run, '`', run)
  return close === -1 ? start + run : close + run
}

function canOpen(text: string, start: number, length: number): boolean {
  const before = text[start - 1]
  const after = text[start + length]
  if (after === undefined || isSpace(after) || after === '*' || NO_OPEN_AFTER.includes(after)) return false
  return before !== '*' && !isWordChar(before)
}

function canClose(text: string, start: number, length: number): boolean {
  const before = text[start - 1]
  const after = text[start + length]
  if (before === undefined || isSpace(before) || before === '*' || NO_CLOSE_BEFORE.includes(before)) return false
  return after !== '*' && !isWordChar(after)
}

function findCloser(text: string, from: number, length: number): number {
  let index = from
  while (index < text.length) {
    const char = text[index]
    if (char === '`') {
      index = skipCodeSpan(text, index)
    } else if (char === '*') {
      const run = runLength(text, index, '*')
      if (run === length && canClose(text, index, length)) return index
      index += run
    } else {
      index += 1
    }
  }
  return -1
}

interface Span {
  node: Inline
  end: number
}

function matchCode(text: string, start: number): Span {
  const run = runLength(text, start, '`')
  const fence = text.slice(start, start + run)
  const close = findRun(text, start + run, '`', run)
  if (close === -1) return { node: { kind: 'text', text: fence }, end: start + run }
  return { node: { kind: 'code', fence, text: text.slice(start + run, close) }, end: close + run }
}

function matchStars(text: string, start: number): Span {
  const run = runLength(text, start, '*')
  const marker = text.slice(start, start + run)
  const literal: Span = { node: { kind: 'text', text: marker }, end: start + run }
  if (run > 2 || !canOpen(text, start, run)) return literal
  const close = findCloser(text, start + run, run)
  if (close === -1) return literal
  const children = parseInline(text.slice(start + run, close))
  const kind = run === 2 ? 'strong' : 'emphasis'
  return { node: { kind, marker, children }, end: close + run }
}

function matchLink(text: string, start: number): Span | null {
  const match = LINK.exec(text.slice(start))
  if (!match) return null
  const [whole, label = '', href = ''] = match
  return { node: { kind: 'link', href, children: parseInline(label) }, end: start + whole.length }
}

function matchSpan(text: string, start: number): Span | null {
  const char = text[start]
  if (char === '`') return matchCode(text, start)
  if (char === '*') return matchStars(text, start)
  if (char === '[') return matchLink(text, start)
  return null
}

export function parseInline(text: string): Line {
  const nodes: Inline[] = []
  let plain = ''
  let index = 0
  while (index < text.length) {
    const span = matchSpan(text, index)
    if (!span) {
      plain += text[index]
      index += 1
      continue
    }
    if (span.node.kind === 'text') {
      plain += span.node.text
    } else {
      if (plain) nodes.push({ kind: 'text', text: plain })
      plain = ''
      nodes.push(span.node)
    }
    index = span.end
  }
  if (plain) nodes.push({ kind: 'text', text: plain })
  return nodes
}

function matchItem(line: string): ItemStart | null {
  const match = LIST_ITEM.exec(line)
  if (!match) return null
  const [, indent = '', marker = '', content = ''] = match
  return { indent: indent.length, marker, content }
}

function isOrderedMarker(marker: string): boolean {
  return /\d/.test(marker)
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length
}

function startsBlock(line: string): boolean {
  return FENCE_OPEN.test(line) || HEADING.test(line) || matchItem(line) !== null
}

function parseFence(lines: string[], start: number): Parsed | null {
  const open = FENCE_OPEN.exec(lines[start] ?? '')
  if (!open) return null
  const length = open[2]?.length ?? 3
  const language = (open[3] ?? '').trim().split(/\s+/)[0] ?? ''
  const body: string[] = []
  let index = start + 1
  while (index < lines.length) {
    const line = lines[index] ?? ''
    const close = FENCE_CLOSE.exec(line)
    if (close && (close[1]?.length ?? 0) >= length) {
      const block: Block = { kind: 'code', language, openFence: lines[start] ?? '', closeFence: line, lines: body }
      return { block, next: index + 1 }
    }
    body.push(line)
    index += 1
  }
  return { block: { kind: 'code', language, openFence: lines[start] ?? '', closeFence: null, lines: body }, next: index }
}

function parseHeading(lines: string[], start: number): Parsed | null {
  const match = HEADING.exec(lines[start] ?? '')
  if (!match) return null
  const [, marker = '', content = ''] = match
  return { block: { kind: 'heading', marker, level: marker.length, content: parseInline(content) }, next: start + 1 }
}

function newItem(start: ItemStart): ListItem {
  const number = isOrderedMarker(start.marker) ? Number.parseInt(start.marker, 10) : null
  return { marker: start.marker, number, lines: [parseInline(start.content)], children: [] }
}

function addNestedItem(parent: ListItem, start: ItemStart): void {
  const ordered = isOrderedMarker(start.marker)
  const last = parent.children[parent.children.length - 1]
  if (last && last.ordered === ordered) {
    last.items.push(newItem(start))
  } else {
    parent.children.push({ kind: 'list', ordered, items: [newItem(start)] })
  }
}

function addContinuation(parent: ListItem, text: string): void {
  const nested = parent.children[parent.children.length - 1]?.items
  const target = nested?.[nested.length - 1] ?? parent
  target.lines.push(parseInline(text.trimStart()))
}

function parseList(lines: string[], start: number): Parsed | null {
  const first = matchItem(lines[start] ?? '')
  if (!first) return null
  const ordered = isOrderedMarker(first.marker)
  const items: ListItem[] = [newItem(first)]
  let index = start + 1
  while (index < lines.length) {
    const line = lines[index] ?? ''
    const last = items[items.length - 1]
    if (!last || isBlank(line)) break
    const item = matchItem(line)
    const deeper = indentOf(line) > first.indent + 1
    if (item && deeper) addNestedItem(last, item)
    else if (deeper) addContinuation(last, line)
    else if (item && isOrderedMarker(item.marker) === ordered) items.push(newItem(item))
    else break
    index += 1
  }
  return { block: { kind: 'list', ordered, items }, next: index }
}

function parseParagraph(lines: string[], start: number): Parsed {
  const body: Line[] = [parseInline(lines[start] ?? '')]
  let index = start + 1
  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (isBlank(line) || startsBlock(line)) break
    body.push(parseInline(line))
    index += 1
  }
  return { block: { kind: 'paragraph', lines: body }, next: index }
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.split(/\r?\n/)
  const blocks: Block[] = []
  let index = 0
  while (index < lines.length) {
    if (isBlank(lines[index] ?? '')) {
      index += 1
      continue
    }
    const parsed =
      parseFence(lines, index) ?? parseHeading(lines, index) ?? parseList(lines, index) ?? parseParagraph(lines, index)
    blocks.push(parsed.block)
    index = parsed.next
  }
  return blocks
}

const CACHE_LIMIT = 2000
const cache = new Map<string, Block[]>()

export function parseMarkdownCached(source: string): Block[] {
  const known = cache.get(source)
  if (known) return known
  const blocks = parseMarkdown(source)
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(source, blocks)
  return blocks
}
