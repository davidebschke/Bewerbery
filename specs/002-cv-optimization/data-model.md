# Data Model: KI-gestützte Lebenslauf-Optimierung

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Alle Schemas sind Zod-Schemas in `src/shared/`, die Typen werden per `z.infer` abgeleitet.

## 1. Bewerbung (erweitert) – `applicationSchema`

| Feld | Typ | Regel |
|---|---|---|
| `jobDescription` *(neu)* | `string` | `default('')`, max. 15 000 Zeichen (`MAX_JOB_DESCRIPTION_CHARS`) |

- Das Feld kommt auch in `applicationInputSchema` (Formularfeld „Stellenanzeige“, mehrzeilig).
- Es ist abwärtskompatibel: Altdaten ohne das Feld erhalten `''`, und `DATA_VERSION` bleibt unverändert.
- Der Tabellen-Import ordnet das Feld vorerst nicht zu, das liegt außerhalb des Umfangs.

## 2. Einstellungen (erweitert) – `settingsSchema`

| Feld | Typ | Regel |
|---|---|---|
| `aiConsentAt` *(neu)* | `string \| null` | ISO-Zeitstempel der Datenschutz-Zustimmung, `default(null)` |

`null` bedeutet, dass vor dem nächsten Senden der Datenschutzhinweis erscheint. „Zustimmung widerrufen“ setzt `null`.

## 3. KI-Key-Status – `aiKeyStatusSchema` (enthält nie den Key selbst)

| Feld | Typ | Regel |
|---|---|---|
| `configured` | `boolean` | |
| `hint` | `string \| null` | die letzten 4 Zeichen oder `null` |
| `encryptionAvailable` | `boolean` | bei `false` ist Speichern deaktiviert (FR-006) |

Eingabe: `apiKeySchema = z.string().trim().min(20).max(400).regex(/^\S+$/)`.

## 4. CV-Quelle – `cvSourceSchema`

Wird beim Wählen der Datei im Main erzeugt und nur im Speicher gehalten. Erst nach einem erfolgreichen
Lauf wird die Datei zusammen mit dem Ergebnis unter `userData/cv/last-source.<ext>` abgelegt.

| Feld | Typ | Regel |
|---|---|---|
| `format` | `'docx' \| 'odt'` | |
| `fileName` | `string` | Originalname, z. B. `Lebenslauf.docx` |
| `paragraphs` | `CvParagraph[]` | max. 600, Dokumentreihenfolge |
| `charCount` | `number` | Summe der Segmentlängen, ≤ 30 000 (`MAX_CV_CHARS`) |

**`CvParagraph`**: `{ id: string; segments: string[]; editable: boolean }`

- `id` ist stabil innerhalb der Quelle (`p0`, `p1`, …, in Dokumentreihenfolge).
- `segments` sind die Texte der Formatierungsabschnitte (siehe Research R4). Strukturelemente (Tab,
  Umbruch) trennen Segmente und erscheinen nicht im Text.
- `editable` ist `false` für leere Absätze bzw. Absätze ohne Buchstaben. Solche Absätze gehen nicht an die KI.

Abgeleitet: `paragraphText(p) = segments.join('')`, `sourceText(source)` = Absätze mit `\n` verbunden.

## 5. Optimierungsauftrag – `cvOptimizationRequestSchema` (Renderer → Main)

| Feld | Typ | Regel |
|---|---|---|
| `jobDescription` | `string` | getrimmt, 1 – 15 000 Zeichen |
| `applicationId` | `string \| null` | Bezug für Titel und „An Bewerbung speichern“ |
| `jobTitle` | `string` | max. 200 Zeichen, wird im Ergebnis angezeigt |

Die CV-Quelle wird nicht übertragen. Der Main-Prozess verwendet die zuletzt gewählte Quelle, gibt es
keine, liefert er `no-source`.

## 6. Stil – `variantStyleSchema`

`z.enum(['factual', 'impactful', 'ats'])` mit festen Labels: „Sachlich“, „Wirkungsstark“, „ATS-optimiert“. Die Reihenfolge ist `VARIANT_STYLES`.

## 7. Bewertung – `assessmentSchema`

| Feld | Typ | Regel |
|---|---|---|
| `score` | `number` | Ganzzahl 0 – 100 |
| `coveredKeywords` | `string[]` | max. 25, eindeutig |
| `missingKeywords` | `string[]` | max. 25, eindeutig |

`normalizeAssessment(assessment, text)`: Keywords werden getrimmt und dedupliziert. Ein „abgedecktes“ Keyword, das (ohne Beachtung der Groß-/Kleinschreibung) nicht im Text vorkommt, wird nach „fehlend“ verschoben.

## 8. Variante – `cvVariantSchema`

| Feld | Typ | Regel |
|---|---|---|
| `style` | `VariantStyle` | |
| `rewrites` | `Record<string, string[]>` | Absatz-ID → neue Segmente. Es sind nur gültige, geänderte Absätze enthalten |
| `changes` | `string[]` | 1 – 5 Einträge |
| `assessment` | `Assessment` | |
| `inventedNumbers` | `string[]` | lokal berechnet (R3) |
| `lengthRatio` | `number` | Textlänge Variante / Original. Ein Wert > 1,15 löst den Layout-Hinweis aus (FR-023a) |

Domain-Funktionen (rein, getestet):

- `mergeRewrite(source, aiParagraphs)` → `rewrites`. Verworfen werden unbekannte IDs, nicht editierbare
  Absätze, Abweichungen in der Segmentanzahl und leere Ergebnisse für nicht leere Absätze. Unverändert
  gelieferte Absätze werden nicht aufgenommen.
- `applyRewrites(source, rewrites)` → `CvParagraph[]` (für Vorschau, Text und Bewertung)
- `variantText(source, variant)` → reiner Text (Kopieren, Bewertung, Plausibilität)

## 9. Optimierungsergebnis – `cvOptimizationResultSchema`

| Feld | Typ | Regel |
|---|---|---|
| `id` | `string` | |
| `createdAt` | `string` | ISO-Zeitstempel |
| `applicationId` | `string \| null` | |
| `jobTitle` | `string` | |
| `source` | `CvSource` | Absatzstruktur der Quelle zum Zeitpunkt des Laufs |
| `originalAssessment` | `Assessment` | |
| `variants` | `CvVariant[]` | genau 3 in der Reihenfolge von `VARIANT_STYLES` |

Abgeleitet: `scoreDelta`, `formatDelta` („+18“ / „−3“ / „±0“) und `bestVariant`. Bei Gleichstand
entscheidet die Reihenfolge der Stile. Liegt keine Variante über dem Original, wird keine markiert, und
es erscheint der Hinweis „Keine Variante übertrifft das Original“.

Persistenz: `userData/cv/last-result.json` + `userData/cv/last-source.<ext>` (Research R9).

## 10. KI-Antwortformate (Structured Outputs, nur Main)

- `generationOutputSchema`: `{ paragraphs: { id: string, segments: string[] }[], changes: string[] }`
- `assessmentOutputSchema`: `{ original, factual, impactful, ats }`, jeweils `Assessment`

Sie liegen in `src/shared/domain/cv/schemas.ts`.

## 11. Dokument-Bearbeitung (rein, `src/shared/domain/cv/document/`)

| Funktion | Zweck |
|---|---|
| `tokenizeXml(xml)` | Tokens mit `start`/`end`-Offsets (positionsgenau, ohne DTD- bzw. Entity-Auflösung); liegt als allgemeiner Baustein in `src/shared/xml/tokens.ts` und wird auch vom Tabellen-Import genutzt |
| `parseDocxParagraphs(xml)` | → `{ paragraphs, textNodes, hasTrackedChanges }`. Die Textknoten werden je Segment mit Offsets gemerkt |
| `parseOdtParagraphs(xml)` | dasselbe für `content.xml` |
| `rewriteXml(xml, nodes, rewrites)` | ersetzt Textknoten per Splicing von hinten nach vorn, escaped `& < > "` und kodiert Leerzeichen (ODT: `text:s`) |

Das ZIP-Lesen und -Schreiben (`fflate`) liegt in `src/main/cv/cvDocument.ts`. Alle Einträge außer dem
Haupt-XML werden byte-identisch übernommen, bei ODT bleibt `mimetype` der erste, unkomprimierte Eintrag.

## 12. Fehlercodes – `AiErrorCode`

`'no-key' | 'encryption-unavailable' | 'invalid-key' | 'network' | 'rate-limit' | 'too-long' |
'bad-response' | 'refused' | 'server' | 'canceled' | 'busy' | 'no-source' | 'unsupported-file' |
'pdf-not-supported' | 'file-too-large' | 'unreadable-file' | 'tracked-changes' | 'no-text' |
'save-failed'`

Zu jedem Code gibt es in `AI_ERROR_MESSAGES` einen deutschen `title` und einen `hint`. `pdf-not-supported`
enthält die Anleitung „Wähle die Word-Datei deines Lebenslaufs oder öffne die PDF in Word und speichere
sie als .docx“.

## Zustandsübergänge der Ansicht (Renderer, `useCvOptimization`)

```text
idle ──(Quelle gewählt + Stelle gültig)──▶ ready
ready ──(Optimieren, Zustimmung fehlt)──▶ consent ──(Zustimmen)──▶ running
                                              └──(Abbrechen)──▶ ready
ready ──(Optimieren, Zustimmung vorhanden)──▶ running
running ──(Erfolg)──▶ result
running ──(Fehler)──▶ error ──(Erneut versuchen)──▶ running
running ──(Abbrechen)──▶ ready
result ──(Neue Optimierung)──▶ ready     result ──(Verwerfen)──▶ idle
```
