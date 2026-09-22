'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function TopLoader() {
  return (
    <Suspense fallback={null}>
      <TopLoaderInner />
    </Suspense>
  )
}

function TopLoaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Complete transition when pathname or searchParams change
  useEffect(() => {
    if (loading) {
      setProgress(100)
      if (timerRef.current) clearInterval(timerRef.current)
      fadeTimerRef.current = setTimeout(() => {
        setVisible(false)
        setLoading(false)
        setProgress(0)
      }, 300)
    }
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [pathname, searchParams])

  // Intercept navigation link clicks across the entire app
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target || !target.href) return

      // Ignore new tabs, external links, anchor fragments, and downloads
      if (target.target === '_blank' || target.rel?.includes('external')) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      try {
        const url = new URL(target.href)
        const currentUrl = new URL(window.location.href)

        // Only trigger for same-origin navigation to different routes
        if (
          url.origin === currentUrl.origin &&
          (url.pathname !== currentUrl.pathname || url.search !== currentUrl.search)
        ) {
          if (timerRef.current) clearInterval(timerRef.current)
          if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)

          setVisible(true)
          setLoading(true)
          setProgress(15)

          // Smooth progress trickle
          timerRef.current = setInterval(() => {
            setProgress((prev) => {
              if (prev < 60) return prev + Math.random() * 18
              if (prev < 85) return prev + Math.random() * 6
              if (prev < 94) return prev + 0.8
              return prev
            })
          }, 180)
        }
      } catch {
        // Fallback for invalid URLs
      }
    }

    document.addEventListener('click', handleAnchorClick, { capture: true })
    return () => {
      document.removeEventListener('click', handleAnchorClick, { capture: true })
      if (timerRef.current) clearInterval(timerRef.current)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-0 right-0 top-0 z-[99999] h-[3px] overflow-hidden transition-opacity duration-300"
      style={{ opacity: progress === 100 ? 0 : 1 }}
    >
      <div
        className="h-full bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FF5A1F] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: progress === 100 ? '200ms' : '300ms',
          boxShadow: '0 0 12px rgba(255, 215, 0, 0.8), 0 0 6px rgba(255, 90, 31, 0.6)',
        }}
      >
        {/* Glow peg at head of bar */}
        <div className="absolute right-0 top-0 h-full w-24 -translate-y-0.5 transform bg-white/40 blur-sm" />
      </div>
    </div>
  )
}
