import type { Block, Inline, Line, ListBlock, ListItem } from './markdown'

export interface ClippedBlocks {
  blocks: Block[]
  clipped: boolean
  hiddenLines: number
}

interface Budget {
  lines: number
  chars: number
}

interface Size {
  lines: number
  chars: number
}

function exhausted(budget: Budget): boolean {
  return budget.lines <= 0 || budget.chars <= 0
}

function clipInlines(nodes: Inline[], budget: Budget): Inline[] {
  const kept: Inline[] = []
  for (const node of nodes) {
    if (budget.chars <= 0) break
    if (node.kind === 'text' || node.kind === 'code') {
      kept.push({ ...node, text: node.text.slice(0, budget.chars) })
      budget.chars -= node.text.length
    } else {
      kept.push({ ...node, children: clipInlines(node.children, budget) })
    }
  }
  return kept
}

function clipLines(lines: Line[], budget: Budget): Line[] {
  const kept: Line[] = []
  for (const line of lines) {
    if (exhausted(budget)) break
    budget.lines -= 1
    kept.push(clipInlines(line, budget))
  }
  return kept
}

function clipCode(lines: string[], budget: Budget): string[] {
  const kept: string[] = []
  for (const line of lines) {
    if (exhausted(budget)) break
    budget.lines -= 1
    kept.push(line.slice(0, budget.chars))
    budget.chars -= line.length
  }
  return kept
}

function clipItem(item: ListItem, budget: Budget): ListItem {
  const lines = clipLines(item.lines, budget)
  const children: ListBlock[] = []
  for (const child of item.children) {
    if (exhausted(budget)) break
    children.push(clipList(child, budget))
  }
  return { ...item, lines, children }
}

function clipList(list: ListBlock, budget: Budget): ListBlock {
  const items: ListItem[] = []
  for (const item of list.items) {
    if (exhausted(budget)) break
    items.push(clipItem(item, budget))
  }
  return { ...list, items }
}

function clipBlock(block: Block, budget: Budget): Block {
  switch (block.kind) {
    case 'paragraph':
      return { ...block, lines: clipLines(block.lines, budget) }
    case 'heading':
      budget.lines -= 1
      return { ...block, content: clipInlines(block.content, budget) }
    case 'code':
      return { ...block, lines: clipCode(block.lines, budget) }
    case 'list':
      return clipList(block, budget)
  }
}

function clipBlocks(blocks: Block[], budget: Budget): Block[] {
  const kept: Block[] = []
  for (const block of blocks) {
    if (exhausted(budget)) break
    kept.push(clipBlock(block, budget))
  }
  return kept
}

function addInlines(nodes: Inline[], size: Size): void {
  for (const node of nodes) {
    if (node.kind === 'text' || node.kind === 'code') size.chars += node.text.length
    else addInlines(node.children, size)
  }
}

function addLines(lines: Line[], size: Size): void {
  size.lines += lines.length
  for (const line of lines) addInlines(line, size)
}

function addBlocks(blocks: Block[], size: Size): void {
  for (const block of blocks) {
    if (block.kind === 'paragraph') addLines(block.lines, size)
    if (block.kind === 'heading') addLines([block.content], size)
    if (block.kind === 'code') {
      size.lines += block.lines.length
      for (const line of block.lines) size.chars += line.length
    }
    if (block.kind === 'list') {
      for (const item of block.items) {
        addLines(item.lines, size)
        addBlocks(item.children, size)
      }
    }
  }
}

export function measureBlocks(blocks: Block[]): Size {
  const size = { lines: 0, chars: 0 }
  addBlocks(blocks, size)
  return size
}

export function clipMarkdown(blocks: Block[], maxLines: number, maxChars: number): ClippedBlocks {
  const total = measureBlocks(blocks)
  const kept = clipBlocks(blocks, { lines: maxLines, chars: maxChars })
  const shown = measureBlocks(kept)
  if (shown.lines >= total.lines && shown.chars >= total.chars) return { blocks, clipped: false, hiddenLines: 0 }
  return { blocks: kept, clipped: true, hiddenLines: total.lines - shown.lines }
}
