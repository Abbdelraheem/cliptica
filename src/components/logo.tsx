import Image from 'next/image'

export function ClipzilaMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Clipzila"
      width={size}
      height={size}
      priority
      className={`inline-block shrink-0 object-contain drop-shadow-[0_2px_10px_rgba(255,90,31,0.28)] ${className}`}
    />
  )
}

export const ClipticaMark = ClipzilaMark
export const NologyMark = ClipzilaMark

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ClipzilaMark size={size} />
      <span className="font-display text-lg font-extrabold tracking-[0.08em] bg-gradient-to-r from-white via-pearl to-champagne bg-clip-text text-transparent">
        CLIPZILA
      </span>
    </span>
  )
}
