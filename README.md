# Bewerbery 🎯

Desktop-App zur Verwaltung deiner Bewerbungen – professionell, aber spielerisch.
Desktop app for managing your job applications – professional, yet playful.

## Inhaltsverzeichnis / Table of Contents

- [🇩🇪 Deutsch](#deutsch)
  - [Beschreibung](#beschreibung)
  - [Tech-Stack](#tech-stack-de)
  - [Projektstruktur](#projektstruktur)
  - [Projekt in VS Code auschecken und starten](#vscode-start-de)
  - [Ausführbare Dateien bauen](#build-de)
  - [Tests ausführen](#tests-de)
  - [CI/CD](#cicd-de)
  - [Spec-Driven Development](#spec-driven-de)
  - [Lizenz](#lizenz-de)
- [🇬🇧 English](#english)
  - [Description](#description)
  - [Tech Stack](#tech-stack-en)
  - [Project Structure](#project-structure)
  - [Checking Out and Starting the Project in VS Code](#vscode-start-en)
  - [Building Executables](#build-en)
  - [Running the Tests](#tests-en)
  - [CI/CD](#cicd-en)
  - [Spec-Driven Development](#spec-driven-en)
  - [License](#license-en)

---

<a id="deutsch"></a>

## 🇩🇪 Deutsch

<a id="beschreibung"></a>

### Beschreibung

Bewerbery ist eine lokale Desktop-Anwendung (Windows & Linux), mit der du deine Bewerbungen als
Karten verwaltest: Unternehmen, Position, Ansprechpartner, Absendedatum, eingereichte Dokumente und
Notizen. Ein Fortschrittsbalken zeigt an, wann eine Nachfrage fällig ist, fällige Bewerbungen werden
im Bereich „Jetzt melden" angepinnt, und der Bewerbungsstatus durchläuft eine Pipeline von
„Beworben" über „Termin" bis „Angebot / Absage". Über den Button „Als PDF exportieren" lassen sich
ausgewählte Bewerbungen (einzeln oder per „Alle auswählen") als druckbare Zusammenfassung
(Kontakt, Status, Fristen, Dokumentnamen – ohne Dateiinhalte) an einen frei wählbaren Ort speichern.
Ein dezentes Gamification-System (XP, Level, Abzeichen, Wochen-Serie, Konfetti) motiviert am Ball zu
bleiben, und optionale System-Benachrichtigungen erinnern rechtzeitig ans Nachhaken.

Alle Daten bleiben **zu 100 % lokal** auf dem Rechner (`%APPDATA%/Bewerbery` unter Windows bzw.
`~/.config/Bewerbery` unter Linux) – keine Cloud, kein Tracking. Die App unterstützt hellen und
dunklen Modus und ist responsiv ab 360 px Fensterbreite.

<a id="tech-stack-de"></a>

### Tech-Stack

| Technologie                      | Zweck                                                      |
| --------------------------------- | ----------------------------------------------------------- |
| Electron 44                       | Desktop-Runtime (Hauptprozess, Fenster, Benachrichtigungen) |
| electron-vite 5                   | Build-Tooling für Main/Preload/Renderer                    |
| Vite 7                            | Dev-Server & Bundling für den Renderer                     |
| React 19                          | UI der Renderer-Oberfläche                                 |
| TypeScript 6                      | Typsicherheit in allen Prozessen                            |
| Tailwind CSS 4                    | Styling über Utility-Klassen & Design-Tokens                |
| Zustand 5                         | State-Management im Renderer                                 |
| Zod 4                             | Laufzeit-Validierung (Schemas, IPC-Payloads)                 |
| date-fns 4                        | Datumsberechnungen (Fristen, Follow-ups)                     |
| Motion                            | Animationen (Konfetti, dezente Übergänge)                    |
| pdf-lib                           | PDF-Erzeugung für den Bewerbungs-Export (reines JS, keine nativen Module) |
| Vitest 5 + Testing Library        | Unit- & Komponententests mit Coverage-Gate                   |
| Playwright (Electron)             | End-to-End-Tests gegen die laufende App                      |
| electron-builder 26               | Paketierung als Installer/portable/AppImage/tar.gz           |

<a id="projektstruktur"></a>

### Projektstruktur

```text
src/
├── shared/      Typen, Zod-Schemas, reine Domain-Logik (Fortschritt, Pinning, XP)
├── main/        Electron-Hauptprozess: storage/, documents/, notifications/, ipc/
├── preload/     typisierte window.api-Bridge
└── renderer/    React-UI: features/ (applications, followup, gamification, settings),
                 components/ui/, stores/, hooks/, lib/
tests/
├── unit/        Unit- & Komponententests (spiegelt die Struktur von src/)
└── e2e/         Playwright-Tests
specs/           Spec-Kit-Spezifikationen (spec, plan, tasks)
.specify/        Spec-Kit (Constitution, Vorlagen, Skripte)
.claude/         Claude-Code-Regeln, Einstellungen und Spec-Kit-Skills
```

<a id="vscode-start-de"></a>

### Projekt in VS Code auschecken und starten

```bash
git clone <repository-url>
cd Bewerbery
npm install
code .              # Projekt in VS Code öffnen
npm run dev         # App mit Hot Reload starten
```

> In einem VS-Code-Terminal ist `ELECTRON_RUN_AS_NODE` gesetzt. Falls die App nicht startet:
> `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell) bzw. `unset ELECTRON_RUN_AS_NODE` (Bash).

<a id="build-de"></a>

### Ausführbare Dateien bauen

**Windows-exe (ohne Docker):**

```bash
npm run dist
```

Ergebnis in `release/<version>/`:

- `Bewerbery-<version>-x64.exe` – Installer (NSIS, Installationsordner wählbar)
- `Bewerbery-<version>-portable.exe` – portable Version ohne Installation

**Linux-Pakete:**

| Wo wird gebaut?                             | Befehl                                     |
| -------------------------------------------- | ------------------------------------------- |
| auf Linux (ohne Docker)                      | `npm run dist:linux`                        |
| auf Windows mit Docker Desktop (empfohlen)   | `npm run dist:linux:docker`                  |
| auf Windows ohne Docker                      | `npm run dist:linux` (siehe Hinweis unten)   |
| Linux-App testen (Windows + Docker)          | `npm run test:e2e:linux`                     |

Ergebnis ebenfalls in `release/<version>/`:

- `Bewerbery-<version>-x86_64.AppImage` – läuft ohne Installation auf fast allen Distributionen
  (`chmod +x Bewerbery-*.AppImage && ./Bewerbery-*.AppImage`)
- `Bewerbery-<version>-x64.tar.gz` – entpacken und `./bewerbery` starten

Ohne Docker braucht das AppImage unter Windows den **Entwicklermodus** (für symbolische Links);
ohne ihn entsteht nur das `tar.gz`. `dist:linux:docker` baut im offiziellen Image
`electronuserland/builder` und installiert die Abhängigkeiten dort neu, dein lokales
`node_modules` bleibt unberührt.

> Hinweis für Ubuntu ab 24.04: AppImages benötigen `libfuse2` (`sudo apt install libfuse2t64`).

<a id="tests-de"></a>

### Tests ausführen

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # Unit- & Komponententests (tests/unit) mit Coverage-Gate (≥ 90 %)
npm run test:e2e    # Playwright-E2E (tests/e2e) gegen die gebaute Electron-App
npm run test:all    # alles zusammen
```

Ein Husky-Pre-Commit-Hook führt Typecheck, Lint und Tests automatisch aus.

Die E2E-Tests lassen sich auch gegen die gepackte App ausführen:

```powershell
$env:BEWERBERY_EXE = "$PWD\release\1.0.0\win-unpacked\Bewerbery.exe"; npx playwright test
```

<a id="cicd-de"></a>

### CI/CD

Zwei GitHub-Actions-Workflows unter [.github/workflows/](.github/workflows/):

- **`tests.yml`** – läuft automatisch bei jedem Öffnen oder Aktualisieren eines Pull Requests:
  Typecheck, Lint, Unit-/Komponententests (Coverage-Gate ≥ 90 %) und E2E-Tests.
- **`release.yml`** – manuell auslösbar über den *Actions*-Tab (`workflow_dispatch`). Fragt nach
  einer neuen SemVer-Versionsnummer, setzt sie in `package.json`, erstellt Git-Tag und
  GitHub-Release und baut anschließend drei Artefakte, die am Release angehängt werden:
  Windows-Installer-exe, Windows-portable-exe und Linux-AppImage.

<a id="spec-driven-de"></a>

### Spec-Driven Development

Das Projekt nutzt [GitHub Spec-Kit](https://github.com/github/spec-kit). In Claude Code stehen die
Skills `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` und `/speckit-implement` für neue
Features bereit.

<a id="lizenz-de"></a>

### Lizenz

Dieses Projekt steht unter der [GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later).
Abgeleitete Werke, auch als kompilierte Installer/Binaries, müssen ebenfalls unter GPL-3.0
veröffentlicht werden.

---

<a id="english"></a>

## 🇬🇧 English

<a id="description"></a>

### Description

Bewerbery is a local desktop application (Windows & Linux) for managing job applications as cards:
company, position, contact person, submission date, submitted documents and notes. A progress bar
shows when a follow-up is due, due applications are pinned in the "Follow up now" section, and the
application status moves through a pipeline from "Applied" to "Interview" to "Offer / Rejection".
The "Export as PDF" button lets you select applications (individually or via "Select all") and save
a printable summary (contact info, status, deadlines, document names – no file contents) to a
location of your choice. A subtle gamification system (XP, levels, badges, weekly streak, confetti)
keeps you motivated, and optional system notifications remind you to follow up in time.

All data stays **100 % local** on the machine (`%APPDATA%/Bewerbery` on Windows, or
`~/.config/Bewerbery` on Linux) – no cloud, no tracking. The app supports light and dark mode and is
responsive down to a 360 px window width.

<a id="tech-stack-en"></a>

### Tech Stack

| Technology                        | Purpose                                                      |
| ---------------------------------- | -------------------------------------------------------------- |
| Electron 44                        | Desktop runtime (main process, windows, notifications)        |
| electron-vite 5                    | Build tooling for main/preload/renderer                        |
| Vite 7                             | Dev server & bundling for the renderer                         |
| React 19                           | Renderer UI                                                    |
| TypeScript 6                       | Type safety across all processes                               |
| Tailwind CSS 4                     | Styling via utility classes & design tokens                    |
| Zustand 5                          | State management in the renderer                                |
| Zod 4                              | Runtime validation (schemas, IPC payloads)                      |
| date-fns 4                         | Date calculations (deadlines, follow-ups)                       |
| Motion                             | Animations (confetti, subtle transitions)                       |
| pdf-lib                            | PDF generation for the application export (pure JS, no native modules) |
| Vitest 5 + Testing Library         | Unit & component tests with coverage gate                       |
| Playwright (Electron)              | End-to-end tests against the running app                        |
| electron-builder 26                | Packaging as installer/portable/AppImage/tar.gz                 |

<a id="project-structure"></a>

### Project Structure

```text
src/
├── shared/      Types, Zod schemas, pure domain logic (progress, pinning, XP)
├── main/        Electron main process: storage/, documents/, notifications/, ipc/
├── preload/     typed window.api bridge
└── renderer/    React UI: features/ (applications, followup, gamification, settings),
                 components/ui/, stores/, hooks/, lib/
tests/
├── unit/        Unit & component tests (mirrors the src/ structure)
└── e2e/         Playwright tests
specs/           Spec-Kit specifications (spec, plan, tasks)
.specify/        Spec-Kit (constitution, templates, scripts)
.claude/         Claude Code rules, settings and Spec-Kit skills
```

<a id="vscode-start-en"></a>

### Checking Out and Starting the Project in VS Code

```bash
git clone <repository-url>
cd Bewerbery
npm install
code .              # open the project in VS Code
npm run dev         # start the app with hot reload
```

> `ELECTRON_RUN_AS_NODE` is set in a VS Code terminal. If the app doesn't start:
> `Remove-Item Env:ELECTRON_RUN_AS_NODE` (PowerShell) or `unset ELECTRON_RUN_AS_NODE` (Bash).

<a id="build-en"></a>

### Building Executables

**Windows exe (without Docker):**

```bash
npm run dist
```

Output in `release/<version>/`:

- `Bewerbery-<version>-x64.exe` – installer (NSIS, choosable install directory)
- `Bewerbery-<version>-portable.exe` – portable version, no installation required

**Linux packages:**

| Where is it built?                          | Command                                      |
| --------------------------------------------- | ---------------------------------------------- |
| on Linux (without Docker)                     | `npm run dist:linux`                           |
| on Windows with Docker Desktop (recommended)  | `npm run dist:linux:docker`                    |
| on Windows without Docker                     | `npm run dist:linux` (see note below)          |
| test the Linux app (Windows + Docker)         | `npm run test:e2e:linux`                       |

Also output to `release/<version>/`:

- `Bewerbery-<version>-x86_64.AppImage` – runs without installation on almost all distributions
  (`chmod +x Bewerbery-*.AppImage && ./Bewerbery-*.AppImage`)
- `Bewerbery-<version>-x64.tar.gz` – extract and run `./bewerbery`

Without Docker, the AppImage requires **Developer Mode** on Windows (for symbolic links); without
it, only the `tar.gz` is produced. `dist:linux:docker` builds inside the official
`electronuserland/builder` image and reinstalls dependencies there — your local `node_modules`
stays untouched.

> Note for Ubuntu 24.04+: AppImages require `libfuse2` (`sudo apt install libfuse2t64`).

<a id="tests-en"></a>

### Running the Tests

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # unit & component tests (tests/unit) with coverage gate (≥ 90 %)
npm run test:e2e    # Playwright E2E (tests/e2e) against the built Electron app
npm run test:all    # everything together
```

A Husky pre-commit hook automatically runs typecheck, lint and tests.

The E2E tests can also be run against the packaged app:

```powershell
$env:BEWERBERY_EXE = "$PWD\release\1.0.0\win-unpacked\Bewerbery.exe"; npx playwright test
```

<a id="cicd-en"></a>

### CI/CD

Two GitHub Actions workflows under [.github/workflows/](.github/workflows/):

- **`tests.yml`** – runs automatically whenever a pull request is opened or updated: typecheck, lint,
  unit/component tests (coverage gate ≥ 90 %) and E2E tests.
- **`release.yml`** – manually triggered from the *Actions* tab (`workflow_dispatch`). Asks for a
  new SemVer version number, sets it in `package.json`, creates a Git tag and GitHub release, then
  builds three artifacts attached to that release: the Windows installer exe, the Windows portable
  exe and the Linux AppImage.

<a id="spec-driven-en"></a>

### Spec-Driven Development

The project uses [GitHub Spec-Kit](https://github.com/github/spec-kit). In Claude Code, the skills
`/speckit-specify`, `/speckit-plan`, `/speckit-tasks` and `/speckit-implement` are available for new
features.

<a id="license-en"></a>

### License

This project is licensed under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later).
Derivative works, including compiled installers/binaries, must also be released under GPL-3.0.
