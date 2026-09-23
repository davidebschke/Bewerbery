import { useState, type DragEvent } from 'react'
import { FileText, Paperclip, Trash2, Upload } from 'lucide-react'
import type { ApplicationDocument } from '@shared/types'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/cn'
import { getApi } from '../../lib/api'
import { formatFileSize } from '../../lib/format'
import { useAppStore } from '../../stores/appStore'

export interface DocumentListProps {
  applicationId: string
  documents: ApplicationDocument[]
  onAdd(documents: ApplicationDocument[]): void
  onRemove(document: ApplicationDocument): void
}

export function DocumentList({ applicationId, documents, onAdd, onRemove }: DocumentListProps) {
  const pushToast = useAppStore((s) => s.pushToast)
  const [dragging, setDragging] = useState(false)

  async function run(task: () => Promise<ApplicationDocument[]>) {
    try {
      const added = await task()
      if (added.length) onAdd(added)
    } catch {
      pushToast('error', 'Dokumente konnten nicht hinzugefügt werden.')
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    setDragging(false)
    const api = getApi()
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => api.getPathForFile(file))
      .filter(Boolean)
    if (paths.length) void run(() => api.importDocuments(applicationId, paths))
  }

  async function open(document: ApplicationDocument) {
    try {
      await getApi().openDocument(applicationId, document)
    } catch {
      pushToast('error', `„${document.name}“ konnte nicht geöffnet werden.`)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">
        Eingereichte Dokumente
      </span>
      <div
        data-testid="document-dropzone"
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-center text-sm text-muted transition',
          dragging ? 'border-brand bg-brand/5' : 'border-line',
        )}
      >
        <Upload size={18} aria-hidden="true" />
        <span>Dateien hierher ziehen oder</span>
        <Button size="sm" onClick={() => void run(() => getApi().pickDocuments(applicationId))}>
          <Paperclip size={14} aria-hidden="true" /> Dateien auswählen
        </Button>
      </div>
      {documents.length > 0 && (
        <ul className="flex flex-col gap-1.5" aria-label="Dokumente">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm"
            >
              <FileText size={14} aria-hidden="true" className="shrink-0 text-muted" />
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left text-brand hover:underline"
                onClick={() => void open(document)}
                title={`${document.name} öffnen`}
                aria-label={`${document.name} öffnen`}
              >
                {document.name}
              </button>
              <span className="shrink-0 text-xs text-muted">{formatFileSize(document.size)}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                aria-label={`${document.name} entfernen`}
                onClick={() => onRemove(document)}
              >
                <Trash2 size={14} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
