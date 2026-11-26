import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'

const NEAR_BOTTOM_PX = 48

export function useStickToBottom(
  container: RefObject<HTMLElement | null>,
  contentKey: string,
  resetKey: string,
): () => void {
  const stuck = useRef(true)
  const lastReset = useRef(resetKey)

  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    if (lastReset.current !== resetKey) {
      lastReset.current = resetKey
      stuck.current = true
    }
    if (stuck.current) element.scrollTop = element.scrollHeight
  }, [container, contentKey, resetKey])

  return useCallback(() => {
    const element = container.current
    if (!element) return
    stuck.current = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM_PX
  }, [container])
}
