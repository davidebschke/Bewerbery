# Bewerbery Constitution

## Core Principles

### I. Local-First & Privacy (NON-NEGOTIABLE)
Alle Daten (Bewerbungen, Einstellungen, Fortschritt, Dokumente) werden ausschließlich lokal im
Benutzerdatenverzeichnis gespeichert. Es gibt keine Netzwerkaufrufe, kein Tracking und keine Cloud.
Schreibvorgänge sind atomar (Temp-Datei + Rename), geladene Daten werden per Schema validiert.

### II. Pure Domain Logic
Fachlogik (Fortschritt, Status, Sortierung/Pinning, XP, Level, Badges, Streaks) liegt als reines
TypeScript in `src/shared/` – ohne Abhängigkeiten zu React oder Electron. Sie ist deterministisch
(das aktuelle Datum wird immer als Parameter übergeben) und vollständig unit-getestet.

### III. Test-First & Coverage Gate (NON-NEGOTIABLE)
Jede Funktion wird von Tests begleitet: Unit-Tests (Domain, Main-Services), Komponenten-Tests (UI)
und E2E-Tests (Electron). `npm test` erzwingt ≥ 90 % Line-/Branch-/Function-/Statement-Coverage.
Kein Merge mit roten Tests.

### IV. Modular Feature Structure
Code ist nach Verantwortung getrennt: `main/` (Prozess, Storage, Dokumente, IPC), `preload/`
(typisierte Bridge), `shared/` (Typen, Schemas, Domain), `renderer/src/features/<feature>/`
(UI pro Feature), `renderer/src/components/ui/` (generische Bausteine). Keine zyklischen Imports.

### V. Secure Electron Defaults
`contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`. Der Renderer spricht nur über
die typisierte `window.api`-Bridge mit dem Main-Prozess. Jede IPC-Nutzlast wird im Main validiert.

### VI. Professional, but Playful
Die UI ist sauber, klar und barrierearm (Tastatur, ARIA-Labels, Kontraste), spielerische Elemente
(XP, Level, Badges, Konfetti) sind dezent und blockieren nie die Arbeit. Oberfläche nur auf Deutsch.
Responsiv ab 360 px Fensterbreite.

## Technology Constraints

Electron + electron-vite, React 19, TypeScript (strict), Tailwind CSS 4, Zustand, Zod, date-fns,
Motion, Vitest + Testing Library, Playwright (Electron), electron-builder (NSIS + portable exe).
Keine nativen Node-Module, damit der Windows-Build ohne Build-Toolchain funktioniert.

## Development Workflow

1. Spezifikation (`specs/<nr>-<name>/spec.md`) → Plan → Tasks → Umsetzung (Spec-Kit-Skills).
2. Arbeit auf Feature-Branches, kleine thematische Commits (Conventional Commits).
3. Quality Gate vor jedem Commit: `npm run typecheck`, `npm run lint`, `npm test`.
4. Vor einem Release zusätzlich `npm run test:e2e` und `npm run dist`.

## Governance

Diese Constitution hat Vorrang vor anderen Konventionen. Änderungen werden hier dokumentiert,
mit Versionssprung begründet und in `CLAUDE.md` gespiegelt.

**Version**: 1.0.0 | **Ratified**: 2026-09-23 | **Last Amended**: 2026-09-23
