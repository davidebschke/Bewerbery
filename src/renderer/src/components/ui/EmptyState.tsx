import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <div className="text-4xl" aria-hidden="true">
        {icon}
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  )
}
