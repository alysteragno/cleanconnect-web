'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  children: React.ReactNode
  className?: string
  delay?: number   // ms — stagger child groups
  threshold?: number
}

export function ScrollReveal({ children, className = '', delay = 0, threshold = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return (
    <div
      ref={ref}
      style={{ animationDelay: delay ? `${delay}ms` : undefined }}
      className={`${visible ? 'animate-fade-in-up' : 'opacity-0'} ${className}`}
    >
      {children}
    </div>
  )
}
