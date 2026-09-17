export function ClipzilaMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cz-c-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FF7A3D" />
          <stop offset="50%" stopColor="#FF5A1F" />
          <stop offset="100%" stopColor="#FFB800" />
        </linearGradient>
        <linearGradient id="cz-bolt-grad" x1="16" y1="4" x2="32" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF4D0" />
          <stop offset="30%" stopColor="#FFD15C" />
          <stop offset="70%" stopColor="#FF7A1F" />
          <stop offset="100%" stopColor="#E03A00" />
        </linearGradient>
        <linearGradient id="cz-play-grad" x1="20" y1="16" x2="34" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE59E" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FF8F3D" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {/* Internal Video Play Triangle */}
      <path
        d="M21 16.5L33.5 24L21 31.5V16.5Z"
        fill="url(#cz-play-grad)"
      />

      {/* The Dynamic "C" Outer Ring with Tapered Cut */}
      <path
        d="M36 12C32.6 7.6 27.4 4.8 21.5 4.8C10.7 4.8 2 13.5 2 24.3C2 35.1 10.7 43.8 21.5 43.8C27.6 43.8 32.9 40.9 36.3 36.4L30.5 32.2C28.2 35.3 25.1 37.3 21.5 37.3C14.3 37.3 8.5 31.5 8.5 24.3C8.5 17.1 14.3 11.3 21.5 11.3C25 11.3 28.1 13.2 30.3 16.2L36 12Z"
        fill="url(#cz-c-grad)"
      />

      {/* The Iconic Z-Lightning Slash Piercing Through */}
      <path
        d="M31.5 3L17.5 21.5H24.5L16.5 45L31 23.5H23.5L31.5 3Z"
        fill="url(#cz-bolt-grad)"
      />

      {/* 3D Highlight Facet */}
      <path
        d="M23.5 23.5L31 23.5L25.5 31.5Z"
        fill="#FFFFFF"
        opacity="0.35"
      />
    </svg>
  )
}

export const ClipticaMark = ClipzilaMark
export const NologyMark = ClipzilaMark

export function Wordmark({ size = 26 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <ClipzilaMark size={size} />
      <span className="font-display text-lg font-extrabold tracking-[0.08em] bg-gradient-to-r from-white via-pearl to-champagne bg-clip-text text-transparent">
        CLIPZILA
      </span>
    </span>
  )
}
