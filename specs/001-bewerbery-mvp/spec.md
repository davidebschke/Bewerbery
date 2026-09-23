# Feature Specification: Bewerbery MVP

**Feature Branch**: `feature/bewerbery-mvp`

**Created**: 2026-09-23

**Status**: Approved

**Input**: Desktop-App zur Bewerbungsverwaltung. Bewerber verfolgen ihre Bewerbungen: Wie lange ist sie
her? Wohin wurde sie geschickt? Wen muss man anrufen, wenn nichts kommt? Oder gibt es schon einen Termin?

## Clarifications

### Session 2026-09-23

- Q: Nachfrist global oder pro Karte? → A: Global in den Einstellungen (Wochen), pro Karte überschreibbar.
- Q: Exe-Form? → A: NSIS-Installer **und** portable exe.
- Q: Sprache? → A: Nur Deutsch.
- Q: Erinnerungen? → A: Windows-Benachrichtigung, wenn eine Karte fällig wird (abschaltbar).
- Q: Remote-Repository? → A: Nur lokal.

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Bewerbung als Card anlegen (Priority: P1)

Als Bewerber lege ich eine Card an mit Unternehmen, Position, Ansprechpartner (Name, Telefon, E-Mail),
Absendedatum, Notizen und hinterlege eingereichte Dokumente.

**Why this priority**: Ohne erfasste Bewerbungen hat die App keinen Nutzen.

**Independent Test**: App starten, Bewerbung anlegen, App neu starten → Card ist noch da.

**Acceptance Scenarios**:

1. **Given** leere Liste, **When** ich „Neue Bewerbung“ ausfülle und speichere, **Then** erscheint die Card.
2. **Given** eine Card, **When** ich sie bearbeite, **Then** werden Änderungen dauerhaft gespeichert.
3. **Given** eine Card, **When** ich Dokumente per Dialog oder Drag & Drop hinzufüge, **Then** werden sie
   in den App-Datenordner kopiert und sind per Klick öffenbar.
4. **Given** eine Card, **When** ich sie lösche und bestätige, **Then** sind Card und Dokumente entfernt.
5. **Given** das Formular, **When** Unternehmen fehlt oder E-Mail ungültig ist, **Then** wird ein Fehler angezeigt.

---

### User Story 2 – Fortschrittsbalken „Sich melden“ (Priority: P1)

Jede Card im Status „Beworben“ zeigt einen Fortschrittsbalken von Absendedatum (bzw. letztem Nachfassen)
bis zur Nachfrist (Wochen). Stufen: frisch (< 60 %), bald (≥ 60 %), fällig (≥ 100 %).

**Independent Test**: Nachfrist auf 1 Woche setzen, Bewerbung mit Datum vor 8 Tagen → Status „Melden fällig“.

**Acceptance Scenarios**:

1. **Given** Nachfrist 2 Wochen und Absendedatum vor 7 Tagen, **Then** Balken 50 %, „noch 7 Tage“.
2. **Given** Nachfrist in Einstellungen geändert, **Then** alle Cards ohne eigene Frist rechnen neu.
3. **Given** Card mit eigener Frist, **Then** wird diese statt der globalen verwendet.
4. **Given** fällige Card, **When** ich „Nachgefragt“ klicke, **Then** startet der Zähler ab heute neu (+5 XP).
5. **Given** Card mit Status Termin/Angebot/Absage, **Then** kein Nachfrage-Balken.

---

### User Story 3 – Fällige Cards oben pinnen (Priority: P1)

Cards mit Status „Melden fällig“ erscheinen in einem eigenen gepinnten Bereich am Anfang der Liste,
am längsten überfällige zuerst. Die übrigen folgen nach Dringlichkeit.

**Acceptance Scenarios**:

1. **Given** eine fällige und zwei frische Cards, **Then** steht die fällige im Bereich „Jetzt melden“ oben.
2. **Given** zwei fällige Cards, **Then** steht die länger überfällige zuerst.

---

### User Story 4 – Status-Pipeline & Termine (Priority: P2)

Ich setze den Status auf Termin (mit Datum/Uhrzeit), Angebot oder Absage und sehe das auf der Card.

**Acceptance Scenarios**:

1. **Given** eine Card, **When** Status „Termin“ mit Datum gesetzt, **Then** zeigt die Card den Termin, Konfetti + 25 XP.
2. **Given** Status wurde bereits einmal erreicht, **When** erneut gesetzt, **Then** keine doppelten XP.

---

### User Story 5 – Gamification (Priority: P2)

XP (Anlegen +10, Nachfassen +5, Termin +25, Angebot +100, Absage +5), Level mit Titeln, Badges und
Wochen-Streak motivieren. Anzeige im Header, Badges in einer Übersicht.

**Acceptance Scenarios**:

1. **Given** 0 XP, **When** ich eine Bewerbung anlege, **Then** +10 XP Toast und XP-Balken steigt.
2. **Given** XP über Levelschwelle, **Then** Level-Up-Hinweis.

---

### User Story 6 – Einstellungen & Erinnerungen (Priority: P2)

Nachfrist (1–12 Wochen), Theme (System/Hell/Dunkel), Benachrichtigungen an/aus.

**Acceptance Scenarios**:

1. **Given** Benachrichtigungen an, **When** eine Card fällig wird, **Then** erscheint (einmal pro Sitzung) eine Windows-Benachrichtigung.

### Edge Cases

- Absendedatum in der Zukunft → Fortschritt 0 %, Status frisch.
- Beschädigte/ungültige Datendatei → Backup `*.corrupt-<zeit>.json`, Start mit leeren Daten.
- Dokument-Datei außerhalb gelöscht → Öffnen zeigt Fehlermeldung.
- Doppelte Dateinamen → eindeutige gespeicherte Namen (ID-Präfix).
- Sehr schmales Fenster (360 px) → einspaltiges Layout, Formular als Vollbild.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: CRUD für Bewerbungs-Cards mit Feldern: Unternehmen*, Position, Ansprechpartner-Name, -Telefon, -E-Mail, Absendedatum*, Notizen, Dokumente.
- **FR-002**: Dokumente werden in `userData/documents/<cardId>/` kopiert, geöffnet und entfernt.
- **FR-003**: Fortschritt = vergangene Tage / (Wochen × 7), Referenz = letztes Nachfassen oder Absendedatum.
- **FR-004**: Nachfrist global einstellbar (1–12 Wochen), optional pro Card überschreibbar.
- **FR-005**: Fällige Cards sind gepinnt am Anfang der Liste.
- **FR-006**: Status-Pipeline: Beworben → Termin → Angebot / Absage.
- **FR-007**: Suche (Unternehmen, Position, Ansprechpartner) und Filter nach Status.
- **FR-008**: XP, Level, Badges, Streak; XP für Statuswechsel nur einmal pro Card.
- **FR-009**: Alle Daten lokal als JSON (atomar geschrieben, Zod-validiert).
- **FR-010**: Windows-Benachrichtigung für neu fällige Cards (abschaltbar).
- **FR-011**: Responsives Layout 1–4 Spalten ab 360 px.
- **FR-012**: Build einer Windows-exe (NSIS-Installer + portable).

### Key Entities

- **Application**: id, company, position, contactName, contactPhone, contactEmail, sentAt, lastFollowUpAt,
  followUpWeeks (Override), stage, appointmentAt, notes, documents[], awardedStages[], createdAt, updatedAt.
- **ApplicationDocument**: id, name, storedName, size, addedAt.
- **Settings**: followUpWeeks, notificationsEnabled, theme.
- **Progress**: xp, applicationsCreated, followUps, interviews, offers, rejections, activeWeeks[].

## Success Criteria *(mandatory)*

- **SC-001**: Eine Bewerbung kann in < 1 Minute erfasst werden.
- **SC-002**: Fällige Cards sind ohne Scrollen sichtbar (gepinnt oben).
- **SC-003**: ≥ 90 % Testabdeckung, alle Unit-, Komponenten- und E2E-Tests grün.
- **SC-004**: `npm run dist` erzeugt Installer und portable exe.
