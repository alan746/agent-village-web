import type { ReactNode } from 'react'

interface IconProps {
  size?: number
  className?: string
}

function Svg({ size = 16, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function PlayIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 3.2v9.6l7.6-4.8z" fill="currentColor" />
    </Svg>
  )
}

export function PauseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 3.5v9M11 3.5v9" strokeWidth="2.2" />
    </Svg>
  )
}

export function StepBackIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10.5 3.5 6 8l4.5 4.5" />
    </Svg>
  )
}

export function StepForwardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5.5 3.5 10 8l-4.5 4.5" />
    </Svg>
  )
}

export function TurnBackIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 3.5v9M12.5 3.5 7.5 8l5 4.5" />
    </Svg>
  )
}

export function TurnForwardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.5 3.5v9M3.5 3.5 8.5 8l-5 4.5" />
    </Svg>
  )
}

export function ExpandIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" />
    </Svg>
  )
}

export function CollapseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.5 6.5h-4v-4M2.5 9.5h4v4M9.5 6.5l4-4M6.5 9.5l-4 4" />
    </Svg>
  )
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
    </Svg>
  )
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z" />
    </Svg>
  )
}

export function LinkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2.2-2.2a2.6 2.6 0 0 0-3.7-3.7l-.9.9" />
      <path d="M9.2 6.8a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9" />
    </Svg>
  )
}

export function FileReadIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 1.8h5l3 3v9.4H4z" />
      <path d="M6.3 8.5h3.4M6.3 11h3.4" />
    </Svg>
  )
}

export function FileWriteIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8.5 14.2H4V1.8h5l3 3v2.7" />
      <path d="m9.6 13.6 4-4-1.3-1.3-4 4-.4 1.7z" />
    </Svg>
  )
}

export function BoardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
      <path d="M6 2.5v11M10 2.5v11" />
    </Svg>
  )
}

export function ChatIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2.5 3.5h11v7.2H7.2L4 13.2v-2.5H2.5z" />
    </Svg>
  )
}

export function ToolIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="7" cy="7" r="3.6" />
      <path d="m9.7 9.7 3.6 3.6" />
    </Svg>
  )
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M8 2 14.5 13.5h-13z" />
      <path d="M8 6.5v3.2M8 11.6v.1" />
    </Svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m3.5 8.5 3 3 6-7" />
    </Svg>
  )
}

export function FlagIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 14.5v-12M3.5 2.8h8.2l-1.8 3 1.8 3H3.5" />
    </Svg>
  )
}

export function MarkIcon(props: IconProps) {
  return (
    <svg
      className={props.className}
      width={props.size ?? 20}
      height={props.size ?? 20}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="8" height="8" rx="2" fill="var(--v0)" />
      <rect x="11" y="1" width="8" height="8" rx="2" fill="var(--v1)" />
      <rect x="1" y="11" width="8" height="8" rx="2" fill="var(--v2)" />
      <rect x="11" y="11" width="8" height="8" rx="2" fill="var(--v3)" />
    </svg>
  )
}
