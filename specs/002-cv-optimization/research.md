# Research: KI-gestützte Lebenslauf-Optimierung

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Datum**: 2026-11-17

## R1 – Anbindung an Claude

- **Decision**: Offizielles SDK `@anthropic-ai/sdk` (1.9.x), ausschließlich im Main-Prozess. Modell
  `claude-opus-5-5`, `output_config.effort: "medium"`, Antworten über Structured Outputs
  (`client.messages.parse` + `zodOutputFormat` aus `@anthropic-ai/sdk/helpers/zod`). Der Client wird per
  Factory injiziert (`createCvOptimizer({ createClient })`), damit Tests ohne Netzwerk laufen.
- **Rationale**: Das SDK liefert typisierte Fehlerklassen (`AuthenticationError`, `RateLimitError`,
  `APIConnectionError` …), Retries, Timeouts und `AbortSignal`. Structured Outputs garantieren
  schema-valides JSON. Damit entfällt das fehleranfällige Parsen von Freitext (Edge Case „unlesbare
  Antwort“). Die Abhängigkeiten sind reines JS (keine nativen Module).
- **Alternatives considered**: Rohes `fetch` (würde Fehlerklassen, Retries und Typen nachbauen, laut
  Projektregel „SDK vor rohem HTTP“ abgelehnt). Aufruf aus dem Renderer (Key müsste in den Renderer,
  verletzt FR-003 und Constitution V).
- **Refusals**: `stop_reason === "refusal"` wird geprüft und als Fehler `refused` gemeldet. Die
  serverseitigen `fallbacks` (Beta `server-side-fallback-2026-07-01`, `fallbacks: "default"`) werden
  aktiviert, sofern `messages.parse` sie im Beta-Namespace unterstützt. Das wird bei der Umsetzung
  gegen das installierte SDK verifiziert. Andernfalls bleibt es bei der Fehlermeldung.

## R2 – Ablauf: Generieren und Bewerten

- **Decision**: Zwei Phasen.
  1. **Generieren**: drei parallele Anfragen, je eine pro Stil (sachlich, wirkungsstark, ATS). Jede
     liefert `{ text, changes[] }`.
  2. **Bewerten**: eine Anfrage, die Original und alle drei Varianten **gemeinsam** nach einem festen
     Schema gegen die Stellenanzeige bewertet und `{ score, coveredKeywords, missingKeywords }` je Text
     liefert.
- **Rationale**: Die gemeinsame Bewertung in einem Aufruf erfüllt FR-015 (gleiche Kriterien, vergleichbare
  Scores). Die parallele Generierung hält die Wartezeit nahe an „ein Aufruf + Bewertung“ (SC-002 < 60 s).
  Weil jede Variante unabhängig ist, scheitert ein Stil nicht an einem anderen.
- **Alternatives considered**: Ein einziger Aufruf für alles (sehr lange Ausgabe, höchste Latenz,
  Selbstbewertung der eigenen Texte). Score lokal über Keyword-Abgleich (deterministisch, aber ohne
  Semantik, z. B. „Teamführung“ vs. „Personalverantwortung“). Der lokale Abgleich bleibt als
  Plausibilitätsprüfung im Domain-Code: Ein Keyword gilt nur dann als „abgedeckt“, wenn es im Text
  vorkommt. Andernfalls wird es zu „fehlend“ verschoben.
- **Abbruch**: Ein gemeinsamer `AbortController` pro Lauf. `cv:cancel` bricht alle laufenden Anfragen ab.

## R3 – Keine erfundenen Inhalte (FR-014)

- **Decision**: Das System-Prompt verbietet ausdrücklich neue Fakten (Arbeitgeber, Daten, Abschlüsse,
  Zahlen, Zertifikate) und verlangt, dass fehlende Anforderungen nicht eingebaut werden. Zusätzlich
  prüft die Domain-Funktion `findInventedNumbers(original, variant)` deterministisch, ob die Variante
  Zahlen bzw. Jahreszahlen enthält, die im Original fehlen. Treffer werden in der Spalte als Warnhinweis
  angezeigt.
- **Rationale**: Ein Prompt allein ist keine Garantie. Die Zahlenprüfung fängt den häufigsten und
  schädlichsten Fall (erfundene Kennzahlen bzw. Zeiträume) lokal und testbar ab.
- **Alternatives considered**: Eine zweite KI-Prüfung (mehr Kosten und Latenz für v1).

## R4 – Textextraktion ohne native Module

- **Decision**:
  - **PDF**: `unpdf` (2.2.x, keine Abhängigkeiten, bündelt einen serverlosen pdf.js-Build, Node ≥ 24 ist
    durch Electron 44 erfüllt), `extractText(..., { mergePages: true })`.
  - **DOCX**: vorhandenes `fflate` (Entpacken) + vorhandener XML-Leser `src/main/import/xml.ts`.
    Ausgelesen wird `word/document.xml`, Absätze `w:p` → Zeilenumbruch, `w:tab` → Tab, `w:br` → Umbruch.
  - **TXT**: UTF-8 (BOM entfernen). Ist der Text nicht als UTF-8 lesbar, wird `windows-1252` über
    `TextDecoder` genutzt.
- **Rationale**: Es gibt keine neuen nativen Abhängigkeiten. DOCX nutzt bereits erprobten Code
  (ODS/XLSX-Import), der Entity-sicher ist (keine externen Entities).
- **Alternatives considered**: `pdfjs-dist` direkt (größere Integration, Worker-Setup im Main),
  `pdf-parse` (veraltet, bündelt alte pdf.js-Versionen), `mammoth` für DOCX (zusätzliche Abhängigkeit,
  deren Formatierung nicht gebraucht wird).
- **Grenzen**: Dateien über 10 MB werden abgelehnt. Ein PDF ohne Textebene ergibt den Hinweis „Kein Text
  gefunden“. Verschlüsselte PDFs werden mit eigener Meldung abgelehnt.

## R5 – Speicherung des API-Keys

- **Decision**: Electrons `safeStorage` (Windows: DPAPI, Linux: libsecret/kwallet). Der verschlüsselte
  Key liegt in einer eigenen Datei `ai-key.bin`, die Metadaten (`keyHint` = letzte 4 Zeichen) in
  `ai-key.json`, beide unter `userData`, atomar geschrieben (Temp-Datei + Rename). Die Factory
  `createSecretStore(dir, crypto)` erhält `{ isEncryptionAvailable, encryptString, decryptString }`
  injiziert und ist so ohne Electron testbar.
- **Rationale**: `safeStorage` ist Teil von Electron (kein natives Zusatzmodul) und bindet den Key an das
  Benutzerkonto des Betriebssystems. Weil der Key getrennt von `bewerbery-data.json` liegt, kann er nicht
  über `saveData` oder den Zod-Validierungspfad in den Renderer gelangen.
- **Sonderfall Linux**: Meldet `safeStorage.getSelectedStorageBackend()` den Wert `basic_text`, gilt die
  Verschlüsselung als nicht verfügbar (FR-006), und der Key wird nicht gespeichert.
- **Alternatives considered**: `keytar` (natives Modul, verboten). Klartext in `settings` (verletzt FR-002).

## R6 – Fehlerübermittlung über IPC

- **Decision**: KI-Kanäle liefern eine diskriminierte Union `{ ok: true, … } | { ok: false, error: AiErrorCode }`
  statt Exceptions. Die deutschen Meldungen und Lösungshinweise liegen im Domain-Modul `aiErrors.ts`
  (`AI_ERROR_MESSAGES[code]`).
- **Rationale**: Electron serialisiert geworfene Fehler über `ipcRenderer.invoke` nur als String mit
  Präfix. Codes sind stabil testbar, und die Texte sind zentral auf Deutsch.
- **Mapping** (SDK → Code): `AuthenticationError`/`PermissionDeniedError` → `invalid-key`,
  `RateLimitError` → `rate-limit`, `APIConnectionError`/`APIConnectionTimeoutError` → `network`,
  `BadRequestError` mit Kontextüberschreitung → `too-long`, sonstige `APIError` ≥ 500 → `server`,
  `APIUserAbortError` → `canceled`, `parsed_output === null` → `bad-response`,
  `stop_reason === "refusal"` → `refused`.

## R7 – Längenprüfung (FR-018)

- **Decision**: Lokale Obergrenzen in Zeichen: CV ≤ 30 000, Stellenanzeige ≤ 15 000. Die Prüfung läuft im
  Domain-Code vor jedem Senden, mit Angabe der Überschreitung. Echte Token-Zählung findet nicht statt
  (das wäre ein zusätzlicher Netzwerkaufruf).
- **Rationale**: Ein dreiseitiger CV hat ca. 6 000–12 000 Zeichen. Die Grenzen lassen viel Luft und
  halten die Kosten pro Lauf vorhersehbar.

## R8 – Navigation zur eigenen Ansicht

- **Decision**: Kein Router. `App.tsx` erhält einen View-Zustand `'applications' | 'cv'`. Im Header gibt
  es eine zweiteilige Umschaltung „Bewerbungen | CV-Optimierung“ (`role="tablist"` bzw. Buttons mit
  `aria-current`).
- **Rationale**: Zwei Ansichten rechtfertigen keine Router-Abhängigkeit. Das Muster passt zur bestehenden
  zustandsbasierten Dialogsteuerung.

## R9 – Persistenz des letzten Ergebnisses

- **Decision**: Eigene Datei `cv-last-result.json` im `userData`, atomar geschrieben und beim Laden mit
  Zod validiert (bei ungültigen Daten wird sie ignoriert und gelöscht). Sie ist nicht Teil von `AppData`.
- **Rationale**: Das Ergebnis enthält vier vollständige CV-Texte. Würde es in `AppData` liegen, würde es
  bei jeder Store-Änderung mitgeschrieben und mitvalidiert.

## R10 – Tests ohne Netzwerk

- **Decision**: Unit-Tests injizieren einen Fake-Client (`{ messages: { parse: vi.fn() } }`) und echte
  SDK-Fehlerklassen. E2E-Tests setzen `BEWERBERY_AI_FAKE=1`. Dann verwendet `index.ts` einen
  deterministischen Fake-Optimizer (feste Varianten und Scores) und einen Fake-SecretStore. So läuft der
  gesamte UI-Fluss ohne echten Key.
- **Rationale**: Das erfüllt SC-007 und die Testregeln (Main-Services mit `mkdtemp`, Electron-APIs
  injiziert).
