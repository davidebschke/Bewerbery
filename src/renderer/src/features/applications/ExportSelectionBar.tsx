import { useEffect, useRef } from 'react'
import { FileDown, X } from 'lucide-react'
import { Button } from '../../components/ui/Button'

export interface ExportSelectionBarProps {
  selectedCount: number
  totalCount: number
  exporting: boolean
  onToggleSelectAll(): void
  onExport(): void
  onCancel(): void
}

/** Steuerleiste zur Auswahl von Bewerbungen vor dem PDF-Export */
export function ExportSelectionBar({
  selectedCount,
  totalCount,
  exporting,
  onToggleSelectAll,
  onExport,
  onCancel,
}: ExportSelectionBarProps) {
  const selectAllRef = useRef<HTMLInputElement>(null)
  const allSelected = totalCount > 0 && selectedCount === totalCount

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selectedCount > 0 && !allSelected
    }
  }, [selectedCount, allSelected])

  return (
    <div
      role="group"
      aria-label="Bewerbungen für PDF-Export auswählen"
      className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <label className="flex items-center gap-2 text-sm">
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={allSelected}
          onChange={onToggleSelectAll}
          disabled={totalCount === 0}
          className="h-4 w-4 rounded border-line accent-brand"
        />
        Alle auswählen
        <span className="text-muted">
          ({selectedCount} von {totalCount} ausgewählt)
        </span>
      </label>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X size={14} aria-hidden="true" /> Abbrechen
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onExport}
          disabled={selectedCount === 0 || exporting}
        >
          <FileDown size={14} aria-hidden="true" />
          {exporting ? 'Wird erstellt …' : 'PDF erstellen'}
        </Button>
      </div>
    </div>
  )
}
