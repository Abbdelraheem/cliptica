'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Youtube, ArrowRight } from 'lucide-react'

const DEMO_URLS = [
  'youtube.com/watch?v=podcast-ep-42',
  'youtube.com/watch?v=lex-fridman-interview',
  'youtube.com/watch?v=huberman-lab-highlights',
]

export function PasteBar() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [urlIdx, setUrlIdx] = useState(0)

  useEffect(() => {
    if (isFocused || url) return
    const id = setInterval(() => {
      setUrlIdx((i) => (i + 1) % DEMO_URLS.length)
    }, 3200)
    return () => clearInterval(id)
  }, [isFocused, url])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const target = url.trim() || `https://${DEMO_URLS[urlIdx]}`
    router.push(`/register?videoUrl=${encodeURIComponent(target)}`)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="input-lux flex items-center gap-3 !rounded-2xl !py-1.5 pl-4 pr-1.5 shadow-2xl transition-all focus-within:!border-gold/50"
    >
      <Youtube className="h-5 w-5 shrink-0 text-[#FF0000]" />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={`https://${DEMO_URLS[urlIdx]}`}
        className="min-w-0 flex-1 bg-transparent font-mono text-xs text-pearl placeholder:text-mist-2 focus:outline-none sm:text-sm"
      />
      <button
        type="submit"
        className="btn-lux btn-primary shrink-0 !rounded-xl !px-5 !py-2.5 !text-sm cursor-pointer"
      >
        Get Clips
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  )
}
