# Tasks: Bewerbery MVP

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)

## Phase 1: Setup

- [x] T001 Git-Repository, `main`, Branch `feature/bewerbery-mvp`
- [x] T002 Spec-Kit initialisieren, Constitution, Spec, Plan, Tasks
- [x] T003 `CLAUDE.md`, `.claude/settings.json`, `.claude/rules/*`
- [x] T004 electron-vite + React + TS + Tailwind Gerüst, ESLint, Prettier, Husky
- [x] T005 Vitest (node/jsdom), Coverage-Gate 90 %, Playwright-Konfiguration

## Phase 2: Foundational (Domain & Main)

- [x] T010 [P] `shared/types.ts`, `shared/schemas.ts` + Tests
- [x] T011 [P] `shared/domain/followUp.ts` (Fortschritt, Status) + Tests [US2]
- [x] T012 [P] `shared/domain/sorting.ts` (Pinning, Dringlichkeit, Filter/Suche) + Tests [US3]
- [x] T013 [P] `shared/domain/gamification.ts` (XP, Level, Badges, Streak) + Tests [US5]
- [x] T014 `main/storage/dataStore.ts` + Tests (atomar, Backup bei Korruption)
- [x] T015 `main/documents/documentService.ts` + Tests [US1]
- [x] T016 `main/notifications/reminderService.ts` + Tests [US6]
- [x] T017 `main/ipc/registerIpc.ts` + Tests, `preload/index.ts`

## Phase 3: UI

- [x] T020 Store `stores/appStore.ts` + Tests
- [x] T021 UI-Bausteine `components/ui/*` + Tests
- [x] T022 [US1] ApplicationForm, ApplicationCard, DocumentList + Tests
- [x] T023 [US2/US3] FollowUpBar, PinnedSection, ApplicationList + Tests
- [x] T024 [US4] Status-Wechsel, Termin, Konfetti + Tests
- [x] T025 [US5] XpBar, StatsBar, BadgesDialog + Tests
- [x] T026 [US6] SettingsDialog, Theme + Tests
- [x] T027 App-Shell, responsives Layout + Tests

## Phase 4: Polish

- [x] T030 Playwright-E2E: Anlegen, Persistenz, Pinning, Einstellungen, Responsiv
- [x] T031 electron-builder (NSIS + portable), Icon
- [x] T032 README, Abschlussprüfung (typecheck, lint, test, e2e, dist)
