import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown, parseMarkdownCached, type Block, type Inline, type Line, type ListBlock } from './markdown'
import { clipMarkdown, measureBlocks } from './markdownClip'

function inlineSource(node: Inline): string {
  switch (node.kind) {
    case 'text':
      return node.text
    case 'code':
      return node.fence + node.text + node.fence
    case 'strong':
    case 'emphasis':
      return node.marker + node.children.map(inlineSource).join('') + node.marker
    case 'link':
      return '[' + node.children.map(inlineSource).join('') + '](' + node.href + ')'
  }
}

function linesSource(lines: Line[]): string {
  return lines.map((line) => line.map(inlineSource).join('')).join('\n')
}

function listSource(list: ListBlock): string {
  return list.items
    .map((item) => [item.marker + ' ' + linesSource(item.lines), ...item.children.map(listSource)].join('\n'))
    .join('\n')
}

function blockSource(block: Block): string {
  switch (block.kind) {
    case 'paragraph':
      return linesSource(block.lines)
    case 'heading':
      return block.marker + ' ' + block.content.map(inlineSource).join('')
    case 'code':
      return [block.openFence, ...block.lines, block.closeFence ?? ''].join('\n')
    case 'list':
      return listSource(block)
  }
}

function sourceOf(blocks: Block[]): string {
  return blocks.map(blockSource).join('\n')
}

function withoutSpace(text: string): string {
  return text.replace(/\s+/g, '')
}

function text(value: string): Inline {
  return { kind: 'text', text: value }
}

function code(value: string): Inline {
  return { kind: 'code', fence: '`', text: value }
}

function strong(...children: Inline[]): Inline {
  return { kind: 'strong', marker: '**', children }
}

function emphasis(...children: Inline[]): Inline {
  return { kind: 'emphasis', marker: '*', children }
}

function paragraph(...lines: Line[]): Block {
  return { kind: 'paragraph', lines }
}

describe('inline markdown', () => {
  it('reads bold, italic and inline code', () => {
    expect(parseInline('a **bold** b')).toEqual([text('a '), strong(text('bold')), text(' b')])
    expect(parseInline('the *equal* bound')).toEqual([text('the '), emphasis(text('equal')), text(' bound')])
    expect(parseInline('run `./check.sh` now')).toEqual([text('run '), code('./check.sh'), text(' now')])
  })

  it('nests code and italic inside bold and italic around quotes', () => {
    expect(parseInline('**`gap == needed` boundary**')).toEqual([strong(code('gap == needed'), text(' boundary'))])
    expect(parseInline('**a *b* c**')).toEqual([strong(text('a '), emphasis(text('b')), text(' c'))])
    expect(parseInline('docs: *"always the best"*, which')).toEqual([
      text('docs: '),
      emphasis(text('"always the best"')),
      text(', which'),
    ])
  })

  it('keeps markers inside code spans literal', () => {
    expect(parseInline('sums `w_i * metric_i` and `2*(offset) mod 7`')).toEqual([
      text('sums '),
      code('w_i * metric_i'),
      text(' and '),
      code('2*(offset) mod 7'),
    ])
    expect(parseInline('``a ` b``')).toEqual([{ kind: 'code', fence: '``', text: 'a ` b' }])
    expect(parseInline('`**not bold**`')).toEqual([code('**not bold**')])
  })

  it('does not close emphasis inside a code span', () => {
    expect(parseInline('*a `b*` c*')).toEqual([emphasis(text('a '), code('b*'), text(' c'))])
  })

  it('never reads underscores as emphasis', () => {
    expect(parseInline('cmd_plan and _minutes and __main__ and _x_')).toEqual([
      text('cmd_plan and _minutes and __main__ and _x_'),
    ])
  })

  it('leaves lone, spaced and intraword asterisks alone', () => {
    for (const source of ['a * b * c', 'examples/*, tests/*', 'x*y*z', 'rm build/*', '2 * 3', '* not a list here*', '*.py and *.csv']) {
      expect(parseInline(source)).toEqual([text(source)])
    }
  })

  it('keeps unclosed markers as text', () => {
    expect(parseInline('**unclosed bold')).toEqual([text('**unclosed bold')])
    expect(parseInline('for the regression. `')).toEqual([text('for the regression. `')])
    expect(parseInline('*half')).toEqual([text('*half')])
    expect(parseInline('***triple***')).toEqual([text('***triple***')])
    expect(parseInline('** spaced **')).toEqual([text('** spaced **')])
  })

  it('links only http and https urls', () => {
    expect(parseInline('see [the docs](https://example.com/a?b=1) now')).toEqual([
      text('see '),
      { kind: 'link', href: 'https://example.com/a?b=1', children: [text('the docs')] },
      text(' now'),
    ])
    expect(parseInline('[x](http://example.com)')).toEqual([
      { kind: 'link', href: 'http://example.com', children: [text('x')] },
    ])
    for (const source of ['[x](javascript:alert(1))', '[x](ftp://host/file)', '[x](/relative)', '[x] (https://a.b)', 'list[Section]']) {
      expect(parseInline(source)).toEqual([text(source)])
    }
  })

  it('keeps raw html as text', () => {
    expect(parseInline('commit with `git commit <paths>` or <b>bold</b>')).toEqual([
      text('commit with '),
      code('git commit <paths>'),
      text(' or <b>bold</b>'),
    ])
  })
})

describe('block markdown', () => {
  it('splits paragraphs on blank lines and keeps single line breaks', () => {
    expect(parseMarkdown('one\ntwo\n\n\nthree')).toEqual([paragraph([text('one')], [text('two')]), paragraph([text('three')])])
    expect(parseMarkdown('')).toEqual([])
  })

  it('reads fenced code with and without a language', () => {
    expect(parseMarkdown('Repro:\n```\n$ ls *\n**x**\n```\nafter')).toEqual([
      paragraph([text('Repro:')]),
      { kind: 'code', language: '', openFence: '```', closeFence: '```', lines: ['$ ls *', '**x**'] },
      paragraph([text('after')]),
    ])
    expect(parseMarkdown('```python\nprint(1)\n```')).toEqual([
      { kind: 'code', language: 'python', openFence: '```python', closeFence: '```', lines: ['print(1)'] },
    ])
  })

  it('runs an unclosed fence to the end', () => {
    expect(parseMarkdown('```console\n$ a\n\n$ b')).toEqual([
      { kind: 'code', language: 'console', openFence: '```console', closeFence: null, lines: ['$ a', '', '$ b'] },
    ])
  })

  it('treats backticks on one line as inline code, not a fence', () => {
    expect(parseMarkdown('```x```')).toEqual([paragraph([{ kind: 'code', fence: '```', text: 'x' }])])
  })

  it('reads unordered and ordered lists, keeping the numbers', () => {
    const [list] = parseMarkdown('Intro:\n- a\n* b\n+ c').slice(1)
    expect(list).toEqual({
      kind: 'list',
      ordered: false,
      items: [
        { marker: '-', number: null, lines: [[text('a')]], children: [] },
        { marker: '*', number: null, lines: [[text('b')]], children: [] },
        { marker: '+', number: null, lines: [[text('c')]], children: [] },
      ],
    })
    const [ordered] = parseMarkdown('3. **x**\n4. y')
    expect(ordered).toEqual({
      kind: 'list',
      ordered: true,
      items: [
        { marker: '3.', number: 3, lines: [[strong(text('x'))]], children: [] },
        { marker: '4.', number: 4, lines: [[text('y')]], children: [] },
      ],
    })
  })

  it('nests one level and keeps indented continuation lines in the item', () => {
    const [list] = parseMarkdown('1. Task:\n   - first\n   - second\n     more\n2. Next\n   still next')
    expect(list).toEqual({
      kind: 'list',
      ordered: true,
      items: [
        {
          marker: '1.',
          number: 1,
          lines: [[text('Task:')]],
          children: [
            {
              kind: 'list',
              ordered: false,
              items: [
                { marker: '-', number: null, lines: [[text('first')]], children: [] },
                { marker: '-', number: null, lines: [[text('second')], [text('more')]], children: [] },
              ],
            },
          ],
        },
        { marker: '2.', number: 2, lines: [[text('Next')], [text('still next')]], children: [] },
      ],
    })
  })

  it('flattens deeper nesting into the first nested level', () => {
    const [list] = parseMarkdown('- a\n  - b\n    - c')
    expect(list?.kind === 'list' && list.items[0]?.children[0]?.items.map((item) => item.lines)).toEqual([
      [[text('b')]],
      [[text('c')]],
    ])
  })

  it('ends a list at a blank line or an unindented line', () => {
    expect(parseMarkdown('- a\nAll checks pass.').map((block) => block.kind)).toEqual(['list', 'paragraph'])
    expect(parseMarkdown('1. a\n\n2. b').map((block) => block.kind)).toEqual(['list', 'list'])
    expect(parseMarkdown('- a\n1. b').map((block) => block.kind)).toEqual(['list', 'list'])
  })

  it('does not read flags or numbers as list items', () => {
    expect(parseMarkdown('--top 3\n-1 is invalid\n2026-01-05 is a Monday\n1.5 hours')).toEqual([
      paragraph([text('--top 3')], [text('-1 is invalid')], [text('2026-01-05 is a Monday')], [text('1.5 hours')]),
    ])
  })

  it('reads headings compactly and needs a space after the hashes', () => {
    expect(parseMarkdown('## Plan\n#1 3 day(s)')).toEqual([
      { kind: 'heading', marker: '##', level: 2, content: [text('Plan')] },
      paragraph([text('#1 3 day(s)')]),
    ])
    expect(parseMarkdown('####### seven')).toEqual([paragraph([text('####### seven')])])
  })

  it('leaves blockquotes, tables and rules as text', () => {
    expect(parseMarkdown('> quoted\n| a | b |\n|---|---|\n---')).toEqual([
      paragraph([text('> quoted')], [text('| a | b |')], [text('|---|---|')], [text('---')]),
    ])
  })

  it('caches parses by text', () => {
    expect(parseMarkdownCached('**same**')).toBe(parseMarkdownCached('**same**'))
  })
})

describe('clipping markdown', () => {
  const source = 'Intro line\n```\nl1\nl2\nl3\nl4\n```\n- **a**\n- b'

  it('leaves short text whole', () => {
    const blocks = parseMarkdown(source)
    expect(clipMarkdown(blocks, 20, 1000)).toEqual({ blocks, clipped: false, hiddenLines: 0 })
  })

  it('cuts inside a code block without breaking it', () => {
    const clipped = clipMarkdown(parseMarkdown(source), 3, 1000)
    expect(clipped.clipped).toBe(true)
    expect(clipped.hiddenLines).toBe(4)
    expect(clipped.blocks).toEqual([
      paragraph([text('Intro line')]),
      { kind: 'code', language: '', openFence: '```', closeFence: '```', lines: ['l1', 'l2'] },
    ])
  })

  it('cuts by characters inside formatting and keeps the formatting', () => {
    const clipped = clipMarkdown(parseMarkdown('**abcdef** tail'), 10, 3)
    expect(clipped).toEqual({ blocks: [paragraph([strong(text('abc'))])], clipped: true, hiddenLines: 0 })
  })

  it('cuts inside lists and nested lists', () => {
    const clipped = clipMarkdown(parseMarkdown('1. a\n   - b\n   - c\n2. d'), 2, 1000)
    expect(clipped.hiddenLines).toBe(2)
    expect(sourceOf(clipped.blocks)).toBe('1. a\n- b')
  })

  it('measures lines and characters of the rendered text', () => {
    expect(measureBlocks(parseMarkdown('**ab**\n\n```\ncd\n```'))).toEqual({ lines: 2, chars: 4 })
  })
})

const manifests = import.meta.glob<unknown>('../../public/runs/*/index.json', { eager: true, import: 'default' })
const rounds = import.meta.glob<unknown>('../../public/runs/*/rounds/*.json', { eager: true, import: 'default' })

interface ProseSource {
  kind?: string
  text?: string
  content?: string
  description?: string
  result?: string
}

interface ExportFile {
  chat?: ProseSource[]
  taskEvents?: ProseSource[]
  turns?: { records?: ProseSource[] }[]
}

function proseOf(record: ProseSource): (string | undefined)[] {
  if (record.kind === 'say' || record.kind === 'chat') return [record.text]
  if (record.kind === 'task') return [record.description, record.result]
  if (record.kind === undefined) return [record.content, record.description, record.result]
  return []
}

function exportedProse(): string[] {
  const files = [...Object.values(manifests), ...Object.values(rounds)] as ExportFile[]
  const records = files.flatMap((file) => [
    ...(file.chat ?? []),
    ...(file.taskEvents ?? []),
    ...(file.turns ?? []).flatMap((turn) => turn.records ?? []),
  ])
  return records.flatMap(proseOf).filter((value): value is string => typeof value === 'string' && value !== '')
}

describe('exported example run', () => {
  const texts = exportedProse()

  it('finds the prose of the example run', () => {
    expect(texts.length).toBeGreaterThan(400)
  })

  it('loses no character of any text apart from recognised markers', () => {
    for (const source of texts) {
      expect(withoutSpace(sourceOf(parseMarkdown(source)))).toBe(withoutSpace(source))
    }
  })

  it('clips every text within its line and character limits', () => {
    for (const source of texts) {
      const blocks = parseMarkdown(source)
      const clipped = clipMarkdown(blocks, 4, 300)
      const shown = measureBlocks(clipped.blocks)
      expect(shown.lines).toBeLessThanOrEqual(4)
      expect(shown.chars).toBeLessThanOrEqual(300)
    }
  })
})
