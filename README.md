# Bewerbery 🎯

Desktop-App zur Verwaltung deiner Bewerbungen – professionell, aber spielerisch.

- **Bewerbungs-Cards** mit Unternehmen, Position, Ansprechpartner (Name, Telefon, E-Mail),
  Absendedatum, eingereichten Dokumenten und Notizen
- **Fortschrittsbalken „Melden“**: zeigt, wann du nachfragen solltest. Die Frist in Wochen ist in den
  Einstellungen einstellbar und pro Bewerbung überschreibbar.
- **Gepinnter Bereich „Jetzt melden“**: fällige Bewerbungen stehen immer ganz oben
- **Status-Pipeline**: Beworben → Termin (mit Datum) → Angebot / Absage
- **Gamification**: XP, 7 Level, Abzeichen, Wochen-Serie, Konfetti bei Terminen und Angeboten
- **Erinnerungen** als Windows-Benachrichtigung (abschaltbar)
- **100 % lokal**: Daten unter `%APPDATA%/Bewerbery`, keine Cloud, kein Tracking
- Heller und dunkler Modus, responsiv ab 360 px Fensterbreite

## Tech-Stack

Electron 44 · electron-vite 5 · Vite 7 · React 19 · TypeScript 6 · Tailwind CSS 4 · Zustand 5 · Zod 4 ·
date-fns 4 · Motion · Vitest 5 + Testing Library · Playwright (Electron) · electron-builder 26

## Loslegen

```bash
npm install
npm run dev        # App mit Hot Reload starten
```

> In einem VS-Code-Terminal ist `ELECTRON_RUN_AS_NODE` gesetzt. Falls die App nicht startet:
> `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell) bzw. `unset ELECTRON_RUN_AS_NODE` (Bash).

## Qualität

```bash
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm test           # Unit- & Komponenten-Tests mit Coverage-Gate (≥ 90 %)
npm run test:e2e   # Playwright-E2E gegen die gebaute Electron-App
npm run test:all   # alles zusammen
```

Ein Husky-Pre-Commit-Hook führt Typecheck, Lint und Tests automatisch aus.

## Windows-exe bauen

```bash
npm run dist
```

Ergebnis in `release/<version>/`:

- `Bewerbery-<version>-x64.exe` – Installer (NSIS, Installationsordner wählbar)
- `Bewerbery-<version>-portable.exe` – portable Version ohne Installation

Die E2E-Tests lassen sich auch gegen die gepackte App ausführen:

```powershell
$env:BEWERBERY_EXE = "$PWD\release\1.0.0\win-unpacked\Bewerbery.exe"; npx playwright test
```

## Projektstruktur

```text
src/
├── shared/      Typen, Zod-Schemas, reine Domain-Logik (Fortschritt, Pinning, XP)
├── main/        Electron-Hauptprozess: storage/, documents/, notifications/, ipc/
├── preload/     typisierte window.api-Bridge
└── renderer/    React-UI: features/ (applications, followup, gamification, settings),
                 components/ui/, stores/, hooks/, lib/
tests/e2e/       Playwright-Tests
specs/           Spec-Kit-Spezifikationen (spec, plan, tasks)
.specify/        Spec-Kit (Constitution, Vorlagen, Skripte)
.claude/         Claude-Code-Regeln, Einstellungen und Spec-Kit-Skills
```

## Spec-Driven Development

Das Projekt nutzt [GitHub Spec-Kit](https://github.com/github/spec-kit). In Claude Code stehen die Skills
`/speckit-specify`, `/speckit-plan`, `/speckit-tasks` und `/speckit-implement` für neue Features bereit.
