import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '../../lib/cn'

const CONTROL =
  'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm text-fg placeholder:text-muted/70 focus:border-brand focus:outline-none'

interface FieldShellProps {
  label: string
  error?: string
  hint?: string
  className?: string
  children(id: string, describedBy: string | undefined): ReactNode
}

function FieldShell({ label, error, hint, className, children }: FieldShellProps) {
  const id = useId()
  const messageId = `${id}-message`
  const message = error ?? hint
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </label>
      {children(id, message ? messageId : undefined)}
      {message && (
        <p id={messageId} className={cn('text-xs', error ? 'text-due' : 'text-muted')}>
          {message}
        </p>
      )}
    </div>
  )
}

type Common = { label: string; error?: string; hint?: string; className?: string }

export function TextField({
  label,
  error,
  hint,
  className,
  ...props
}: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={className}>
      {(id, describedBy) => (
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(CONTROL, error && 'border-due')}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export function TextArea({
  label,
  error,
  hint,
  className,
  ...props
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={className}>
      {(id, describedBy) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          className={cn(CONTROL, 'min-h-24 resize-y')}
          {...props}
        />
      )}
    </FieldShell>
  )
}

export function SelectField({
  label,
  error,
  hint,
  className,
  children,
  ...props
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={className}>
      {(id, describedBy) => (
        <select id={id} aria-describedby={describedBy} className={CONTROL} {...props}>
          {children}
        </select>
      )}
    </FieldShell>
  )
}
