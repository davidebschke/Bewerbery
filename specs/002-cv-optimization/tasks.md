---
description: "Tasks: KI-gestützte Lebenslauf-Optimierung (Issue #7)"
---

# Tasks: KI-gestützte Lebenslauf-Optimierung

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/ipc.md](./contracts/ipc.md), [quickstart.md](./quickstart.md)

**Tests**: Pflicht laut Constitution III (Test-First, Coverage ≥ 90 %). Jede Task, die eine Datei in
`src/` anlegt oder ändert, enthält den gespiegelten Test unter `tests/unit/…` und wird **test-first**
umgesetzt. Kein Test sendet echte Netzwerkanfragen (SC-007).

**Quality Gate je Commit**: `npm run typecheck; npm run lint; npm test`. Commits nach Conventional Commits.
Nach jedem Code-Commit wird die README (DE + EN) gemäß `.claude/rules/documentation.md` geprüft.

## Format: `[ID] [P?] [Story] Beschreibung`

- **[P]**: parallel ausführbar (andere Dateien, keine offenen Abhängigkeiten)
- **[USx]**: zugehörige User Story aus spec.md

---

## Phase 1: Setup

**Zweck**: Governance und Abhängigkeiten. Ohne T001 ist das Feature constitution-widrig.

- [ ] T001 Constitution auf **v1.1.0** anheben in `.specify/memory/constitution.md`: Prinzip I um eine Opt-in-Ausnahme ergänzen („Netzwerkzugriff ausschließlich zur Anthropic-API, nur mit vom Nutzer hinterlegtem API-Key und nur auf ausdrückliche Nutzeraktion; vor dem ersten Senden Datenschutzhinweis; API-Key verschlüsselt, nie im Renderer“), „Last Amended: 2026-11-17“ setzen und den Versionssprung begründen. Commit `docs: amend constitution to v1.1.0 for opt-in ai access`
- [ ] T002 Ausnahme spiegeln: `CLAUDE.md` (Datenfluss + Hinweis auf KI-Dateien `ai-key.*`, `cv/`) und `.claude/rules/architecture.md` („Keine Netzwerkzugriffe (Local-First)“ → „Netzwerk nur über `src/main/ai/` gemäß Constitution I“)
- [ ] T003 `@anthropic-ai/sdk@^1.9.0` als dependency installieren (`npm install @anthropic-ai/sdk`). Danach `npm run build` ausführen und prüfen, dass der Main-Bundle-Build gelingt (das SDK läuft im Main-Prozess). Eigener Commit `chore(deps): add @anthropic-ai/sdk` (ein Commit pro Abhängigkeit)

---

## Phase 2: Foundational (blockiert alle Stories)

**Zweck**: Gemeinsame Schemas, Konstanten, Fehlercodes und IPC-Grundgerüst

- [ ] T004 [P] Konstanten in `src/shared/constants.ts` ergänzen: `MAX_CV_CHARS = 30_000`, `MAX_JOB_DESCRIPTION_CHARS = 15_000`, `MAX_CV_FILE_BYTES = 10 * 1024 * 1024`, `MAX_CV_PARAGRAPHS = 600`, `LENGTH_WARNING_RATIO = 1.15`, `CLAUDE_MODEL = 'claude-opus-5-5'`. Test in `tests/unit/shared/constants.test.ts` ergänzen
- [ ] T005 [P] `src/shared/schemas.ts` erweitern: `applicationSchema.jobDescription = z.string().max(MAX_JOB_DESCRIPTION_CHARS).default('')`, auch in `applicationInputSchema.pick`. `settingsSchema.aiConsentAt = z.string().nullable().default(null)`. Tests in `tests/unit/shared/schemas.test.ts`: Altdaten ohne die Felder bleiben ladbar (`''` / `null`), 15 001 Zeichen werden abgelehnt
- [ ] T006 [P] Fehlercodes in `src/shared/domain/cv/aiErrors.ts`: `AiErrorCode` (exakt die 18 Codes aus data-model.md §12), `AI_ERROR_MESSAGES: Record<AiErrorCode, { title: string; hint: string }>` auf Deutsch (`pdf-not-supported`-Hinweis: „Wähle die Word-Datei deines Lebenslaufs oder öffne die PDF in Word und speichere sie als .docx“), Typ `AiResult<T> = { ok: true; value: T } | { ok: false; error: AiErrorCode }` und Helfer `ok()`/`fail()`. Test `tests/unit/shared/domain/cv/aiErrors.test.ts` (jeder Code hat nicht leeren Titel und Hinweis)
- [ ] T007 [P] Domain-Schemas in `src/shared/domain/cv/schemas.ts` laut data-model.md §3–§10: `apiKeySchema = z.string().trim().min(20).max(400).regex(/^\S+$/)`, `aiKeyStatusSchema`, `cvParagraphSchema`, `cvSourceSchema` (`format: z.enum(['docx','odt'])`, `paragraphs` max. 600), `cvOptimizationRequestSchema` (`jobDescription` trim 1–15 000, `applicationId` nullable, `jobTitle` max. 200), `assessmentSchema` (`score` int 0–100, Keyword-Listen max. 25), `cvVariantSchema`, `cvOptimizationResultSchema` (`variants` genau 3), `generationOutputSchema`, `assessmentOutputSchema`, plus abgeleitete Typen. Test `tests/unit/shared/domain/cv/schemas.test.ts`
- [ ] T008 [P] Stile in `src/shared/domain/cv/styles.ts`: `VARIANT_STYLES = ['factual','impactful','ats'] as const`, `VARIANT_STYLE_LABELS` („Sachlich“, „Wirkungsstark“, „ATS-optimiert“), `VARIANT_STYLE_INSTRUCTIONS` (Stil-Anweisungen fürs Prompt). Test `tests/unit/shared/domain/cv/styles.test.ts`
- [ ] T009 IPC-Vertrag in `src/shared/ipc.ts`: 12 Kanäle aus contracts/ipc.md (`ai:key-status`, `ai:set-key`, `ai:test-key`, `ai:remove-key`, `cv:pick-file`, `cv:read-file`, `cv:optimize`, `cv:cancel`, `cv:last-result`, `cv:clear-last-result`, `cv:save-variant`, `cv:attach-variant`) mit Signaturen in `BewerberyApi`. Danach `src/renderer/src/test/mockApi.ts` um Standard-Mocks erweitern (kein Key, Beispielquelle, festes Beispielergebnis, `getLastCvResult → null`), damit Typecheck und bestehende Tests grün bleiben

**Checkpoint**: Typecheck grün, alle bestehenden 394 Tests grün

---

## Phase 3: User Story 1 – API-Key verwalten (P1) 🎯 MVP-Teil 1

**Ziel**: Key in den Einstellungen speichern, prüfen und entfernen. Er wird verschlüsselt gespeichert und nie an den Renderer gegeben.

**Unabhängiger Test**: Key eingeben → „Verbindung prüfen“ → „Key gültig“. Nach einem Neustart steht „Key hinterlegt (…abcd)“. In `userData` ist kein Klartext zu finden.

- [ ] T010 [P] [US1] `src/main/ai/secretStore.ts`: `createSecretStore(dir, crypto)` mit injiziertem `crypto = { isEncryptionAvailable(): boolean; encryptString(s): Buffer; decryptString(b): string }`. Methoden `status(): Promise<AiKeyStatus>`, `set(key)`, `get(): Promise<string | null>`, `remove()`. Speichert `ai-key.bin` (verschlüsselt) + `ai-key.json` (`{ hint }`, letzte 4 Zeichen) atomar (Temp-Datei + Rename). Ohne Verschlüsselung liefert `set` den Fehler `encryption-unavailable`, und es wird nichts geschrieben. Test `tests/unit/main/ai/secretStore.test.ts` mit `mkdtemp` und Fake-Crypto: Der Klartext-Key kommt in keiner geschriebenen Datei vor (SC-004), Ersetzen, Entfernen, beschädigte Datei → `configured: false`
- [ ] T011 [P] [US1] `src/main/ai/claudeClient.ts` (Teil 1): `createAiClient({ createClient: (apiKey) => AnthropicLike })` mit `testKey(apiKey, signal?)` (minimale `messages.create`-Anfrage mit `model: CLAUDE_MODEL`, `max_tokens: 16`) und `mapAiError(error): AiErrorCode` laut research.md R6 (SDK-Klassen `AuthenticationError`/`PermissionDeniedError` → `invalid-key`, `RateLimitError` → `rate-limit`, `APIConnectionError`/`APIConnectionTimeoutError` → `network`, `APIUserAbortError` → `canceled`, `BadRequestError` mit Kontext-Überschreitung → `too-long`, `APIError` ≥ 500 → `server`, sonst `server`). Standard-`createClient` erzeugt `new Anthropic({ apiKey, maxRetries: 2 })`. Test `tests/unit/main/ai/claudeClient.test.ts` mit Fake-Client und echten SDK-Fehlerinstanzen
- [ ] T012 [US1] Handler in `src/main/ipc/registerIpc.ts` für `ai:key-status`, `ai:set-key`, `ai:test-key`, `ai:remove-key` (Nutzlast mit `apiKeySchema` validieren; `testAiKey()` ohne Argument nutzt den gespeicherten Key, ohne Key gibt es `no-key`; kein Rückgabewert enthält den Key). `IpcDeps` um `secrets` und `ai` erweitern. Tests in `tests/unit/main/ipc/registerIpc.test.ts`
- [ ] T013 [P] [US1] Weiterleitungen der vier `ai:*`-Methoden in `src/preload/index.ts` + Test `tests/unit/preload/index.test.ts`
- [ ] T014 [US1] Glue-Code in `src/main/index.ts`: `createSecretStore(userData, safeStorage)`. Ist unter Linux `safeStorage.getSelectedStorageBackend() === 'basic_text'`, gilt `isEncryptionAvailable` als `false` (research.md R5). Außerdem `createAiClient()` erzeugen. Steht `BEWERBERY_AI_FAKE=1`, werden Fake-Store (In-Memory) und Fake-Client verwendet (`src/main/ai/fakeOptimizer.ts`, Teil 1: `testKey` liefert immer ok). Test `tests/unit/main/ai/fakeOptimizer.test.ts`
- [ ] T015 [US1] `src/renderer/src/features/settings/AiKeySection.tsx`: Abschnitt „KI-Assistent“ mit Status („Kein Key hinterlegt“ / „Key hinterlegt (…abcd)“), Passwortfeld `type="password"` mit Label, Buttons „Speichern“, „Verbindung prüfen“ und „Key entfernen“ (mit Bestätigung). Hinweis bei `encryptionAvailable: false`. „Zustimmung widerrufen“, wenn `settings.aiConsentAt` gesetzt ist. Link „Anthropic-Konsole öffnen“ nur über `isExternalUrl`. Meldungen aus `AI_ERROR_MESSAGES` in einer `aria-live`-Region. Eingebunden in `SettingsDialog.tsx`. Tests `tests/unit/renderer/features/settings/AiKeySection.test.tsx` (Rollen und Labels, Feld nach dem Speichern leer, Fehlermeldung bei `invalid-key`)

**Checkpoint**: US1 ist vollständig nutzbar. Commit `feat(settings): manage anthropic api key`

---

## Phase 4: User Story 2 – Lebenslauf auf eine Stelle optimieren (P1) 🎯 MVP-Teil 2

**Ziel**: DOCX/ODT einlesen (PDF ablehnen), Stellenanzeige wählen, drei Varianten mit erhaltenem Design erzeugen, Abbruch, Datenschutzhinweis.

**Unabhängiger Test**: Mit Key eine gestaltete DOCX und eine Stellenanzeige wählen → „Optimieren“ → Ergebnis mit drei Varianten. PDF → Anleitung. Abbrechen → keine Ergebnisse.

### Test-Fixtures

- [ ] T016 [US2] Fixture-Builder `tests/fixtures/cv/buildFixtures.ts` (Test-Support, erzeugt mit `fflate` echte ZIPs): `styled.docx` (Absätze mit gemischten Läufen, z. B. fettes „Skills:“ + normaler Text, aufgeteilte Läufe mit gleichem `w:rPr`, Tabelle, Textfeld `w:txbxContent`, `w:tab`, `w:br`, Feld mit `w:instrText`, Bild-Relationship, Kopfzeile), `tracked.docx` (`w:ins`/`w:del`), `styled.odt` (`mimetype` unkomprimiert zuerst, `text:p`/`text:h`/`text:span`/`text:s`/`text:tab`/`text:line-break`), `sample.pdf` (`%PDF-`-Header). Zusätzlich eine echte, mit Word gespeicherte `tests/fixtures/cv/word-real.docx` für E2E und manuelle Prüfung (vom Nutzer bereitgestellt oder per Skript erzeugt und in Word/LibreOffice geprüft)

### Dokument-Domain (Design-Erhalt, höchstes Risiko zuerst)

- [ ] T017 [P] [US2] `src/shared/domain/cv/document/xmlTokens.ts`: positionsgenauer Tokenizer (`tokenizeXml(xml) → Token[]` mit `kind`, `name`, `attributes`, `start`, `end`, `selfClosing`), ohne DTD- bzw. Entity-Auflösung, mit `decodeEntities`. Wiederverwendbare Regex aus `src/main/import/xml.ts` nach `shared` heben und dort importieren (keine Verhaltensänderung des Imports). Test `tests/unit/shared/domain/cv/document/xmlTokens.test.ts` (Offsets ergeben per `slice` exakt das Original, CDATA, Kommentare, Self-Closing)
- [ ] T018 [US2] `src/shared/domain/cv/document/docx.ts`: `parseDocxParagraphs(xml) → { paragraphs: CvParagraph[]; nodes: TextNodeRef[]; hasTrackedChanges: boolean }`. Segmente = `w:r` mit `w:t`. Benachbarte Läufe mit identischem serialisiertem `w:rPr` werden zusammengefasst. `w:tab`/`w:br` trennen Segmente. `w:instrText`/`w:delText` werden ignoriert. Absätze in Tabellen, `w:txbxContent` und `w:sdt` werden erfasst. `editable = /\p{L}/u.test(text)`. IDs `p0…pn`. Test `tests/unit/shared/domain/cv/document/docx.test.ts` mit `styled.docx`-XML
- [ ] T019 [P] [US2] `src/shared/domain/cv/document/odt.ts`: `parseOdtParagraphs(xml)` analog für `text:p`/`text:h`, Segmente = direkte Textknoten bzw. `text:span` (gleicher `text:style-name` wird zusammengefasst), `text:s` (mit `text:c`) zählt als Leerzeichen im Segmenttext, `text:tab`/`text:line-break` trennen Segmente. Test `tests/unit/shared/domain/cv/document/odt.test.ts`
- [ ] T020 [US2] `src/shared/domain/cv/document/rewriteXml.ts`: `rewriteXml(xml, nodes, rewrites, format) → string`. Pro Segment erhält der erste Textknoten den neuen Text, die weiteren Knoten des Segments werden geleert. Splicing läuft von hinten nach vorn. Escaping von `& < > "`. DOCX: `xml:space="preserve"` am `w:t` setzen bzw. ergänzen. ODT: Mehrfach-Leerzeichen → `<text:s text:c="n"/>`. Test `tests/unit/shared/domain/cv/document/rewriteXml.test.ts`: Ohne Rewrites ist das Ergebnis byte-identisch. Mit Rewrites ist jedes nicht-textuelle Token unverändert, und das XML bleibt wohlgeformt (erneut tokenisierbar, gleiche Tag-Folge). Sonderzeichen werden korrekt escaped
- [ ] T021 [P] [US2] `src/shared/domain/cv/rewrite.ts`: `mergeRewrite(source, aiParagraphs)` (verwirft unbekannte IDs, nicht editierbare Absätze, abweichende Segmentanzahl, leere Ergebnisse für nicht leere Absätze und unveränderte Absätze), `applyRewrites(source, rewrites)`, `variantText(source, rewrites)`, `lengthRatio(source, rewrites)`. Test `tests/unit/shared/domain/cv/rewrite.test.ts`

### Fach-Domain

- [ ] T022 [P] [US2] `src/shared/domain/cv/limits.ts`: `checkCvLimits(source)` (≤ 30 000 Zeichen, ≤ 600 Absätze) und `checkJobDescription(text)` (trim 1–15 000) liefern `{ ok } | { ok: false; field; excess }`. Test `tests/unit/shared/domain/cv/limits.test.ts`
- [ ] T023 [P] [US2] `src/shared/domain/cv/prompts.ts`: `buildGenerationPrompt(style, source, jobDescription)` (System: nur umformulieren, **keine** neuen Fakten, Arbeitgeber, Daten, Abschlüsse, Zahlen oder Zertifikate, keine Absätze hinzufügen oder entfernen, gleiche Segmentanzahl je Absatz, Länge je Absatz ±15 %, Sprache des Originals, max. 5 Änderungen; User: nur editierbare Absätze als JSON `[{id, segments}]` + Stellenanzeige) und `buildAssessmentPrompt(texts, jobDescription)` (festes Bewertungsschema 0–100, gleiche Kriterien für alle vier Texte). Stabile Reihenfolge, damit Prompt-Caching greift. Test `tests/unit/shared/domain/cv/prompts.test.ts` (Pflichtregeln enthalten, nicht editierbare Absätze ausgeschlossen, deterministisch)
- [ ] T024 [P] [US2] `src/shared/domain/cv/plausibility.ts`: `findInventedNumbers(originalText, variantText)` liefert Zahlen und Jahreszahlen der Variante, die im Original fehlen (normalisiert: `1.000` = `1000`, `%`). Test `tests/unit/shared/domain/cv/plausibility.test.ts`
- [ ] T025 [P] [US2] `src/shared/domain/cv/assessment.ts`: `normalizeAssessment(assessment, text)` (trimmen, deduplizieren, nicht vorkommende „abgedeckte“ Keywords nach „fehlend“ verschieben), `scoreDelta`, `formatDelta` („+18“ / „−3“ / „±0“), `bestVariant(result)` (bei Gleichstand gilt die Reihenfolge `VARIANT_STYLES`; `null`, wenn keine Variante über dem Original liegt). Test `tests/unit/shared/domain/cv/assessment.test.ts` mit festem Datum

### Main-Services

- [ ] T026 [US2] `src/main/cv/cvDocument.ts`: `readCvDocument(bytes, fileName) → AiResult<{ source: CvSource; parsed }>`. Erkennung per Magic Bytes und Endung: `%PDF-` → `pdf-not-supported`, kein ZIP bzw. OLE-Container → `unreadable-file`, andere Endungen → `unsupported-file`, > 10 MB → `file-too-large`, Tracked Changes → `tracked-changes`, kein editierbarer Absatz → `no-text`, dazu die Limits aus T022. `writeCvDocument(bytes, format, rewrites) → Uint8Array` packt alle ZIP-Einträge außer `word/document.xml` bzw. `content.xml` byte-identisch neu, bei ODT bleibt `mimetype` erster und unkomprimierter Eintrag. Test `tests/unit/main/cv/cvDocument.test.ts` mit Fixtures aus T016: Alle übrigen Einträge sind byte-identisch, Round-Trip ohne Rewrites ist inhaltsgleich, alle Fehlercodes werden abgedeckt
- [ ] T027 [US2] `src/main/ai/claudeClient.ts` (Teil 2): `generateVariant(apiKey, style, source, jobDescription, signal)` über `client.messages.parse({ model: CLAUDE_MODEL, max_tokens: 16000, output_config: { effort: 'medium', format: zodOutputFormat(generationOutputSchema) }, … }, { signal })` und `assessAll(apiKey, texts, jobDescription, signal)` mit `assessmentOutputSchema`. Prüfungen: `stop_reason === 'refusal'` → `refused`, `parsed_output === null` → `bad-response`. Ob serverseitige `fallbacks: 'default'` (Beta `server-side-fallback-2026-07-01`) mit `parse` im installierten SDK verfügbar sind, wird geprüft (research.md R1). Wenn ja, aktivieren und testen. Tests in `tests/unit/main/ai/claudeClient.test.ts` (Fake-Client, Abbruch per `AbortSignal`, alle Fehlerpfade)
- [ ] T028 [US2] `src/main/cv/cvService.ts`: `createCvService({ dir, secrets, ai, now, newId })` mit `loadSource(path)` (liest die Datei, `readCvDocument`, kopiert sie atomar nach `dir/cv/source.<ext>`), `optimize(request)` (prüft Key → `no-key`, Quelle → `no-source`, laufenden Lauf → `busy`, `checkJobDescription`. Startet drei `generateVariant` parallel mit gemeinsamem `AbortController` und danach `assessAll` über Original + drei Varianten. Ergänzt `normalizeAssessment`, `findInventedNumbers` und `lengthRatio`. Baut `CvOptimizationResult`), `cancel()`, `isRunning()`. Test `tests/unit/main/cv/cvService.test.ts` mit `mkdtemp` und Fake-AI: Erfolg, `busy`, Abbruch → `canceled`, Fehler einer Generierung → Lauf schlägt mit dem gemappten Code fehl, Eingaben bleiben erhalten
- [ ] T029 [US2] Handler in `src/main/ipc/registerIpc.ts` für `cv:pick-file` (Dialog über `deps.pickCvFile()`, Filter „Lebenslauf (DOCX, ODT)“, `null` bei Abbruch), `cv:read-file` (Pfad mit `z.string().min(1)`), `cv:optimize` (`cvOptimizationRequestSchema`) und `cv:cancel`. `ai:remove-key` bricht zusätzlich einen laufenden Lauf ab. Tests in `tests/unit/main/ipc/registerIpc.test.ts`
- [ ] T030 [P] [US2] Weiterleitungen `pickCvFile`, `readCvFile`, `optimizeCv`, `cancelCvOptimization` in `src/preload/index.ts` + Test
- [ ] T031 [US2] Glue-Code in `src/main/index.ts`: `createCvService(...)`, Dateidialog für CVs. `src/main/ai/fakeOptimizer.ts` (Teil 2) bekommt deterministische Varianten: Sie schreiben einzelne Segmente um, mit festen Scores 54/71/78/83. Test ergänzen

### Renderer

- [ ] T032 [P] [US2] Feld „Stellenanzeige“ (mehrzeilig, `maxLength` 15 000, Label) in `src/renderer/src/features/applications/ApplicationForm.tsx` + Test `tests/unit/renderer/features/applications/ApplicationForm.test.tsx`
- [ ] T033 [P] [US2] Store-Aktionen in `src/renderer/src/stores/appStore.ts`: `setAiConsent(at: string | null)`, `setJobDescription(applicationId, text)` („In Bewerbung speichern“). Test `tests/unit/renderer/stores/appStore.test.ts`
- [ ] T034 [US2] `src/renderer/src/features/cv-optimization/useCvOptimization.ts`: Zustandsautomat laut data-model.md (idle → ready → consent → running → result/error). Ruft `optimizeCv`/`cancelCvOptimization` auf und verhindert Doppelstarts. Test `tests/unit/renderer/features/cv-optimization/useCvOptimization.test.ts`
- [ ] T035 [P] [US2] `src/renderer/src/features/cv-optimization/ConsentDialog.tsx`: `role="dialog"` mit Titel „Daten werden an Anthropic gesendet“, Text zu CV und Stellenanzeige, Buttons „Zustimmen und senden“ und „Abbrechen“. Test `…/ConsentDialog.test.tsx`
- [ ] T036 [US2] `src/renderer/src/features/cv-optimization/CvInputPanel.tsx`: Dateiauswahl und Drag & Drop (`getPathForFile` → `readCvFile`), Vorschau der Absätze (nur lesend, Dateiname und Format), Fehler mit `title` und `hint` (PDF-Anleitung), Auswahl der Bewerbung (übernimmt `jobDescription`) bzw. Textfeld für die Stellenanzeige mit Zeichenzähler und „In Bewerbung speichern“, Button „Optimieren“ (ohne Key deaktiviert, mit Link „Zu den Einstellungen“). Test `…/CvInputPanel.test.tsx`
- [ ] T037 [US2] `src/renderer/src/features/cv-optimization/CvOptimizationView.tsx` (Seite: Eingabe ↔ Ladezustand mit Phasen „Varianten werden erstellt …“ / „Bewertung …“ in `role="status"` + „Abbrechen“ ↔ Fehler mit „Erneut versuchen“ ↔ Ergebnis-Platzhalter) und Navigation in `src/renderer/src/App.tsx` (Umschaltung „Bewerbungen | CV-Optimierung“ im Header mit `aria-current`, ab 360 px ohne Umbruchprobleme). Lädt `getAiKeyStatus` beim Öffnen. Tests `…/CvOptimizationView.test.tsx` und `tests/unit/renderer/App.test.tsx`

**Checkpoint**: US2 ist mit Fake- und echtem Key nutzbar. Commits je Baustein, z. B. `feat(cv): parse and rewrite docx/odt preserving design`, `feat(ai): generate and assess cv variants`, `feat(cv): add cv optimization view`

---

## Phase 5: User Story 3 – Varianten nebeneinander vergleichen (P1) 🎯 MVP-Teil 3

**Ziel**: Original und drei Varianten mit Score, Δ, Keywords und Änderungen. Speichern im Originaldesign.

**Unabhängiger Test**: Mit festem Beispielergebnis (Mock) gibt es vier Spalten, die beste Variante ist markiert, unter 768 px werden Tabs angezeigt. „An Bewerbung speichern“ legt die Datei an der Bewerbung ab.

- [ ] T038 [P] [US3] `src/renderer/src/features/cv-optimization/ScoreBadge.tsx`: Score als Zahl + Ring (`role="img"`, `aria-label="Übereinstimmung 78 von 100"`), Δ-Text über `formatDelta`, Farben nur über Design-Tokens. Test `…/ScoreBadge.test.tsx`
- [ ] T039 [P] [US3] `src/renderer/src/features/cv-optimization/VariantColumn.tsx`: Kopf mit Label, ScoreBadge und Badge „Beste Übereinstimmung“; abgedeckte und fehlende Keywords als Listen; „Wichtigste Änderungen“ (max. 5); Text-Vorschau mit hervorgehobenen geänderten Absätzen; Warnhinweise für `inventedNumbers` („Bitte prüfen: Zahl … steht nicht im Original“) und `lengthRatio > 1,15` („Text ist X % länger – Layout prüfen“). Aktionen „Speichern unter …“, „An Bewerbung speichern“ (nur mit `applicationId` und existierender Bewerbung) und „Text kopieren“. Das Original zeigt keine Aktionen. Test `…/VariantColumn.test.tsx`
- [ ] T040 [US3] `src/renderer/src/features/cv-optimization/ComparisonView.tsx`: ab `md` vier Spalten (`grid-cols-4`, scrollbare Spalten-Inhalte), unter `md` Tabs (`role="tablist"`, Pfeiltasten-Navigation), ohne horizontales Scrollen ab 360 px. Hinweis „Keine Variante übertrifft das Original“, wenn `bestVariant` `null` liefert. Kopfzeile mit Stellentitel und Datum. In `CvOptimizationView` eingebunden. Test `…/ComparisonView.test.tsx` (Spalten- und Tab-Modus über `matchMedia`-Mock)
- [ ] T041 [P] [US3] `src/main/documents/documentService.ts`: `importBuffer(applicationId, fileName, bytes) → ApplicationDocument` (Name über `sanitizeFileName`, Kollisionen wie bei `importFiles`). Test `tests/unit/main/documents/documentService.test.ts`
- [ ] T042 [US3] `cvService.saveVariant(style, targetPath)` und `cvService.attachVariant(style, applicationId)` in `src/main/cv/cvService.ts` (lesen die Quelle und die Rewrites aus dem letzten Ergebnis und schreiben mit `writeCvDocument`; Dateiname `<Originalname> – <Stil-Label>.<ext>`). Handler `cv:save-variant` (Speichern-Dialog über `deps.saveCvFile(suggestedName, format)`) und `cv:attach-variant` in `registerIpc.ts`, Preload-Weiterleitungen und Tests (`cvService.test.ts`, `registerIpc.test.ts`, `preload/index.test.ts`). Die geschriebene Datei wird erneut mit `readCvDocument` gelesen. Absatzanzahl und Segmentstruktur stimmen mit dem Original überein (SC-008)
- [ ] T043 [US3] Store-Aktion `attachDocument(applicationId, document)` in `src/renderer/src/stores/appStore.ts`, verbunden mit „An Bewerbung speichern“ (Toast „Variante an Bewerbung gespeichert“), dazu Kopieren über `navigator.clipboard.writeText(variantText(...))` mit Toast. Tests in `appStore.test.ts` und `VariantColumn.test.tsx`

**Checkpoint**: Der MVP (US1–US3) ist vollständig. Commit `feat(cv): compare variants and save them in original design`

---

## Phase 6: User Story 4 – Letzte Optimierung wiederfinden (P3)

**Ziel**: Das letzte Ergebnis samt Quelldatei übersteht einen Neustart und lässt sich verwerfen.

**Unabhängiger Test**: Optimieren → App neu starten → Ergebnis ist sichtbar und als Datei speicherbar. „Verwerfen“ löscht es.

- [ ] T044 [US4] `src/main/cv/lastResultStore.ts`: `createLastResultStore(dir)` mit `save(result)` (atomar `cv/last-result.json`), `load()` (Zod-validiert; ungültige Datei oder fehlende `cv/source.<ext>` → Datei löschen und `null` zurückgeben) und `clear()` (Ergebnis + Quelle). `cvService.optimize` speichert nach Erfolg. Test `tests/unit/main/cv/lastResultStore.test.ts` mit `mkdtemp`
- [ ] T045 [US4] Handler `cv:last-result` und `cv:clear-last-result` in `registerIpc.ts`, Preload-Weiterleitungen und Tests. `cvService` stellt nach einem Neustart die Quelle aus `cv/source.<ext>` wieder her, damit `saveVariant`/`attachVariant` funktionieren
- [ ] T046 [US4] In `CvOptimizationView.tsx`/`useCvOptimization.ts` beim Öffnen `getLastCvResult()` laden und direkt die Vergleichsansicht zeigen (mit Datum „Optimiert am …“). Buttons „Neue Optimierung“ und „Verwerfen“ (mit Bestätigung). Tests ergänzen

**Checkpoint**: Alle Stories sind fertig. Commit `feat(cv): keep the last optimization result`

---

## Phase 7: Polish & Querschnitt

- [ ] T047 E2E `tests/e2e/cv-optimization.spec.ts` mit `BEWERBERY_AI_FAKE=1` und isoliertem `BEWERBERY_USER_DATA`: Key speichern → Ansicht öffnen → `word-real.docx` wählen → Stellenanzeige einfügen → Datenschutzhinweis zustimmen → vier Spalten sichtbar → „An Bewerbung speichern“ → Dokument in der Bewerbung sichtbar. Zusätzlich eine PDF wählen → Anleitung sichtbar. Prüfen, dass `userData` den Fake-Key nicht im Klartext enthält
- [ ] T048 [P] Barrierefreiheit und Responsivität prüfen: Tastaturbedienung aller neuen Elemente, `aria-live` für Lade- und Fehlerzustand, 360 px ohne horizontales Scrollen, „Bewegung reduzieren“ für Lade-Animationen. Gefundene Probleme beheben und Tests ergänzen
- [ ] T049 [P] Netzwerk-Invariante absichern: Test in `tests/unit/main/ai/claudeClient.test.ts` bzw. `cvService.test.ts` prüft, dass `createClient` nur aus `testKey`, `generateVariant` und `assessAll` aufgerufen wird. Per `grep` prüfen, dass `@anthropic-ai/sdk` ausschließlich in `src/main/ai/` importiert wird (SC-005)
- [ ] T050 README (DE + EN, deckungsgleich) gemäß `.claude/rules/documentation.md`: Funktionsbeschreibung CV-Optimierung (DOCX/ODT, Design-Erhalt, PDF-Hinweis), Datenschutzhinweis zur Opt-in-Netzwerknutzung, neue Abhängigkeit in der Tech-Stack-Tabelle, Projektstruktur (`main/ai`, `main/cv`, `shared/domain/cv`, `features/cv-optimization`), Test-Hinweis zu `BEWERBERY_AI_FAKE`
- [ ] T051 `npm run test:all` und `npm run dist` ausführen. Quickstart-Szenarien 1–15 manuell mit echtem Key durchgehen, besonders Szenario 12/12a: Variante in Word und LibreOffice öffnen, kein Reparaturdialog, und „Vergleichen“ zeigt nur Textänderungen

---

## Dependencies & Execution Order

### Phasen

- **Phase 1 (Setup)**: T001 → T002, T003 unabhängig
- **Phase 2 (Foundational)**: nach Phase 1. T004–T008 parallel, T009 nach T006/T007
- **Phase 3 (US1)**: nach Phase 2. T010 ∥ T011 ∥ T013 → T012 → T014 → T015
- **Phase 4 (US2)**: nach Phase 2, technisch unabhängig von US1 (Mocks). T016 → T017 → T018 ∥ T019 → T020. T021–T025 parallel. T026 nach T020/T022. T027 nach T011/T023. T028 nach T026/T027/T021/T024/T025. T029–T031 nach T028. T032–T035 parallel. T036 → T037
- **Phase 5 (US3)**: Die UI (T038–T040) kann mit Mock-Ergebnis nach Phase 2 starten. T041 ∥, T042 nach T026/T028/T041, T043 nach T042
- **Phase 6 (US4)**: nach T028 und T040
- **Phase 7**: nach allen gewünschten Stories

### User Stories

- **US1** und **US2** sind unabhängig testbar (US2-Tests nutzen den Mock-Key-Status). Für die echte Nutzung braucht US2 den Key aus US1
- **US3** braucht für die Anzeige nur das Ergebnis-Schema (Mock), für „Speichern“ den `cvService` aus US2
- **US4** baut auf US2 und US3 auf

## Parallel-Beispiele

```text
# Phase 2 gleichzeitig:
T004 constants · T005 schemas · T006 aiErrors · T007 cv/schemas · T008 styles

# US2 Domain gleichzeitig (nach T017):
T019 odt · T021 rewrite · T022 limits · T023 prompts · T024 plausibility · T025 assessment

# US3 UI gleichzeitig (mit Mock-Ergebnis):
T038 ScoreBadge · T039 VariantColumn · T041 documentService.importBuffer
```

## Implementation Strategy

1. **Governance zuerst** (T001–T002), damit kein constitution-widriger Code entsteht
2. **Risiko zuerst**: T016–T020 (Design-Erhalt beim Zurückschreiben) früh umsetzen und eine geschriebene
   Fixture in Word und LibreOffice öffnen, bevor die KI-Anbindung entsteht
3. **MVP = US1 + US2 + US3** (alle P1): erst dann ist der Nutzen „optimierte Varianten im eigenen Design“
   vollständig. US4 (P3) folgt als Komfort
4. Nach jedem Checkpoint läuft das Quality Gate, dann folgen Commit und README-Abgleich
