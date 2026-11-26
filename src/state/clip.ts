export interface Clipped {
  text: string
  clipped: boolean
  totalLines: number
  hiddenLines: number
}

export function countLines(text: string): number {
  if (text === '') return 0
  let lines = 1
  for (let index = 0; index < text.length - 1; index += 1) {
    if (text.charCodeAt(index) === 10) lines += 1
  }
  return lines
}

function cutAtLine(text: string, maxLines: number): string {
  let position = -1
  for (let line = 0; line < maxLines; line += 1) {
    position = text.indexOf('\n', position + 1)
    if (position === -1) return text
  }
  return text.slice(0, position)
}

export function clipText(text: string, maxLines: number, maxChars: number): Clipped {
  const totalLines = countLines(text)
  let shown = cutAtLine(text, maxLines)
  if (shown.length > maxChars) shown = shown.slice(0, maxChars)
  const complete = shown.length === text.length || shown.length === text.replace(/\n$/, '').length
  if (complete) return { text, clipped: false, totalLines, hiddenLines: 0 }
  return { text: shown, clipped: true, totalLines, hiddenLines: Math.max(0, totalLines - countLines(shown)) }
}

export function shareLines(first: number, second: number, total: number, secondWants: number): [number, number] {
  const secondShare = Math.min(second, secondWants, total)
  const firstShare = Math.min(first, total - secondShare)
  return [firstShare, Math.min(second, total - firstShare)]
}
