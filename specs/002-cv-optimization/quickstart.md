# Quickstart: CV-Optimierung prüfen

**Feature**: [spec.md](./spec.md) | **Vertrag**: [contracts/ipc.md](./contracts/ipc.md)

## Voraussetzungen

- Abhängigkeiten installiert (`npm install`). Setup und Start stehen in der [README](../../README.md).
- Für die manuelle Prüfung mit echter KI: ein eigener Anthropic-API-Key.
- In VS Code vor `npm run dev`: `Remove-Item Env:ELECTRON_RUN_AS_NODE`.

## 1. Automatisierte Prüfung (ohne Netzwerk)

```powershell
npm run typecheck; npm run lint; npm test        # Coverage ≥ 90 %, keine echten Anfragen
npm run test:e2e                                 # nutzt BEWERBERY_AI_FAKE=1 (Fake-Optimizer)
```

Erwartet: Alle Tests sind grün. Die E2E-Suite enthält einen Fluss „Key speichern → CV wählen → Optimieren →
vier Spalten sichtbar → Variante an Bewerbung speichern“. Unit-Tests prüfen auf DOCX/ODT-Fixtures, dass
eine geschriebene Variante außer dem Text byte-identische ZIP-Einträge und unveränderte Formatierungs-XML
hat.

## 2. Manuelle Szenarien (`npm run dev`)

| # | Schritt | Erwartung | Spec |
|---|---|---|---|
| 1 | Ansicht „CV-Optimierung“ ohne Key öffnen | „Optimieren“ deaktiviert, Link „Zu den Einstellungen“ öffnet den Dialog | US2-1 |
| 2 | Einstellungen → KI-Assistent: Key eingeben, „Speichern“ | „Key hinterlegt (…abcd)“, Feld leer | US1-1 |
| 3 | „Verbindung prüfen“ | „Key gültig“. Mit absichtlich falschem Key: „Der API-Key ist ungültig …“ | US1-2 |
| 4 | `%APPDATA%/Bewerbery/` durchsuchen (`Select-String -Path * -Pattern "<Key-Anfang>"`) | Kein Treffer | SC-004 |
| 5 | Gestaltete DOCX-CV (Seitenleiste, Tabelle, Foto, fette Labels) und eine ODT-CV wählen | Text erscheint in der Vorschau | US2-2 |
| 6 | Eine PDF wählen | Abgelehnt, mit Anleitung „Word-Datei wählen oder PDF in Word als .docx speichern“ | US2-2a |
| 7 | Bewerbung mit ausgefülltem Feld „Stellenanzeige“ wählen | Text wird übernommen | US2-3 |
| 8 | Erstes „Optimieren“ | Datenschutzhinweis. Erst nach „Zustimmen und senden“ läuft die Anfrage | US2-4 |
| 9 | Während des Laufs „Abbrechen“ | Zurück zur Eingabe, kein Ergebnis | US2-5 |
| 10 | Lauf abschließen | 4 Spalten mit Score, Δ, Keywords und Änderungen. Beste Variante markiert | US3-1/2 |
| 11 | Fenster auf 400 px verkleinern | Tabs statt Spalten, kein horizontales Scrollen | US3-3 |
| 12 | „Speichern unter …“ und „An Bewerbung speichern“, dann Datei in Word bzw. LibreOffice öffnen | Öffnet ohne Reparaturdialog. Design ist identisch zum Original, nur die Formulierungen sind anders. Dokument erscheint an der Bewerbung | US3-4/5, SC-008 |
| 12a | Original und Variante in Word vergleichen („Überprüfen → Vergleichen“) | Nur Textänderungen, keine Formatänderungen | SC-008 |
| 13 | App neu starten, Ansicht öffnen | Letztes Ergebnis mit Datum sichtbar. „Verwerfen“ löscht es | US4 |
| 14 | WLAN aus, „Optimieren“ | „Keine Verbindung …“, Eingaben bleiben erhalten | FR-017 |
| 15 | Key in den Einstellungen entfernen | Optimierung wieder deaktiviert | US1-3 |

## 3. Netzwerk-Invariante prüfen

Mit einem Netzwerk-Monitor (z. B. Ressourcenmonitor → Netzwerk, Prozess `Bewerbery.exe`) prüfen: Ohne Key
und ohne Klick auf „Optimieren“ bzw. „Verbindung prüfen“ gibt es keine ausgehenden Verbindungen (SC-005).
