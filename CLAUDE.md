# Bewerbery – Hinweise für Claude

Desktop-App (Electron + React + TypeScript) zur Verwaltung von Bewerbungen. Oberfläche nur auf Deutsch.
Verbindliche Grundsätze: [.specify/memory/constitution.md](.specify/memory/constitution.md).
Aktuelle Spezifikation: [specs/001-bewerbery-mvp/](specs/001-bewerbery-mvp/).

## Befehle

| Zweck | Befehl |
|---|---|
| Entwicklung (Hot Reload) | `npm run dev` |
| Typprüfung | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit- & Komponenten-Tests + Coverage (≥ 90 %) | `npm test` |
| E2E-Tests (baut vorher) | `npm run test:e2e` |
| Alles | `npm run test:all` |
| Windows-exe (Installer + portable) | `npm run dist` → `release/<version>/` |
| Linux (AppImage + tar.gz) auf Linux | `npm run dist:linux` |
| Linux-Pakete unter Windows (Docker) | `npm run dist:linux:docker` (`scripts/dist-linux-docker.mjs`) |

Hinweis: In VS Code ist `ELECTRON_RUN_AS_NODE` gesetzt. Die E2E-Tests entfernen die Variable selbst;
für `npm run dev` ggf. vorher `Remove-Item Env:ELECTRON_RUN_AS_NODE` ausführen.

## Architektur

- `src/shared/` – Typen, Zod-Schemas, **reine Domain-Logik** (`domain/followUp.ts`, `sorting.ts`,
  `gamification.ts`, `dates.ts`, `factory.ts`). Kein React/Electron. Datum immer als Parameter.
- `src/main/` – Electron-Hauptprozess. Services sind Factories mit injizierten Abhängigkeiten
  (`createDataStore(dir)`, `createDocumentService(dir)`, `createReminderService(notify)`,
  `registerIpc(deps)`), damit sie ohne Electron testbar sind. `index.ts` ist nur Glue-Code.
- `src/preload/` – typisierte `window.api`-Bridge (`BewerberyApi` in `src/shared/ipc.ts`).
- `src/renderer/src/` – React-UI. Zustand-Store `stores/appStore.ts` hält alle Daten und speichert
  bei jeder Änderung über `getApi().saveData()`. UI nach Features in `features/<feature>/`,
  generische Bausteine in `components/ui/`.

## Datenfluss

Renderer lädt beim Start `loadData()`; jede Store-Aktion erzeugt einen neuen `AppData`-Stand und ruft
`saveData()`. Der Main-Prozess validiert mit Zod, schreibt atomar nach `%APPDATA%/Bewerbery/bewerbery-data.json`
und prüft danach fällige Bewerbungen für Windows-Benachrichtigungen.

## Konventionen

- Siehe `.claude/rules/` für Code-Stil, Tests und Ordnerstruktur.
- Neue Fachlogik zuerst in `src/shared/domain` mit Tests, dann UI.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`).
