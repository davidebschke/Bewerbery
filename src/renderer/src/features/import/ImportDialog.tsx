import { useMemo, useState } from 'react'
import { FileSpreadsheet, Upload } from 'lucide-react'
import { detectHeaderRow, type ColumnTarget } from '@shared/domain/import/fields'
import {
  buildDrafts,
  dataRowsOf,
  draftsToApplications,
  findDuplicates,
  type ImportDraft,
} from '@shared/domain/import/rows'
import {
  TEMPLATE_FORMAT_LABELS,
  TEMPLATE_FORMATS,
  type TemplateFormat,
} from '@shared/domain/import/template'
import type { DateOrder } from '@shared/domain/import/values'
import type { ImportWorkbook } from '@shared/types'
import { Button } from '../../components/ui/Button'
import { Dialog } from '../../components/ui/Dialog'
import { SelectField } from '../../components/ui/Field'
import { getApi } from '../../lib/api'
import { errorMessage } from '../../lib/errors'
import { useAppStore } from '../../stores/appStore'
import { MappingStep } from './MappingStep'
import { PreviewStep } from './PreviewStep'
import { analyzeColumns, detectOrderFor, previewState, reassign } from './wizard'

type Step = 'start' | 'mapping' | 'preview'

const STEP_NUMBER: Record<Step, number> = { start: 1, mapping: 2, preview: 3 }

/** Assistent: Datei wählen → Spalten zuordnen → Vorschau prüfen → importieren */
export function ImportDialog({ onClose }: { onClose(): void }) {
  const existing = useAppStore((s) => s.data.applications)
  const importApplications = useAppStore((s) => s.importApplications)
  const pushToast = useAppStore((s) => s.pushToast)

  const [step, setStep] = useState<Step>('start')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templateFormat, setTemplateFormat] = useState<TemplateFormat>('xlsx')

  const [workbook, setWorkbook] = useState<ImportWorkbook | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [headerRow, setHeaderRow] = useState<number | null>(null)
  const [mapping, setMapping] = useState<ColumnTarget[]>([])
  const [dateOrderChoice, setDateOrderChoice] = useState<DateOrder | null>(null)

  const [drafts, setDrafts] = useState<ImportDraft[]>([])
  const [deselected, setDeselected] = useState<Set<number>>(new Set())
  const [fallbackSentAt, setFallbackSentAt] = useState('')

  const rows = useMemo(() => workbook?.sheets[sheetIndex]?.rows ?? [], [workbook, sheetIndex])
  const dateInfo = useMemo(
    () => detectOrderFor(rows, headerRow, mapping),
    [rows, headerRow, mapping],
  )
  const dateOrder = dateOrderChoice ?? dateInfo.order
  const dataRowCount = useMemo(() => dataRowsOf(rows, headerRow).length, [rows, headerRow])

  const duplicates = useMemo(
    () => findDuplicates(drafts, existing, fallbackSentAt),
    [drafts, existing, fallbackSentAt],
  )
  const preview = useMemo(
    () => previewState(drafts, duplicates, deselected, fallbackSentAt),
    [drafts, duplicates, deselected, fallbackSentAt],
  )

  function analyze(sheetRows: string[][], header: number | null) {
    setHeaderRow(header)
    setMapping(analyzeColumns(sheetRows, header))
    setDateOrderChoice(null)
  }

  function selectSheet(index: number, source: ImportWorkbook) {
    const sheetRows = source.sheets[index].rows
    setSheetIndex(index)
    analyze(sheetRows, detectHeaderRow(sheetRows))
  }

  async function pickFile() {
    setBusy(true)
    setError(null)
    try {
      const picked = await getApi().pickImportFile()
      if (!picked) return
      setWorkbook(picked)
      selectSheet(
        Math.max(
          0,
          picked.sheets.findIndex((sheet) => sheet.rows.length > 0),
        ),
        picked,
      )
      setStep('mapping')
    } catch (err) {
      setError(errorMessage(err, 'Die Datei konnte nicht gelesen werden.'))
    } finally {
      setBusy(false)
    }
  }

  async function saveTemplate() {
    try {
      const result = await getApi().saveImportTemplate(templateFormat)
      if (!result.canceled) pushToast('info', 'Vorlage gespeichert.')
    } catch {
      pushToast('error', 'Vorlage konnte nicht gespeichert werden.')
    }
  }

  function showPreview() {
    const built = buildDrafts(rows, { headerRow, mapping, dateOrder })
    setDrafts(built)
    // Duplikate sind anfangs abgewählt, können aber bewusst importiert werden
    setDeselected(new Set(findDuplicates(built, existing)))
    setFallbackSentAt('')
    setStep('preview')
  }

  function toggleRow(rowNumber: number) {
    setDeselected((current) => {
      const next = new Set(current)
      if (next.has(rowNumber)) next.delete(rowNumber)
      else next.add(rowNumber)
      return next
    })
  }

  function editRow(rowNumber: number, patch: Partial<ImportDraft>) {
    setDrafts((current) =>
      current.map((draft) => (draft.rowNumber === rowNumber ? { ...draft, ...patch } : draft)),
    )
  }

  function runImport() {
    const applications = draftsToApplications(preview.included, {
      now: new Date(),
      fallbackSentAt,
    })
    const notImported = preview.rows.filter((row) => !row.included)
    const duplicateCount = notImported.filter((row) => row.duplicate).length
    importApplications(applications, {
      skipped: notImported.length - duplicateCount,
      duplicates: duplicateCount,
    })
    onClose()
  }

  const footer =
    step === 'start' ? (
      <Button variant="ghost" onClick={onClose}>
        Abbrechen
      </Button>
    ) : step === 'mapping' ? (
      <>
        <Button variant="ghost" onClick={() => setStep('start')}>
          Andere Datei
        </Button>
        <Button variant="primary" disabled={dataRowCount === 0} onClick={showPreview}>
          Weiter zur Vorschau
        </Button>
      </>
    ) : (
      <>
        <Button variant="ghost" onClick={() => setStep('mapping')}>
          Zurück zur Zuordnung
        </Button>
        <Button variant="primary" disabled={preview.included.length === 0} onClick={runImport}>
          {preview.included.length} {preview.included.length === 1 ? 'Bewerbung' : 'Bewerbungen'}{' '}
          importieren
        </Button>
      </>
    )

  return (
    <Dialog open size="xl" title="Bewerbungen importieren" onClose={onClose} footer={footer}>
      <p className="mb-4 text-xs font-semibold tracking-wide text-muted uppercase">
        Schritt {STEP_NUMBER[step]} von 3
      </p>

      {step === 'start' && (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">
              Übernimm Bewerbungen aus einer Tabelle – als CSV, LibreOffice (.ods) oder Excel
              (.xlsx). Spalten werden automatisch erkannt, auch auf Englisch. Vor dem Import siehst
              du eine Vorschau.
            </p>
            <Button variant="primary" onClick={() => void pickFile()} disabled={busy}>
              <Upload size={16} aria-hidden="true" />
              {busy ? 'Datei wird gelesen …' : 'Datei auswählen'}
            </Button>
            {error && (
              <p role="alert" className="text-sm text-due">
                {error}
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <FileSpreadsheet size={16} aria-hidden="true" />
              Vorlage
            </h3>
            <p className="text-xs text-muted">
              Eine leere Tabelle mit allen Spalten und Beispielzeilen – ausfüllen und wieder
              importieren.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <SelectField
                label="Format"
                value={templateFormat}
                onChange={(event) => setTemplateFormat(event.target.value as TemplateFormat)}
                className="sm:w-56"
              >
                {TEMPLATE_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {TEMPLATE_FORMAT_LABELS[format]}
                  </option>
                ))}
              </SelectField>
              <Button variant="secondary" onClick={() => void saveTemplate()}>
                Vorlage herunterladen
              </Button>
            </div>
          </section>
        </div>
      )}

      {step === 'mapping' && workbook && (
        <MappingStep
          workbook={workbook}
          sheetIndex={sheetIndex}
          onSheet={(index) => selectSheet(index, workbook)}
          headerRow={headerRow}
          onHeaderRow={(row) => analyze(rows, row)}
          mapping={mapping}
          onTarget={(index, target) => setMapping((current) => reassign(current, index, target))}
          dateInfo={dateInfo}
          dateOrder={dateOrder}
          onDateOrder={setDateOrderChoice}
          dataRowCount={dataRowCount}
        />
      )}

      {step === 'preview' && (
        <PreviewStep
          preview={preview}
          fallbackSentAt={fallbackSentAt}
          onFallbackSentAt={setFallbackSentAt}
          onToggle={toggleRow}
          onEdit={editRow}
        />
      )}
    </Dialog>
  )
}
