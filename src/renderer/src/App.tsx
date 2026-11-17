import { useEffect, useMemo, useState } from 'react'
import { Briefcase, FileUp, Plus, Settings as SettingsIcon, Sparkles } from 'lucide-react'
import { arrangeApplications, type StageFilter } from '@shared/domain/sorting'
import type { Application } from '@shared/types'
import appIcon from './assets/icon.png'
import { Button } from './components/ui/Button'
import { EmptyState } from './components/ui/EmptyState'
import { Toaster } from './components/ui/Toaster'
import { ApplicationForm } from './features/applications/ApplicationForm'
import { ApplicationGrid } from './features/applications/ApplicationGrid'
import { ExportSelectionBar } from './features/applications/ExportSelectionBar'
import { CvOptimizationView } from './features/cv-optimization/CvOptimizationView'
import { Toolbar } from './features/applications/Toolbar'
import { PinnedSection } from './features/followup/PinnedSection'
import { BadgesDialog } from './features/gamification/BadgesDialog'
import { celebrate } from './features/gamification/celebrate'
import { StatsBar } from './features/gamification/StatsBar'
import { XpBar } from './features/gamification/XpBar'
import { ImportDialog } from './features/import/ImportDialog'
import { SettingsDialog } from './features/settings/SettingsDialog'
import { useTheme } from './hooks/useTheme'
import { useToday } from './hooks/useToday'
import { getApi } from './lib/api'
import { cn } from './lib/cn'
import { useAppStore } from './stores/appStore'

type FormTarget = { mode: 'create' } | { mode: 'edit'; application: Application } | null
type View = 'applications' | 'cv'

const VIEWS: { value: View; label: string; short: string; Icon: typeof Briefcase }[] = [
  { value: 'applications', label: 'Bewerbungen', short: 'Bewerbungen', Icon: Briefcase },
  { value: 'cv', label: 'CV-Optimierung', short: 'CV', Icon: Sparkles },
]

export function App() {
  const { status, error, data, celebration, hydrate, pushToast } = useAppStore()
  const today = useToday()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StageFilter>('all')
  const [form, setForm] = useState<FormTarget>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [badgesOpen, setBadgesOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [view, setView] = useState<View>('applications')

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
            <img
              src={appIcon}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl shadow-md shadow-brand/30"
            />
            <div className="leading-tight">
              <h1 className="font-display text-lg font-bold">Bewerbery</h1>
              <p className="hidden text-xs text-muted sm:block">Deine Bewerbungen im Griff</p>
            </div>
          </div>
          <nav
            aria-label="Bereiche"
            className="order-last flex w-full gap-1 rounded-xl bg-surface-2 p-1 sm:order-none sm:w-auto"
          >
            {VIEWS.map(({ value, label, short, Icon }) => (
              <button
                key={value}
                type="button"
                aria-current={view === value ? 'page' : undefined}
                onClick={() => setView(value)}
                className={cn(
                  'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition sm:flex-none',
                  view === value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="hidden md:inline">{label}</span>
                <span className="md:hidden">{short}</span>
              </button>
            ))}
          </nav>
          <div className="order-last w-full sm:order-none sm:ml-auto sm:w-auto">
            <XpBar xp={data.progress.xp} onOpenBadges={() => setBadgesOpen(true)} />
          </div>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Bewerbungen importieren"
              title="Bewerbungen importieren"
              onClick={() => setImportOpen(true)}
            >
              <FileUp size={18} />
            </Button>
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
        {view === 'cv' ? (
          <CvOptimizationView
            settingsOpen={settingsOpen}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : (
          <>
            <StatsBar data={data} today={today} />

            {!hasApplications ? (
              <EmptyState icon="🚀" title="Deine Jobsuche startet hier">
                <p className="mb-4">
                  Lege deine erste Bewerbung an und sammle XP. Bewerbery erinnert dich, wann du dich
                  melden solltest.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
                    <Plus size={16} aria-hidden="true" /> Erste Bewerbung anlegen
                  </Button>
                  <Button variant="secondary" onClick={() => setImportOpen(true)}>
                    <FileUp size={16} aria-hidden="true" /> Aus Tabelle importieren
                  </Button>
                </div>
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
      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} />}
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
