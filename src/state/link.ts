export interface Link {
  run?: string
  round?: number
  turn?: number
  step?: number
}

function positiveInteger(value: string | null): number | undefined {
  if (value === null || !/^\d+$/.test(value)) return undefined
  const parsed = Number(value)
  return parsed >= 1 ? parsed : undefined
}

export function parseLink(hash: string): Link {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const link: Link = {}
  const run = params.get('run')
  if (run) link.run = run
  const round = positiveInteger(params.get('round'))
  if (round === undefined) return link
  link.round = round
  link.turn = positiveInteger(params.get('turn')) ?? 1
  const step = positiveInteger(params.get('step'))
  if (step !== undefined) link.step = step
  return link
}

export function formatLink(link: Link): string {
  const params = new URLSearchParams()
  if (link.run) params.set('run', link.run)
  if (link.round !== undefined) {
    params.set('round', String(link.round))
    params.set('turn', String(link.turn ?? 1))
    if (link.step !== undefined) params.set('step', String(link.step))
  }
  const text = params.toString()
  return text ? `#${text}` : ''
}

export function sameLink(left: Link, right: Link): boolean {
  return formatLink(left) === formatLink(right)
}
