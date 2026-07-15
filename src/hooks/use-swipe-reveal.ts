'use client'

import { useRef, useState } from 'react'

// Drives an iOS-Mail-style "swipe left to reveal an action" row gesture.
// Only meant for touch input — mouse/pointer users get the existing
// tap-to-reveal button instead, so this hook only wires up touch handlers.
const REVEAL_WIDTH = 76
const TRIGGER_RATIO = 0.5
const DRAG_INTENT_THRESHOLD = 8

export function useSwipeReveal() {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const baseX = useRef(0)
  const intent = useRef<'none' | 'horizontal' | 'vertical'>('none')

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    baseX.current = revealed ? -REVEAL_WIDTH : 0
    intent.current = 'none'
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    if (intent.current === 'none') {
      if (Math.abs(dx) < DRAG_INTENT_THRESHOLD && Math.abs(dy) < DRAG_INTENT_THRESHOLD) return
      intent.current = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      if (intent.current === 'horizontal') setDragging(true)
    }
    if (intent.current !== 'horizontal') return

    setDragX(Math.min(0, Math.max(-REVEAL_WIDTH, baseX.current + dx)))
  }

  function onTouchEnd() {
    if (intent.current === 'horizontal') {
      const shouldReveal = dragX < -REVEAL_WIDTH * TRIGGER_RATIO
      setRevealed(shouldReveal)
      setDragX(shouldReveal ? -REVEAL_WIDTH : 0)
    }
    setDragging(false)
    intent.current = 'none'
  }

  function close() {
    setRevealed(false)
    setDragX(0)
  }

  return {
    dragX,
    dragging,
    revealed,
    revealWidth: REVEAL_WIDTH,
    close,
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
  }
}
