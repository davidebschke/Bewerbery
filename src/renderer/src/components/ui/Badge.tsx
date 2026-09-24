import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'due'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-muted',
  brand: 'bg-brand/15 text-brand',
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  due: 'bg-due/15 text-due',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
