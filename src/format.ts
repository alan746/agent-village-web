const integerFormat = new Intl.NumberFormat('en-US')

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatNumber(value: number): string {
  return integerFormat.format(value)
}

export function formatCompact(value: number): string {
  const size = Math.abs(value)
  if (size >= 1_000_000) return `${(value / 1_000_000).toFixed(size >= 10_000_000 ? 1 : 2)}M`
  if (size >= 10_000) return `${(value / 1_000).toFixed(size >= 100_000 ? 0 : 1)}k`
  return formatNumber(value)
}

export function formatClock(ts: number | null): string {
  if (ts === null) return '--:--:--'
  const date = new Date(ts * 1000)
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
}

export function formatDate(ts: number | null): string {
  if (ts === null) return 'unknown'
  const date = new Date(ts * 1000)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function formatDateTime(ts: number | null): string {
  return ts === null ? 'unknown' : `${formatDate(ts)} ${formatClock(ts)} UTC`
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return ''
  if (seconds < 10) return `${seconds.toFixed(2)} s`
  if (seconds < 60) return `${seconds.toFixed(1)} s`
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`
}

export function formatSpan(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return hours ? `${hours} h ${pad(minutes)} min` : `${minutes} min ${pad(total % 60)} s`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return ''
  if (bytes < 1024) return `${formatNumber(bytes)} bytes`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`
}

export function percent(part: number, whole: number | null): number {
  if (!whole || whole <= 0) return 0
  return Math.min(100, Math.max(0, (part / whole) * 100))
}
