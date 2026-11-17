# Feature Specification: KI-gestützte Lebenslauf-Optimierung

**Feature Branch**: `feat/7-cv-optimization`

**Created**: 2026-11-17

**Status**: Draft

**Input**: GitHub-Issue #7 „feat: Create CV optimizing as AI Feature“. Der Nutzer hinterlegt in den
Einstellungen einen API-Key für Anthropic Claude. In einer eigenen Oberfläche „CV-Optimierung“ lässt
er seinen Lebenslauf auf eine Stelle hin optimieren. Die Varianten erscheinen nebeneinander mit dem
Original, damit sichtbar wird, wie gut die Optimierung gewirkt hat.

## Clarifications

### Session 2026-11-17

- Q: Wie verträgt sich die KI-Funktion mit dem Local-First-Prinzip der Constitution? → A: Opt-in-Ausnahme
  (Constitution v1.1.0). Netzwerkzugriff gibt es ausschließlich zum KI-Anbieter, nur mit gesetztem
  API-Key und nur, wenn der Nutzer die Optimierung ausdrücklich startet. Alles andere bleibt lokal.
- Q: Welche KI-Anbieter? → A: Nur Anthropic Claude.
- Q: Eingabe? → A: CV-Datei (PDF, DOCX, TXT) plus Stellenanzeige (aus einer Bewerbung oder eingefügt).
- Q: Vergleichsansicht? → A: Original + 3 Varianten nebeneinander, jeweils mit Match-Score 0–100,
  abgedeckten und fehlenden Keywords und den wichtigsten Änderungen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 – API-Key in den Einstellungen verwalten (Priority: P1)

Als Nutzer hinterlege ich meinen Anthropic-API-Key im Einstellungsdialog. Ich kann ihn prüfen,
ersetzen und löschen. Der Key wird verschlüsselt auf meinem Rechner gespeichert und nie wieder im
Klartext angezeigt.

**Why this priority**: Ohne Key ist keine KI-Funktion möglich. Diese Story ist die Voraussetzung für
alle weiteren.

**Independent Test**: Key eingeben, „Prüfen“ klicken → Erfolgsmeldung. App neu starten → Einstellungen
zeigen „Key hinterlegt (…abcd)“. Die Datendatei enthält den Key nicht im Klartext.

**Acceptance Scenarios**:

1. **Given** kein Key hinterlegt, **When** ich einen Key eingebe und speichere, **Then** zeigen die
   Einstellungen „Key hinterlegt“ mit den letzten 4 Zeichen, und das Eingabefeld ist leer.
2. **Given** ein eingegebener Key, **When** ich „Verbindung prüfen“ klicke, **Then** sehe ich
   „Key gültig“ oder eine verständliche deutsche Fehlermeldung (ungültig, keine Verbindung).
3. **Given** ein hinterlegter Key, **When** ich „Key entfernen“ bestätige, **Then** ist der Key
   gelöscht und die CV-Optimierung deaktiviert.
4. **Given** ein hinterlegter Key, **When** ich einen neuen Key speichere, **Then** ersetzt er den alten.
5. **Given** das Betriebssystem bietet keine sichere Verschlüsselung, **When** ich speichern will,
   **Then** wird der Key nicht gespeichert und ich erhalte einen Hinweis.

---

### User Story 2 – Lebenslauf auf eine Stelle optimieren (Priority: P1)

Als Bewerber öffne ich die Ansicht „CV-Optimierung“, wähle meine CV-Datei und eine Stellenanzeige (aus
einer bestehenden Bewerbung oder als eingefügten Text) und starte die Optimierung. Ich erhalte drei
Varianten: sachlich, wirkungsstark und ATS-optimiert.

**Why this priority**: Das ist der Kernnutzen des Tickets.

**Independent Test**: Mit hinterlegtem Key eine TXT-CV und eine eingefügte Stellenanzeige wählen,
„Optimieren“ klicken → nach kurzer Wartezeit erscheinen drei Varianten.

**Acceptance Scenarios**:

1. **Given** kein Key hinterlegt, **When** ich die Ansicht öffne, **Then** ist „Optimieren“ deaktiviert
   und ein Hinweis führt direkt zu den Einstellungen.
2. **Given** eine PDF-, DOCX- oder TXT-Datei, **When** ich sie auswähle, **Then** wird ihr Text lokal
   ausgelesen und als Vorschau angezeigt, in der ich ihn korrigieren kann.
3. **Given** eine bestehende Bewerbung mit ausgefülltem Feld „Stellenanzeige“, **When** ich sie wähle,
   **Then** wird deren Text übernommen. Ist das Feld leer, füge ich den Text ein und kann ihn mit
   „In Bewerbung speichern“ dort ablegen.
4. **Given** ich starte zum ersten Mal eine Optimierung, **When** ich „Optimieren“ klicke, **Then**
   erscheint ein Hinweis, dass CV-Text und Stellenanzeige an Anthropic übertragen werden. Erst nach
   meiner Zustimmung wird gesendet. Die Zustimmung wird gemerkt und ist in den Einstellungen widerrufbar.
5. **Given** eine laufende Optimierung, **When** ich „Abbrechen“ klicke, **Then** wird die Anfrage
   beendet und kein Ergebnis angezeigt.
6. **Given** ein Fehler (ungültiger Key, keine Verbindung, Rate-Limit, Text zu lang, Serverfehler),
   **Then** sehe ich eine verständliche deutsche Meldung mit einem Lösungshinweis. Meine Eingaben
   bleiben erhalten.

---

### User Story 3 – Varianten nebeneinander vergleichen (Priority: P1)

Als Bewerber sehe ich Original und drei Varianten nebeneinander. Jede Spalte zeigt einen Match-Score
(0–100) gegenüber der Stelle, abgedeckte und fehlende Keywords sowie die wichtigsten Änderungen. So
erkenne ich auf einen Blick, wie stark sich jede Variante verbessert hat.

**Why this priority**: Diese Ansicht macht den Nutzen der Optimierung sichtbar und ist ausdrücklich
gewünscht.

**Independent Test**: Mit einem festen Beispielergebnis die Vergleichsansicht öffnen → vier Spalten
mit Score, Keywords und Änderungen. Die Score-Differenz zum Original ist bei jeder Variante sichtbar.

**Acceptance Scenarios**:

1. **Given** ein Ergebnis, **Then** zeigt die Ansicht die Spalten Original | Sachlich | Wirkungsstark |
   ATS-optimiert, jeweils mit Score, Differenz zum Original (z. B. „+18“), Keyword-Listen und
   Änderungsliste.
2. **Given** ein Ergebnis, **Then** ist die Variante mit dem höchsten Score als „Beste Übereinstimmung“
   markiert.
3. **Given** ein schmales Fenster (< 768 px), **Then** werden die Spalten als Tabs bzw. untereinander
   dargestellt, ohne horizontales Scrollen.
4. **Given** eine Variante, **When** ich „Kopieren“ klicke, **Then** liegt ihr Text in der
   Zwischenablage und ich erhalte eine Bestätigung.
5. **Given** eine Variante und eine gewählte Bewerbung, **When** ich „Als Dokument speichern“ klicke,
   **Then** wird die Variante als Dokument an dieser Bewerbung abgelegt und erscheint in deren
   Dokumentliste.

---

### User Story 4 – Letzte Optimierung wiederfinden (Priority: P3)

Als Nutzer finde ich das Ergebnis meiner letzten Optimierung nach einem Neustart wieder, ohne erneut
Kosten zu verursachen.

**Why this priority**: Komfort. Ohne diese Story ist das Feature trotzdem nutzbar.

**Independent Test**: Optimierung durchführen, App neu starten, Ansicht öffnen → letztes Ergebnis ist
sichtbar.

**Acceptance Scenarios**:

1. **Given** eine abgeschlossene Optimierung, **When** ich die App neu starte und die Ansicht öffne,
   **Then** sehe ich das letzte Ergebnis mit Datum und Stellenbezug.
2. **Given** ein gespeichertes Ergebnis, **When** ich „Verwerfen“ klicke, **Then** wird es gelöscht.

---

### Edge Cases

- Die CV-Datei enthält keinen auslesbaren Text (z. B. eingescanntes PDF) → Hinweis „Kein Text gefunden“
  und Möglichkeit, Text manuell einzufügen.
- Die CV-Datei ist beschädigt, passwortgeschützt oder hat einen nicht unterstützten Typ → deutsche
  Fehlermeldung, keine Abstürze.
- CV und Stellenanzeige überschreiten zusammen die zulässige Länge → Meldung vor dem Senden, mit
  Angabe, wie viel gekürzt werden muss.
- Die Stellenanzeige ist leer → die Optimierung ist nicht startbar, mit Hinweis.
- Die KI-Antwort ist unvollständig oder unlesbar → Meldung „Antwort konnte nicht verarbeitet werden“
  und Option „Erneut versuchen“. Es werden keine Teilergebnisse als vollständig angezeigt.
- Der Key wird während einer laufenden Optimierung gelöscht → die laufende Anfrage wird abgebrochen.
- Die gewählte Bewerbung wurde zwischenzeitlich gelöscht → Speichern als Dokument ist nicht möglich,
  Kopieren bleibt möglich.
- Doppelklick auf „Optimieren“ → es läuft immer höchstens eine Anfrage.

## Requirements *(mandatory)*

### Functional Requirements

**Einstellungen & API-Key**

- **FR-001**: Der Einstellungsdialog MUSS einen Abschnitt „KI-Assistent“ enthalten, in dem ein
  Anthropic-API-Key eingegeben, gespeichert, geprüft und entfernt werden kann.
- **FR-002**: Der Key MUSS mit der Verschlüsselung des Betriebssystems verschlüsselt lokal gespeichert
  werden und DARF NICHT im Klartext in der Datendatei, in Logs oder in Fehlermeldungen erscheinen.
- **FR-003**: Der Key DARF nach dem Speichern NICHT an die Oberfläche zurückgegeben werden. Die
  Oberfläche erhält nur „hinterlegt / nicht hinterlegt“ und die letzten 4 Zeichen.
- **FR-004**: Das Key-Eingabefeld MUSS als Passwortfeld (verdeckt) dargestellt werden.
- **FR-005**: „Verbindung prüfen“ MUSS eine minimale Testanfrage senden und das Ergebnis als
  „gültig“, „ungültiger Key“ oder „keine Verbindung“ anzeigen.
- **FR-006**: Ist keine sichere Verschlüsselung verfügbar, DARF der Key NICHT gespeichert werden.

**Datenschutz & Netzwerk**

- **FR-007**: Netzwerkanfragen DÜRFEN ausschließlich an die Anthropic-API gehen, und nur bei einer
  ausdrücklichen Nutzeraktion („Optimieren“, „Verbindung prüfen“).
- **FR-008**: Vor der ersten Optimierung MUSS ein Datenschutzhinweis bestätigt werden. Die Zustimmung
  MUSS gespeichert und in den Einstellungen widerrufbar sein.
- **FR-009**: Die Constitution MUSS auf v1.1.0 angehoben werden. Darin wird die Opt-in-Ausnahme
  dokumentiert und in `CLAUDE.md` bzw. den Architekturregeln gespiegelt.

**CV-Optimierung**

- **FR-010**: Die App MUSS eine eigene Ansicht „CV-Optimierung“ bieten, die über die Hauptnavigation
  erreichbar ist.
- **FR-011**: Der Nutzer MUSS eine CV-Datei vom Typ PDF, DOCX oder TXT wählen können. Ihr Text MUSS
  lokal ausgelesen und als bearbeitbare Vorschau angezeigt werden.
- **FR-012**: Der Nutzer MUSS die Stellenanzeige aus einer bestehenden Bewerbung übernehmen oder als
  Text einfügen können.
- **FR-012a**: Bewerbungen MÜSSEN ein neues optionales Textfeld „Stellenanzeige“ erhalten, das im
  Bewerbungsformular bearbeitbar ist. Bestehende Daten bleiben ohne Migration gültig (Feld leer).
- **FR-013**: Das System MUSS genau drei Varianten erzeugen: „Sachlich“, „Wirkungsstark“ und
  „ATS-optimiert“.
- **FR-014**: Die Varianten DÜRFEN KEINE Qualifikationen, Stationen, Abschlüsse oder Zahlen erfinden,
  die nicht im Original stehen. Fehlende Anforderungen werden nur als „fehlende Keywords“ ausgewiesen.
- **FR-015**: Original und alle Varianten MÜSSEN nach denselben Kriterien gegen die Stellenanzeige
  bewertet werden (Score 0–100), damit die Werte vergleichbar sind.
- **FR-016**: Eine laufende Optimierung MUSS einen Fortschrittszustand anzeigen und abbrechbar sein.
  Gleichzeitig darf höchstens eine Optimierung laufen.
- **FR-017**: Fehler (ungültiger Key, keine Verbindung, Rate-Limit, Text zu lang, unlesbare Antwort,
  Serverfehler) MÜSSEN als deutsche Meldungen mit Lösungshinweis angezeigt werden. Eingaben bleiben
  erhalten.
- **FR-018**: Die Länge von CV und Stellenanzeige MUSS vor dem Senden geprüft werden.

**Vergleich & Übernahme**

- **FR-019**: Die Vergleichsansicht MUSS Original und die drei Varianten nebeneinander zeigen, jeweils
  mit Score, Differenz zum Original, abgedeckten Keywords, fehlenden Keywords und den wichtigsten
  Änderungen (höchstens 5 je Variante).
- **FR-020**: Die Variante mit dem höchsten Score MUSS hervorgehoben werden.
- **FR-021**: Unter 768 px Fensterbreite MÜSSEN die Spalten als Tabs oder gestapelt dargestellt
  werden. Ab 360 px gibt es kein horizontales Scrollen.
- **FR-022**: Jede Variante MUSS in die Zwischenablage kopiert werden können.
- **FR-023**: Ist eine Bewerbung gewählt, MUSS jede Variante als Dokument an diese Bewerbung gespeichert
  werden können.
- **FR-024**: Das letzte Ergebnis MUSS lokal gespeichert werden und nach einem Neustart abrufbar und
  löschbar sein.

**Barrierefreiheit**

- **FR-025**: Alle Bedienelemente MÜSSEN per Tastatur erreichbar und beschriftet sein. Scores werden
  nicht nur farblich, sondern auch als Zahl dargestellt. Der Ladezustand wird Screenreadern angesagt.

### Key Entities

- **KI-Einstellungen**: Ob ein Key hinterlegt ist, die letzten 4 Zeichen und die Datenschutz-Zustimmung
  (ja/nein, Datum). Der verschlüsselte Key selbst liegt getrennt von den übrigen App-Daten.
- **Bewerbung (erweitert)**: erhält das optionale Feld „Stellenanzeige“ (Freitext).
- **Optimierungsauftrag**: CV-Text, Stellenanzeige-Text, optional die zugehörige Bewerbung.
- **Bewertung**: Score 0–100, abgedeckte Keywords, fehlende Keywords.
- **Variante**: Stil (sachlich / wirkungsstark / ATS-optimiert), Text, Bewertung, Liste der wichtigsten
  Änderungen.
- **Optimierungsergebnis**: Zeitpunkt, Bezug zur Bewerbung bzw. Stellentitel, Bewertung des Originals,
  drei Varianten.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ein Nutzer kann einen API-Key in unter 1 Minute hinterlegen und prüfen.
- **SC-002**: Von der Dateiauswahl bis zur Vergleichsansicht vergehen bei einem üblichen CV (bis 3
  Seiten) höchstens 3 Nutzeraktionen plus Wartezeit. Die Wartezeit liegt in 90 % der Fälle unter
  60 Sekunden.
- **SC-003**: In der Vergleichsansicht ist ohne Scrollen innerhalb einer Spalte erkennbar, welche
  Variante am besten passt und um wie viele Punkte sie das Original übertrifft.
- **SC-004**: Der API-Key ist in keiner von der App geschriebenen Klartextdatei auffindbar.
- **SC-005**: Ohne hinterlegten Key bzw. ohne ausdrückliche Nutzeraktion sendet die App keine einzige
  Netzwerkanfrage.
- **SC-006**: Alle genannten Fehlerfälle führen zu einer deutschen Meldung, nie zu einem Absturz oder
  einer leeren Ansicht.
- **SC-007**: Die Testabdeckung bleibt bei ≥ 90 %, ohne dass für automatisierte Tests echte Anfragen
  gesendet werden.

## Assumptions

- Der Nutzer besitzt ein eigenes Anthropic-Konto und trägt die Kosten der Anfragen selbst. Die App zeigt
  keine Kosten an.
- Varianten werden als reiner Text bzw. mit einfacher Gliederung erzeugt. Das Layout der Original-Datei
  (Spalten, Fotos, Design) wird nicht nachgebaut. „Als Dokument speichern“ legt eine Textdatei ab.
  Ein gestalteter DOCX- oder PDF-Export ist nicht Teil dieses Tickets.
- Der Score wird von der KI nach einem festen, im Auftrag beschriebenen Bewertungsschema vergeben. Er
  ist ein Orientierungswert, keine Garantie für ATS-Systeme.
- CV und Stellenanzeigen sind überwiegend deutsch. Die Varianten werden in der Sprache des Original-CVs
  erzeugt.
- Es wird nur das letzte Ergebnis gespeichert, keine vollständige Historie.
- Eingescannte PDFs ohne Textebene werden nicht per Texterkennung verarbeitet.
- Issue #8 (Anschreiben-Optimierung) soll später denselben Key und dieselbe Anbindung nutzen. Die
  Anbindung wird deshalb nicht CV-spezifisch gebaut, ist aber nicht Teil dieses Tickets.
