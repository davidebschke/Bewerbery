import { cn } from '../../lib/cn'

export type ProgressTone = 'ok' | 'warn' | 'due' | 'brand'

const TONES: Record<ProgressTone, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  due: 'bg-due',
  brand: 'bg-linear-to-r from-brand to-brand-2',
}

export interface ProgressBarProps {
  /** 0..1 */
  value: number
  label: string
  tone?: ProgressTone
  className?: string
  pulse?: boolean
}

export function ProgressBar({ value, label, tone = 'brand', className, pulse }: ProgressBarProps) {
  const percent = Math.round(Math.min(Math.max(value, 0), 1) * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn('h-2.5 w-full overflow-hidden rounded-full bg-surface-2', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700',
          TONES[tone],
          pulse && 'animate-pulse',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
