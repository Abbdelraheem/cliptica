'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline-gold'
  size?: 'sm' | 'default' | 'lg' | 'xl'
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', asChild = false, loading, children, disabled, ...props }, ref) => {
    const Comp: React.ElementType = asChild
      ? React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
          function AnchorLink(anchorProps, anchorRef) {
            return <a ref={anchorRef} {...anchorProps} />
          }
        )
      : 'button'
    const baseClasses = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--champagne)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--onyx)] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]'
    
    const variantClasses = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      ghost: 'btn-ghost',
      'outline-gold': 'btn-outline-gold',
    }
    
    const sizeClasses = {
      sm: 'px-4 py-2 text-sm',
      default: 'px-6 py-3 text-sm',
      lg: 'px-8 py-4 text-base',
      xl: 'px-10 py-5 text-lg',
    }

    return (
      <Comp
        className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <svg className="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Loading...
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button }