import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button } from './Button'

export interface DialogProps {
  open: boolean
  title: string
  onClose(): void
  children: ReactNode
  footer?: ReactNode
  size?: 'md' | 'lg'
}

/** Modaler Dialog – auf schmalen Fenstern als Vollbild */
export function Dialog({ open, title, onClose, children, footer, size = 'md' }: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    // Fokus einmalig beim Öffnen auf das erste Eingabefeld (sonst erster Button)
    const panel = panelRef.current
    const first =
      panel?.querySelector<HTMLElement>('input, textarea, select') ??
      panel?.querySelector<HTMLElement>('button')
    first?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  // Portal: verhindert, dass transformierte Vorfahren (Cards) die fixe Position verschieben
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        data-testid="dialog-backdrop"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative flex h-full w-full flex-col bg-surface shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl sm:border sm:border-line',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 id={titleId} className="font-display text-lg font-semibold">
            {title}
          </h2>
          <Button variant="ghost" size="icon" aria-label="Schließen" onClick={onClose}>
            <X size={18} />
          </Button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
