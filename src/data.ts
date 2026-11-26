import type { Manifest, RoundFile, RunList } from './types'

export const DATA_FORMAT = 1
const RUNS_ROOT = 'runs'

export class DataError extends Error {}

async function fetchJson(url: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    throw new DataError(`Could not reach ${url}. Check your connection and try again.`)
  }
  if (!response.ok) throw new DataError(`${url} answered with HTTP ${response.status}.`)
  try {
    return await response.json()
  } catch {
    throw new DataError(`${url} is not valid JSON. The file may be missing from the deployment.`)
  }
}

function checkFormat<T extends { format: number }>(value: unknown, url: string): T {
  const format = (value as { format?: unknown } | null)?.format
  if (format !== DATA_FORMAT) {
    throw new DataError(`${url} has data format ${String(format)}, but this viewer reads format ${DATA_FORMAT}. Export the run again.`)
  }
  return value as T
}

export function runPath(runId: string, file: string): string {
  return `${RUNS_ROOT}/${encodeURIComponent(runId)}/${file}`
}

export async function loadRunList(): Promise<RunList> {
  const url = `${RUNS_ROOT}/index.json`
  return checkFormat<RunList>(await fetchJson(url), url)
}

export async function loadManifest(runId: string): Promise<Manifest> {
  const url = runPath(runId, 'index.json')
  return checkFormat<Manifest>(await fetchJson(url), url)
}

export async function loadRound(runId: string, file: string): Promise<RoundFile> {
  const url = runPath(runId, file)
  return checkFormat<RoundFile>(await fetchJson(url), url)
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
