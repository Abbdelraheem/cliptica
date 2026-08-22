import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'gold' | 'emerald' | 'outline'
}

function Badge({ className, variant = 'gold', children, ...props }: BadgeProps) {
  const variantClasses = {
    gold: 'badge-gold',
    emerald: 'badge-emerald',
    outline: 'badge-outline',
  }

  return (
    <div
      className={cn('badge', variantClasses[variant], className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Badge }