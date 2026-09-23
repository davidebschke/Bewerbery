---
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "tests/**/*.ts"
---

# Test-Regeln

- Jede neue Datei in `src/` bekommt eine Test-Datei daneben (`*.test.ts` / `*.test.tsx`).
- Coverage-Gate: 90 % für Lines, Branches, Functions, Statements (`vitest.config.ts`). Nie senken.
- Domain-Logik: deterministische Tests mit festem Datum (`new Date(2026, 8, 23)`), keine echten Uhrzeiten.
- Main-Services: gegen echte temporäre Verzeichnisse (`mkdtemp`) testen, Electron-APIs injizieren/mocken.
- Renderer: Testing Library + user-event, Abfragen über Rollen/Labels (nicht über CSS-Klassen).
  `freezeToday()` aus `src/renderer/src/test/utils.ts` friert nur `Date` ein.
  `window.api` wird in `test/setup.ts` automatisch durch `installMockApi()` ersetzt.
- E2E (`tests/e2e`): Playwright `_electron`, isoliertes Datenverzeichnis über `BEWERBERY_USER_DATA`.
- Vor jedem Commit: `npm run typecheck && npm run lint && npm test`.
