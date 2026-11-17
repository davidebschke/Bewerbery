# IPC-Vertrag: KI-Einstellungen & CV-Optimierung

Erweiterung von `IPC` und `BewerberyApi` in `src/shared/ipc.ts`. Jede Nutzlast wird im Handler
(`registerIpc.ts`) mit Zod validiert. Bei ungültigen Nutzlasten wirft der Handler einen Fehler (wie die
bestehenden Kanäle). Fachliche Fehler kommen als `AiResult` zurück (siehe Research R6).

```ts
type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiErrorCode }
```

Typen siehe [data-model.md](../data-model.md).

## API-Key (Einstellungen)

| Kanal | Methode | Nutzlast → Rückgabe | Verhalten |
|---|---|---|---|
| `ai:key-status` | `getAiKeyStatus()` | – → `AiKeyStatus` | Liest nur die Metadaten, entschlüsselt nicht |
| `ai:set-key` | `setAiKey(key)` | `apiKeySchema` → `AiResult<AiKeyStatus>` | Verschlüsselt und speichert, ersetzt einen vorhandenen Key. `encryption-unavailable`, wenn nicht möglich |
| `ai:test-key` | `testAiKey(key?)` | `apiKeySchema.optional()` → `AiResult<true>` | Ohne Argument wird der gespeicherte Key geprüft. Minimale Anfrage (`max_tokens` klein). Fehler: `no-key`, `invalid-key`, `network`, `rate-limit`, `server` |
| `ai:remove-key` | `removeAiKey()` | – → `AiKeyStatus` | Löscht beide Dateien und bricht einen laufenden Optimierungslauf ab |

**Invariante**: Kein Kanal gibt den Klartext-Key oder den verschlüsselten Key zurück (FR-003, SC-004).

## CV-Optimierung

| Kanal | Methode | Nutzlast → Rückgabe | Verhalten |
|---|---|---|---|
| `cv:pick-file` | `pickCvFile()` | – → `AiResult<CvSource> \| null` | Dateidialog (Filter: DOCX, ODT). `null` = abgebrochen. Datei wird nach `userData/cv/source.<ext>` kopiert. Fehler: `pdf-not-supported`, `unsupported-file`, `file-too-large`, `unreadable-file`, `tracked-changes`, `no-text`, `too-long` |
| `cv:read-file` | `readCvFile(path)` | `z.string().min(1)` → `AiResult<CvSource>` | Für Drag & Drop (Pfad via `getPathForFile`) |
| `cv:optimize` | `optimizeCv(request)` | `cvOptimizationRequestSchema` → `AiResult<CvOptimizationResult>` | Verwendet die aktuelle Quelle. Fehler u. a. `no-key`, `no-source`, `busy`. Bei Erfolg wird das Ergebnis als letztes Ergebnis gespeichert |
| `cv:cancel` | `cancelCvOptimization()` | – → `void` | Bricht den laufenden Lauf ab. Der wartende `optimizeCv`-Aufruf liefert `canceled` |
| `cv:last-result` | `getLastCvResult()` | – → `CvOptimizationResult \| null` | Ungültige Datei oder fehlende Quelle → `null` |
| `cv:clear-last-result` | `clearLastCvResult()` | – → `void` | Löscht Ergebnis und Quelle |
| `cv:save-variant` | `saveCvVariant(style)` | `variantStyleSchema` → `AiResult<FileSaveOutcome>` | Speichern-Dialog mit Vorschlag `<Name> – <Stil>.<ext>`. Schreibt die Quelle mit den Ersetzungen der Variante aus dem letzten Ergebnis |
| `cv:attach-variant` | `attachCvVariant(style, applicationId)` | `variantStyleSchema`, `idSchema` → `AiResult<ApplicationDocument>` | Legt die Datei im Originaldesign im Dokumentordner der Bewerbung ab. Der Renderer hängt das Dokument über den Store an |

**Netzwerk-Invariante** (FR-007, SC-005): Nur `ai:test-key` und `cv:optimize` lösen Netzwerkanfragen aus,
und nur an die Anthropic-API.

## Dokumente (intern)

`DocumentService` erhält `importBuffer(applicationId, fileName, bytes)`. Die Methode wird von
`cv:attach-variant` genutzt und hat keinen eigenen Kanal. Den Namen bereinigt `sanitizeFileName`.

## Preload & Mock

- `src/preload/index.ts`: Für jede Methode wird `ipcRenderer.invoke(IPC.x, …)` weitergeleitet, mit Test.
- `src/renderer/src/test/mockApi.ts`: Es gibt Standard-Mocks: kein Key hinterlegt, `pickCvFile` liefert eine
  Beispielquelle, `optimizeCv` liefert ein festes Beispielergebnis, `getLastCvResult` liefert `null`.
