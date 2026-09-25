import { useEffect, useMemo, useState } from 'react'
import { Plus, Settings as SettingsIcon, Target } from 'lucide-react'
import { arrangeApplications, type StageFilter } from '@shared/domain/sorting'
import type { Application } from '@shared/types'
import { Button } from './components/ui/Button'
import { EmptyState } from './components/ui/EmptyState'
import { Toaster } from './components/ui/Toaster'
import { ApplicationForm } from './features/applications/ApplicationForm'
import { ApplicationGrid } from './features/applications/ApplicationGrid'
import { ExportSelectionBar } from './features/applications/ExportSelectionBar'
import { Toolbar } from './features/applications/Toolbar'
import { PinnedSection } from './features/followup/PinnedSection'
import { BadgesDialog } from './features/gamification/BadgesDialog'
import { celebrate } from './features/gamification/celebrate'
import { StatsBar } from './features/gamification/StatsBar'
import { XpBar } from './features/gamification/XpBar'
import { SettingsDialog } from './features/settings/SettingsDialog'
import { useTheme } from './hooks/useTheme'
import { useToday } from './hooks/useToday'
import { getApi } from './lib/api'
import { useAppStore } from './stores/appStore'

type FormTarget = { mode: 'create' } | { mode: 'edit'; application: Application } | null

export function App() {
  const { status, error, data, celebration, hydrate, pushToast } = useAppStore()
  const today = useToday()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StageFilter>('all')
  const [form, setForm] = useState<FormTarget>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [badgesOpen, setBadgesOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  useTheme(data.settings.theme)

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  useEffect(() => {
    if (celebration) celebrate(celebration.kind)
  }, [celebration])

  const { pinned, others } = useMemo(
    () => arrangeApplications(data.applications, data.settings, today, { search, filter }),
    [data.applications, data.settings, today, search, filter],
  )

  if (status === 'loading') {
    return (
      <div className="app-backdrop grid h-full place-items-center text-muted" role="status">
        Bewerbery wird geladen …
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="app-backdrop grid h-full place-items-center p-6">
        <EmptyState icon="⚠️" title="Daten konnten nicht geladen werden">
          <p className="mb-4">{error}</p>
          <Button variant="primary" onClick={() => void hydrate()}>
            Erneut versuchen
          </Button>
        </EmptyState>
      </div>
    )
  }

  const onEdit = (application: Application) => setForm({ mode: 'edit', application })
  const hasApplications = data.applications.length > 0
  const hasResults = pinned.length + others.length > 0
  const visibleIds = [...pinned, ...others].map((application) => application.id)

  function startExportSelection() {
    setSelectionMode(true)
    setSelectedIds(new Set())
  }

  function cancelExportSelection() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  function toggleSelected(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelectedIds((previous) =>
      previous.size === visibleIds.length ? new Set() : new Set(visibleIds),
    )
  }

  async function exportSelection() {
    setExporting(true)
    try {
      const result = await getApi().exportApplicationsPdf([...selectedIds])
      if (!result.canceled) {
        pushToast('info', 'PDF wurde erstellt.')
        cancelExportSelection()
      }
    } catch {
      pushToast('error', 'PDF konnte nicht erstellt werden.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="app-backdrop min-h-full">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-linear-to-br from-brand to-brand-2 text-white shadow-md shadow-brand/30">
              <Target size={20} aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <h1 className="font-display text-lg font-bold">Bewerbery</h1>
              <p className="hidden text-xs text-muted sm:block">Deine Bewerbungen im Griff</p>
            </div>
          </div>
          <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
            <XpBar xp={data.progress.xp} onOpenBadges={() => setBadgesOpen(true)} />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Einstellungen"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon size={18} />
            </Button>
            <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
              <Plus size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Neue Bewerbung</span>
              <span className="sm:hidden">Neu</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1600px] flex-col gap-6 px-4 py-6 sm:px-6">
        <StatsBar data={data} today={today} />

        {!hasApplications ? (
          <EmptyState icon="🚀" title="Deine Jobsuche startet hier">
            <p className="mb-4">
              Lege deine erste Bewerbung an und sammle XP. Bewerbery erinnert dich, wann du dich
              melden solltest.
            </p>
            <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
              <Plus size={16} aria-hidden="true" /> Erste Bewerbung anlegen
            </Button>
          </EmptyState>
        ) : (
          <>
            <Toolbar
              search={search}
              onSearch={setSearch}
              filter={filter}
              onFilter={setFilter}
              selectionMode={selectionMode}
              onStartExport={startExportSelection}
            />
            {selectionMode && (
              <ExportSelectionBar
                selectedCount={selectedIds.size}
                totalCount={visibleIds.length}
                exporting={exporting}
                onToggleSelectAll={toggleSelectAll}
                onExport={() => void exportSelection()}
                onCancel={cancelExportSelection}
              />
            )}
            <PinnedSection
              applications={pinned}
              settings={data.settings}
              today={today}
              onEdit={onEdit}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelected}
            />
            {others.length > 0 && (
              <section aria-labelledby="all-heading" className="flex flex-col gap-3">
                <h2 id="all-heading" className="font-display text-base font-semibold">
                  {pinned.length > 0 ? 'Weitere Bewerbungen' : 'Deine Bewerbungen'}
                </h2>
                <ApplicationGrid
                  applications={others}
                  settings={data.settings}
                  today={today}
                  onEdit={onEdit}
                  selectionMode={selectionMode}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelected}
                />
              </section>
            )}
            {!hasResults && (
              <EmptyState icon="🔍" title="Nichts gefunden">
                Passe Suche oder Filter an.
              </EmptyState>
            )}
          </>
        )}
      </main>

      {form && (
        <ApplicationForm
          key={form.mode === 'edit' ? form.application.id : 'new'}
          application={form.mode === 'edit' ? form.application : undefined}
          onClose={() => setForm(null)}
        />
      )}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <BadgesDialog
        open={badgesOpen}
        onClose={() => setBadgesOpen(false)}
        progress={data.progress}
        today={today}
      />
      <Toaster />
    </div>
  )
}
