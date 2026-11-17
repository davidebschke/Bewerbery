# Data Model: KI-gestützte Lebenslauf-Optimierung

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Alle Schemas sind Zod-Schemas in `src/shared/` (Typen werden per `z.infer` abgeleitet).

## 1. Bewerbung (erweitert) – `applicationSchema`

| Feld | Typ | Regel |
|---|---|---|
| `jobDescription` *(neu)* | `string` | `default('')`, max. 15 000 Zeichen (`MAX_JOB_DESCRIPTION_CHARS`) |

- Wird zusätzlich in `applicationInputSchema` aufgenommen (Formularfeld „Stellenanzeige“, mehrzeilig).
- Abwärtskompatibel: Altdaten ohne das Feld erhalten `''`. `DATA_VERSION` bleibt unverändert.
- Der Tabellen-Import ordnet das Feld vorerst nicht zu (außerhalb des Scopes).

## 2. Einstellungen (erweitert) – `settingsSchema`

| Feld | Typ | Regel |
|---|---|---|
| `aiConsentAt` *(neu)* | `string \| null` | ISO-Zeitstempel der Datenschutz-Zustimmung, `default(null)` |

- `null` bedeutet: Vor dem nächsten Senden erscheint der Datenschutzhinweis (FR-008).
- „Zustimmung widerrufen“ setzt den Wert wieder auf `null`.

## 3. KI-Key-Status – `aiKeyStatusSchema` (nur Main ↔ Renderer, nie der Key selbst)

| Feld | Typ | Regel |
|---|---|---|
| `configured` | `boolean` | |
| `hint` | `string \| null` | genau 4 Zeichen (Endung des Keys) oder `null` |
| `encryptionAvailable` | `boolean` | `false` → Speichern deaktiviert (FR-006) |

Gespeichert im Main als `ai-key.bin` (verschlüsselt) + `ai-key.json` (`{ hint }`).

Eingabe-Validierung beim Setzen: `apiKeySchema = z.string().trim().min(20).max(400).regex(/^\S+$/)`.
Ein Präfix wird bewusst nicht geprüft, weil sich Key-Formate ändern können.

## 4. Optimierungsauftrag – `cvOptimizationRequestSchema`

| Feld | Typ | Regel |
|---|---|---|
| `cvText` | `string` | trim, 1 – 30 000 Zeichen (`MAX_CV_CHARS`) |
| `jobDescription` | `string` | trim, 1 – 15 000 Zeichen |
| `applicationId` | `string \| null` | optional, Bezug für Titel und „Als Dokument speichern“ |
| `jobTitle` | `string` | max. 200 Zeichen, Anzeige im Ergebnis (z. B. „Frontend-Entwickler · Acme“) |

## 5. Stil – `variantStyleSchema`

`z.enum(['factual', 'impactful', 'ats'])`, Anzeigenamen in `VARIANT_STYLE_LABELS`:
`factual` → „Sachlich“, `impactful` → „Wirkungsstark“, `ats` → „ATS-optimiert“. Die Reihenfolge ist fest
(`VARIANT_STYLES`).

## 6. Bewertung – `assessmentSchema`

| Feld | Typ | Regel |
|---|---|---|
| `score` | `number` | Ganzzahl, 0 – 100 |
| `coveredKeywords` | `string[]` | max. 25, eindeutig |
| `missingKeywords` | `string[]` | max. 25, eindeutig |

Nachbearbeitung (Domain, `normalizeAssessment`): Keywords werden getrimmt und dedupliziert. Ein
„abgedecktes“ Keyword, das (case-insensitiv) nicht im Text vorkommt, wird zu „fehlend“ verschoben (R2).

## 7. Variante – `cvVariantSchema`

| Feld | Typ | Regel |
|---|---|---|
| `style` | `VariantStyle` | |
| `text` | `string` | nicht leer |
| `changes` | `string[]` | 1 – 5 Einträge (FR-019) |
| `assessment` | `Assessment` | |
| `inventedNumbers` | `string[]` | lokal berechnet (R3). Ist die Liste nicht leer, erscheint ein Warnhinweis |

## 8. Optimierungsergebnis – `cvOptimizationResultSchema`

| Feld | Typ | Regel |
|---|---|---|
| `id` | `string` | |
| `createdAt` | `string` | ISO-Zeitstempel |
| `applicationId` | `string \| null` | |
| `jobTitle` | `string` | |
| `original` | `{ text: string; assessment: Assessment }` | |
| `variants` | `CvVariant[]` | genau 3, Reihenfolge = `VARIANT_STYLES` |

Abgeleitete Werte (Domain, rein, getestet):

- `scoreDelta(result, style)` → `variant.score − original.score` (vorzeichenbehaftet, Anzeige „+18“ / „−3“ / „±0“)
- `bestVariant(result)` → Stil mit höchstem Score. Bei Gleichstand gewinnt die Reihenfolge in `VARIANT_STYLES`.
  Liegt keine Variante über dem Original, gibt es keine Markierung „Beste Übereinstimmung“, sondern den
  Hinweis „Keine Variante übertrifft das Original“.

Persistenz: `cv-last-result.json` (siehe Research R9). Es wird genau ein Ergebnis gespeichert.

## 9. KI-Antwortformate (Structured Outputs, nur Main)

- `generationOutputSchema`: `{ text: string, changes: string[] }`
- `assessmentOutputSchema`: `{ original: Assessment, factual: Assessment, impactful: Assessment, ats: Assessment }`

Diese Schemas liegen in `src/shared/domain/cv/schemas.ts`, damit dieselbe Validierung im Main und in
den Tests gilt.

## 10. Fehlercodes – `AiErrorCode`

`'no-key' | 'encryption-unavailable' | 'invalid-key' | 'network' | 'rate-limit' | 'too-long' |
'bad-response' | 'refused' | 'server' | 'canceled' | 'busy' | 'unreadable-file' | 'no-text' |
'file-too-large' | 'unsupported-file'`

Jeder Code hat in `AI_ERROR_MESSAGES` einen deutschen `title` und einen `hint` (Lösungshinweis).

## Zustandsübergänge der Ansicht (Renderer, `useCvOptimization`)

```text
idle ──(Datei/Text + Stelle gültig)──▶ ready
ready ──(Optimieren, Zustimmung fehlt)──▶ consent ──(Zustimmen)──▶ running
                                              └──(Abbrechen)──▶ ready
ready ──(Optimieren, Zustimmung vorhanden)──▶ running
running ──(Erfolg)──▶ result
running ──(Fehler)──▶ error ──(Erneut versuchen)──▶ running
running ──(Abbrechen)──▶ ready
result ──(Neue Optimierung)──▶ ready     result ──(Verwerfen)──▶ idle
```
