# Implementation Plan: KI-gestützte Lebenslauf-Optimierung

**Branch**: `feat/7-cv-optimization` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-cv-optimization/spec.md`

## Summary

Nutzer hinterlegen einen Anthropic-API-Key (verschlüsselt mit `safeStorage`, nur im Main-Prozess) und
optimieren in einer eigenen Ansicht ihren Lebenslauf auf eine Stelle, **wobei das Design erhalten bleibt**.
Der Main-Prozess liest die DOCX- bzw. ODT-Datei mit dem vorhandenen `fflate` und zerlegt sie mit einem
positionsgenauen XML-Tokenizer in Absätze und Formatierungs-Segmente. Drei parallele Claude-Anfragen
(Structured Outputs) liefern pro Stil neue Segmenttexte. Eine vierte Anfrage bewertet Original und
Varianten gemeinsam. Beim Speichern ersetzt die App nur die Textknoten in der Originaldatei, alles andere
bleibt byte-identisch. PDF wird mit Anleitung abgelehnt. Der Renderer zeigt die vier Spalten mit Score, Δ,
Keywords und Änderungen. Varianten werden als DOCX bzw. ODT gespeichert („Speichern unter …“ oder an der
Bewerbung). Die Constitution wird auf v1.1.0 angehoben (Opt-in-Netzwerkausnahme).

## Technical Context

**Language/Version**: TypeScript 6 (strict), Node ≥ 24 (Electron 44)

**Primary Dependencies**: vorhanden: Electron, React 19, Zustand, Zod 4, fflate, lucide-react, Motion.
**Neu**: nur `@anthropic-ai/sdk` ^1.9.0 (Main, reines JS). DOCX/ODT laufen über das vorhandene `fflate`.

**Storage**: lokale Dateien unter `userData`: `bewerbery-data.json` (+`jobDescription`, +`aiConsentAt`),
neu `ai-key.bin` / `ai-key.json`, `cv/source.<docx|odt>`, `cv/last-result.json`. Alle Dateien werden
atomar geschrieben.

**Testing**: Vitest + Testing Library (Unit/Komponenten, Fake-Anthropic-Client), Playwright `_electron`
mit `BEWERBERY_AI_FAKE=1`

**Target Platform**: Windows 10/11 (NSIS + portable), Linux (AppImage/tar.gz)

**Project Type**: Desktop-App (Electron, Main/Preload/Renderer)

**Performance Goals**: Ergebnis in 90 % der Fälle < 60 s (3 parallele Generierungen + 1 Bewertung).
Einlesen und Zurückschreiben einer DOCX/ODT < 1 s.

**Constraints**: kein Netzwerk ohne Key und ohne Nutzeraktion. Der Key verlässt den Main-Prozess nie.
Keine nativen Module. Die UI ist deutsch, ab 360 px und barrierearm. Coverage ≥ 90 %.

**Scale/Scope**: 1 Nutzer, 1 Lauf gleichzeitig. CV ≤ 30 000 Zeichen, Stellenanzeige ≤ 15 000 Zeichen,
Datei ≤ 10 MB, ≤ 600 Absätze. Es gibt ca. 6 neue UI-Komponenten, 4 Main-Services und 12 IPC-Kanäle.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Prinzip | Status | Begründung |
|---|---|---|
| I. Local-First & Privacy | ⚠️ **Änderung nötig** → mit v1.1.0 ✅ | Netzwerkzugriff zur Anthropic-API widerspricht v1.0.0. Lösung: Amendment v1.1.0 (MINOR, neue Ausnahme). Opt-in nur mit Key, nur auf ausdrückliche Aktion, Datenschutzhinweis vor dem ersten Senden. Alle Daten bleiben lokal gespeichert, es gibt kein Tracking. Siehe Complexity Tracking |
| II. Pure Domain Logic | ✅ | Prompts, Längenprüfung, Keyword-Normalisierung, Zahlen-Plausibilität, Δ/Best-Variante, Fehlertexte sowie das Zerlegen und Zurückschreiben des DOCX/ODT-XML liegen als reine Funktionen in `src/shared/domain/cv/` |
| III. Test-First & Coverage | ✅ | Jede neue Datei hat einen gespiegelten Test. Der SDK-Client wird injiziert, E2E nutzt den Fake-Modus |
| IV. Modular Feature Structure | ✅ | `main/ai/`, `main/cv/`, `shared/domain/cv/`, `renderer/src/features/cv-optimization/`, `features/settings/AiKeySection.tsx` |
| V. Secure Electron Defaults | ✅ | Key und SDK nur im Main. Jede IPC-Nutzlast wird mit Zod validiert, keine Lockerung von `sandbox`/`contextIsolation` |
| VI. Professional, but Playful | ✅ | Deutsch, ARIA (Ladezustand `aria-live`, Score als Zahl), responsiv. Bewusst kein XP für Optimierungsläufe, damit kostenpflichtige Aufrufe nicht belohnt werden |
| Tech-Constraint: keine nativen Module | ✅ | `safeStorage` ist Electron-intern, das SDK ist reines JS, DOCX/ODT laufen über `fflate` |

**Post-Design Re-Check** (nach Phase 1): weiterhin ✅. Der Vertrag (`contracts/ipc.md`) schließt die
Rückgabe des Keys aus und begrenzt das Netzwerk auf zwei Kanäle. Das Datenmodell hält den Key außerhalb
von `AppData`.

## Project Structure

### Documentation (this feature)

```text
specs/002-cv-optimization/
├── plan.md              # dieser Plan
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/ipc.md     # Phase 1
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
.specify/memory/constitution.md          # v1.1.0: Opt-in-Ausnahme Prinzip I
CLAUDE.md, .claude/rules/architecture.md # Ausnahme gespiegelt

src/shared/
├── constants.ts                         # + MAX_CV_CHARS, MAX_JOB_DESCRIPTION_CHARS, MAX_CV_FILE_BYTES
├── schemas.ts                           # + jobDescription, aiConsentAt
├── ipc.ts                               # + 11 Kanäle, AiResult, BewerberyApi-Methoden
└── domain/cv/
    ├── schemas.ts                       # Request, Assessment, Variant, Result, KI-Ausgabeformate
    ├── styles.ts                        # VARIANT_STYLES, Labels, Stil-Anweisungen
    ├── prompts.ts                       # buildGenerationPrompt, buildAssessmentPrompt (rein)
    ├── limits.ts                        # checkLengths → Überschreitung je Feld
    ├── assessment.ts                    # normalizeAssessment, scoreDelta, bestVariant, formatDelta
    ├── plausibility.ts                  # findInventedNumbers
    ├── aiErrors.ts                      # AiErrorCode, AI_ERROR_MESSAGES (de)
    ├── rewrite.ts                       # mergeRewrite, applyRewrites, variantText
    └── document/
        ├── xmlTokens.ts                 # positionsgenauer Tokenizer (Offsets)
        ├── docx.ts                      # parseDocxParagraphs (Segmente, Tracked Changes)
        ├── odt.ts                       # parseOdtParagraphs (Spans, text:s)
        └── rewriteXml.ts                # Textknoten ersetzen, Escaping

src/main/
├── ai/
│   ├── secretStore.ts                   # createSecretStore(dir, crypto)
│   ├── claudeClient.ts                  # createCvOptimizer({ createClient }), testKey, Fehler-Mapping
│   └── fakeOptimizer.ts                 # deterministischer Fake für BEWERBERY_AI_FAKE
├── cv/
│   ├── cvDocument.ts                    # ZIP lesen/schreiben (fflate), Format-Erkennung, PDF-Ablehnung
│   ├── cvService.ts                     # Quelle, Orchestrierung, Abbruch, busy-Sperre, Speichern
│   └── lastResultStore.ts               # cv/source.<ext> + cv/last-result.json
├── documents/documentService.ts         # + importBuffer
├── ipc/registerIpc.ts                   # + Handler
└── index.ts                             # Glue: safeStorage, Dialoge, Fake-Modus

src/preload/index.ts                     # + Weiterleitungen

src/renderer/src/
├── App.tsx                              # View-Umschaltung Bewerbungen | CV-Optimierung
├── stores/appStore.ts                   # + attachDocument, setAiConsent
├── test/mockApi.ts                      # + Mocks
└── features/
    ├── settings/AiKeySection.tsx        # Key speichern/prüfen/entfernen, Zustimmung widerrufen
    ├── applications/ApplicationForm.tsx # + Feld „Stellenanzeige“
    └── cv-optimization/
        ├── CvOptimizationView.tsx       # Seite: Eingabe ↔ Ergebnis
        ├── useCvOptimization.ts         # Zustandsautomat (data-model.md)
        ├── CvInputPanel.tsx             # Datei/Drop, Textvorschau, Bewerbung/Stellenanzeige
        ├── ConsentDialog.tsx            # Datenschutzhinweis
        ├── ComparisonView.tsx           # Spalten (≥ md) bzw. Tabs (< md)
        ├── VariantColumn.tsx            # Score, Δ, Keywords, Änderungen, Aktionen
        └── ScoreBadge.tsx               # Zahl + Ring, farbunabhängig lesbar

tests/unit/…                             # gespiegelt zu jeder neuen Datei
tests/e2e/cv-optimization.spec.ts        # Fluss im Fake-Modus
tests/fixtures/cv/                       # styled.docx (Seitenleiste, Tabelle, Bild, gemischte Läufe),
                                         # tracked.docx, styled.odt, sample.pdf (Ablehnung)
```

**Structure Decision**: Die bestehende Electron-Dreiteilung bleibt. Die KI-Anbindung liegt in `main/ai/`
und ist anbieterbezogen, aber nicht CV-spezifisch (`testKey`, Client-Erzeugung, Fehler-Mapping), damit
Issue #8 (Anschreiben) sie wiederverwenden kann. Die CV-spezifische Orchestrierung liegt in `main/cv/`.

## Umsetzungsreihenfolge (für /speckit-tasks)

1. **Governance**: Constitution v1.1.0, CLAUDE.md und Architekturregel anpassen (FR-009).
2. **Foundation**: Abhängigkeiten installieren (je ein Commit pro Paket), Schemas und Konstanten,
   `jobDescription` + Formularfeld, `aiConsentAt`.
3. **US1 – Key**: `secretStore` → `claudeClient.testKey` → IPC/Preload/Mock → `AiKeySection`.
4. **US2 – Optimieren**: Dokument-Domain (`xmlTokens`, `docx`, `odt`, `rewriteXml`) als frühester
   Baustein, weil er das größte Risiko trägt → `rewrite`, `prompts`, `limits`, `assessment`,
   `plausibility`, `aiErrors` → `cvDocument` → `claudeClient.optimize` → `cvService` → IPC →
   `CvInputPanel`, `ConsentDialog`, `useCvOptimization`, View + Navigation.
5. **US3 – Vergleich**: `ScoreBadge`, `VariantColumn`, `ComparisonView`, Speichern unter, An Bewerbung
   speichern (`importBuffer` + Store), Text kopieren, Längenhinweis.
6. **US4 – Letztes Ergebnis**: `lastResultStore`, Laden beim Öffnen, Verwerfen.
7. **E2E + Doku**: Fake-Modus, E2E-Fluss, README (DE/EN) gemäß Dokumentationspflicht.

## Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Latenz > 60 s bei langen CVs | Parallele Generierung, `effort: "medium"`. Ladeanzeige mit Phasen („Varianten werden erstellt …“, „Bewertung …“) |
| Word meldet „Datei beschädigt“ nach dem Zurückschreiben | Nur Textknoten splicen, nie neu serialisieren. Tests prüfen byte-identische übrige ZIP-Einträge und wohlgeformtes XML. Manuelle Prüfung in Word und LibreOffice (Quickstart 12) |
| Exotische Strukturen (Felder, Hyperlinks, Inhaltssteuerelemente, Smart Tags) | Segmente nur aus `w:t` in `w:r`, Feldcodes ignorieren. Bei unpassender KI-Antwort bleibt der Absatz unverändert |
| Längere Texte verschieben das Layout | Prompt verlangt ±15 % je Absatz, Längenhinweis ab +15 % (FR-023a) |
| Unsichere Linux-Keyrings (`basic_text`) | Als „nicht verfügbar“ behandeln (FR-006) |
| KI erfindet Inhalte | Prompt-Regeln + lokale Zahlenprüfung mit sichtbarem Warnhinweis |
| Kosten für Nutzer | Lauf nur auf Klick, Längenlimits, keine automatischen Wiederholungen außer den SDK-Retries (max. 2) |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Netzwerkzugriff (Prinzip I, v1.0.0) | Die KI-Optimierung ist ohne Anbieter-API nicht möglich. Das ist eine ausdrückliche Nutzerentscheidung (Session 2026-11-17) | Ein lokales LLM (Ollama) würde Installation und Leistung beim Nutzer voraussetzen und wurde vom Nutzer abgewählt. Gelöst durch das Amendment v1.1.0 statt einer stillen Abweichung |
| Neue Laufzeit-Abhängigkeit | SDK (Fehlerklassen, Structured Outputs, Abbruch) | Eigenes HTTP wäre fehleranfälliger und schwerer zu testen |
| Eigener positionsgenauer XML-Tokenizer statt DOM | Design-Erhalt erfordert byte-genaues Zurückschreiben | Ein DOM-Parser + Serializer verändert Namespaces, Whitespace und Attributreihenfolge und riskiert Reparaturdialoge in Word |
