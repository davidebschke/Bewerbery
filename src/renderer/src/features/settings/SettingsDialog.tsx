import { MAX_FOLLOW_UP_WEEKS, MIN_FOLLOW_UP_WEEKS } from '@shared/constants'
import type { Theme } from '@shared/types'
import { Dialog } from '../../components/ui/Dialog'
import { cn } from '../../lib/cn'
import { useAppStore } from '../../stores/appStore'

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
]

export function SettingsDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const settings = useAppStore((s) => s.data.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)
  const weeks = settings.followUpWeeks

  return (
    <Dialog open={open} onClose={onClose} title="Einstellungen">
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-2">
          <label htmlFor="follow-up-weeks" className="text-sm font-semibold">
            Melden nach{' '}
            <span className="text-brand">
              {weeks} {weeks === 1 ? 'Woche' : 'Wochen'}
            </span>
          </label>
          <p className="text-xs text-muted">
            Ab dann gilt eine Bewerbung als „Melden fällig“ und wird oben angepinnt. Einzelne
            Bewerbungen können eine eigene Frist haben.
          </p>
          <input
            id="follow-up-weeks"
            type="range"
            min={MIN_FOLLOW_UP_WEEKS}
            max={MAX_FOLLOW_UP_WEEKS}
            step={1}
            value={weeks}
            onChange={(event) => updateSettings({ followUpWeeks: Number(event.target.value) })}
            className="accent-brand"
          />
          <div className="flex justify-between text-[11px] text-muted" aria-hidden="true">
            <span>{MIN_FOLLOW_UP_WEEKS} Woche</span>
            <span>{MAX_FOLLOW_UP_WEEKS} Wochen</span>
          </div>
        </section>

        <section className="flex items-start justify-between gap-4">
          <div>
            <label htmlFor="notifications" className="text-sm font-semibold">
              Erinnerungen
            </label>
            <p className="text-xs text-muted">
              Windows-Benachrichtigung, wenn eine Bewerbung fällig wird.
            </p>
          </div>
          <input
            id="notifications"
            type="checkbox"
            role="switch"
            checked={settings.notificationsEnabled}
            onChange={(event) => updateSettings({ notificationsEnabled: event.target.checked })}
            className="mt-1 h-5 w-5 accent-brand"
          />
        </section>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">Darstellung</legend>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((theme) => (
              <label
                key={theme.value}
                className={cn(
                  'cursor-pointer rounded-xl border px-3 py-2 text-center text-sm font-medium transition',
                  settings.theme === theme.value
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-line hover:border-brand/40',
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={theme.value}
                  checked={settings.theme === theme.value}
                  onChange={() => updateSettings({ theme: theme.value })}
                  className="sr-only"
                />
                {theme.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    </Dialog>
  )
}
