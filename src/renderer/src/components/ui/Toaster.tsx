import { useEffect } from 'react'
import { AlertTriangle, Info, Sparkles, Trophy } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAppStore, type Toast, type ToastKind } from '../../stores/appStore'

export const TOAST_DURATION_MS = 3500

const STYLES: Record<ToastKind, { icon: typeof Info; className: string }> = {
  xp: { icon: Sparkles, className: 'border-brand/40' },
  level: { icon: Trophy, className: 'border-warn/60' },
  info: { icon: Info, className: 'border-line' },
  error: { icon: AlertTriangle, className: 'border-due/60 text-due' },
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useAppStore((s) => s.dismissToast)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [toast.id, dismiss])

  const { icon: Icon, className } = STYLES[toast.kind]
  return (
    <button
      type="button"
      onClick={() => dismiss(toast.id)}
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-surface px-4 py-2.5 text-sm font-medium shadow-lg',
        className,
      )}
    >
      <Icon size={16} aria-hidden="true" />
      {toast.message}
    </button>
  )
}

export function Toaster() {
  const toasts = useAppStore((s) => s.toasts)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 left-4 z-50 flex flex-col items-end gap-2 [&>*]:pointer-events-auto"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
