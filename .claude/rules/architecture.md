# Architektur- & Ordnerregeln

- `src/shared` darf **nichts** aus `main`, `preload` oder `renderer` importieren.
- `src/renderer` greift nie direkt auf Node/Electron zu – nur über `getApi()` (`lib/api.ts`).
- `src/main/index.ts` bleibt reiner Glue-Code; Logik gehört in testbare Services unter `src/main/<bereich>/`.
- Jede IPC-Nutzlast wird im Handler mit Zod validiert (`registerIpc.ts`). Neue Kanäle:
  1. Name in `IPC` + Signatur in `BewerberyApi` (`src/shared/ipc.ts`)
  2. Handler in `registerIpc.ts` + Test
  3. Weiterleitung in `src/preload/index.ts` + Test
  4. Mock in `src/renderer/src/test/mockApi.ts`
- UI-Features liegen in `src/renderer/src/features/<feature>/`; wiederverwendbare Bausteine in
  `components/ui/`. Komponenten-Dateien exportieren nur Komponenten (React Fast Refresh).
- Electron-Sicherheit: `contextIsolation`, `sandbox`, kein `nodeIntegration`, externe Links nur via
  `decideNavigation()` / `isExternalUrl()`.
- Keine nativen Node-Module (exe-Build ohne Toolchain). Keine Netzwerkzugriffe (Local-First).
