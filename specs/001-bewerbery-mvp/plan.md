# Implementation Plan: Bewerbery MVP

**Branch**: `feature/bewerbery-mvp` | **Date**: 2026-09-23 | **Spec**: [spec.md](./spec.md)

## Summary

Electron-Desktop-App (electron-vite) mit React-Renderer. Daten als eine JSON-Datei im
`userData`-Verzeichnis, Dokumente als Kopien in `userData/documents`. Reine Domain-Logik in
`src/shared`, UI nach Features gegliedert, typisierte IPC-Bridge.

## Technical Context

**Language/Version**: TypeScript (strict), Electron-Node-Runtime
**Primary Dependencies**: Electron, electron-vite, React 19, Tailwind CSS 4, Zustand, Zod, date-fns, Motion, canvas-confetti, lucide-react
**Storage**: JSON-Datei `bewerbery-data.json` (atomar) + Dokumentkopien
**Testing**: Vitest (node + jsdom Projekte), Testing Library, Playwright `_electron`
**Target Platform**: Windows 10/11 (x64), Build via electron-builder (NSIS + portable)
**Constraints**: Offline, keine nativen Module, min. Fensterbreite 360 px
**Scale/Scope**: Einzelplatz, bis einige hundert Bewerbungen

## Constitution Check

| Prinzip | Erfüllt durch |
|---|---|
| I Local-First | `main/storage` + `main/documents`, keine Netzwerk-Dependencies |
| II Pure Domain | `src/shared/domain/*` mit `today`-Parameter |
| III Test-First | Vitest-Coverage-Thresholds 90 %, Playwright-E2E |
| IV Modular | Ordnerstruktur unten |
| V Secure Electron | `webPreferences` sandbox/contextIsolation, Zod in IPC-Handlern |
| VI Playful UI | `features/gamification`, Motion, Konfetti, Deutsch |

## Project Structure

```text
src/
├── main/
│   ├── index.ts                 # App-Lifecycle, Fenster (Glue, per E2E getestet)
│   ├── window.ts                # BrowserWindow-Optionen
│   ├── ipc/registerIpc.ts       # IPC-Handler → Services
│   ├── storage/dataStore.ts     # Laden/Speichern/Validieren/Backup
│   ├── documents/documentService.ts
│   └── notifications/reminderService.ts
├── preload/
│   ├── index.ts                 # contextBridge window.api
│   └── index.d.ts
├── shared/
│   ├── types.ts  schemas.ts  ipc.ts  constants.ts
│   └── domain/ followUp.ts  sorting.ts  gamification.ts  dates.ts  factory.ts
└── renderer/
    ├── index.html
    └── src/
        ├── main.tsx  App.tsx
        ├── lib/api.ts  lib/cn.ts
        ├── stores/appStore.ts
        ├── hooks/useToday.ts useTheme.ts useDebouncedSave.ts
        ├── components/ui/ Button Dialog Field ProgressBar Badge EmptyState Toast
        └── features/
            ├── applications/ ApplicationCard ApplicationForm ApplicationList Toolbar DocumentList
            ├── followup/ FollowUpBar PinnedSection
            ├── gamification/ XpBar BadgesDialog StatsBar celebrate.ts
            └── settings/ SettingsDialog
tests/e2e/ app.spec.ts
```

## Data Flow

1. Start: Renderer ruft `api.loadData()` → Main liest/validiert JSON → Store hydratisiert.
2. Aktion im Store → neuer State → debounced `api.saveData(data)` → Main validiert und schreibt atomar.
3. Main hält letzten Stand; `reminderService` prüft stündlich + nach jedem Speichern auf neu fällige Cards.

## Complexity Tracking

Keine Verletzungen der Constitution.
