export function ForgeLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#cfg-g)" />
      <path d="M12 9.5v13l11-6.5-11-6.5z" fill="#fff" />
      <circle cx="24.5" cy="7.5" r="2" fill="#FFB27A" />
      <defs>
        <linearGradient id="cfg-g" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#FF7A3D" />
          <stop offset="1" stopColor="#E8430A" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <ForgeLogo size={size} />
      <span className="font-display text-lg font-extrabold tracking-[0.08em] text-white">
        CLIPFORGE
      </span>
    </span>
  )
}
