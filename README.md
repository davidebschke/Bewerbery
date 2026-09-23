# Bewerbery 🎯

Desktop-App zur Verwaltung deiner Bewerbungen – professionell, aber spielerisch.

- **Bewerbungs-Cards** mit Unternehmen, Position, Ansprechpartner (Name, Telefon, E-Mail),
  Absendedatum, eingereichten Dokumenten und Notizen
- **Fortschrittsbalken „Melden“**: zeigt, wann du nachfragen solltest. Die Frist in Wochen ist in den
  Einstellungen einstellbar und pro Bewerbung überschreibbar.
- **Gepinnter Bereich „Jetzt melden“**: fällige Bewerbungen stehen immer ganz oben
- **Status-Pipeline**: Beworben → Termin (mit Datum) → Angebot / Absage
- **Gamification**: XP, 7 Level, Abzeichen, Wochen-Serie, Konfetti bei Terminen und Angeboten
- **Erinnerungen** als System-Benachrichtigung (abschaltbar)
- **100 % lokal**: Daten unter `%APPDATA%/Bewerbery` (Windows) bzw. `~/.config/Bewerbery` (Linux),
  keine Cloud, kein Tracking
- Läuft unter **Windows** (Installer + portable exe) und **Linux** (AppImage + tar.gz)
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

## Linux-Pakete bauen

Ergebnis ebenfalls in `release/<version>/`:

- `Bewerbery-<version>-x86_64.AppImage` – läuft ohne Installation auf fast allen Distributionen
  (`chmod +x Bewerbery-*.AppImage && ./Bewerbery-*.AppImage`)
- `Bewerbery-<version>-x64.tar.gz` – entpacken und `./bewerbery` starten

| Wo wird gebaut?                            | Befehl                                     |
| ------------------------------------------ | ------------------------------------------ |
| auf Linux                                  | `npm run dist:linux`                       |
| auf Windows mit Docker Desktop (empfohlen) | `npm run dist:linux:docker`                |
| auf Windows ohne Docker                    | `npm run dist:linux` (siehe Hinweis unten) |
| Linux-App testen (Windows + Docker)        | `npm run test:e2e:linux`                   |

Ohne Docker braucht das AppImage unter Windows den **Entwicklermodus** (für symbolische Links);
ohne ihn entsteht nur das `tar.gz`.

`dist:linux:docker` baut im offiziellen Image `electronuserland/builder` und installiert die
Abhängigkeiten dort neu, dein lokales `node_modules` bleibt unberührt.

> Hinweis für Ubuntu ab 24.04: AppImages benötigen `libfuse2` (`sudo apt install libfuse2t64`).

## E2E gegen die gepackte App

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
