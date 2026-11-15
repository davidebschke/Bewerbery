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
  - [Abhängigkeiten aktualisieren](#deps-de)
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
  - [Updating Dependencies](#deps-en)
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
an einen frei wählbaren Ort speichern: Jede Bewerbung erscheint als abgerundete Karte mit
Kopfzeile („Abgeschickt am" links, „Status" rechts) und drei Kacheln („Unternehmen und Position",
„Kontakt zum Unternehmen", „Dokumente und Notizen" – nur Dokumentnamen, keine Dateiinhalte; die
Nachfass-Frist wird nicht exportiert).
Ein dezentes Gamification-System (XP, Level, Abzeichen, Wochen-Serie, Konfetti) motiviert am Ball zu
bleiben, und optionale System-Benachrichtigungen erinnern rechtzeitig ans Nachhaken. Es gibt bis zu
5.000 Level mit Rangtiteln, deren XP-Abstand stetig wächst. Die Abzeichen sind nach Kategorien
gestaffelt: Bewerbungen, Nachfragen, Termine und Absagen (je 1 bis 1.000), Angebote (1 bis 10) und
Wochen-Serien (3 bis 52 Wochen). Neu freigeschaltete Abzeichen werden per Hinweis gemeldet, und
gesperrte Abzeichen zeigen ihren Fortschritt.

Bestehende Bewerbungen lassen sich über **„Bewerbungen importieren“** aus einer Tabelle übernehmen –
als CSV (`;`, `,` oder Tab; UTF-8 oder Windows-1252), LibreOffice (`.ods`) oder Excel (`.xlsx`). Ein
Assistent erkennt Kopfzeile, Tabellenblatt und Spalten automatisch (deutsche und englische
Spaltennamen, sonst anhand des Inhalts), vereinheitlicht Datums- und Statuswerte und zeigt vor dem
Import eine Vorschau mit Fehlern, Hinweisen und Duplikaten. Nicht erkannte Spalten und Werte landen
in den Notizen, damit nichts verloren geht. Eine ausfüllbare Vorlage gibt es als `.xlsx`, `.ods` und
`.csv`. Importierte Bewerbungen zählen für XP und Abzeichen, gemeldet wird aber nur eine
Sammelmeldung. Unternehmen, Position und Absendedatum sind Pflichtfelder.

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
| fflate                            | ZIP-Lesen/-Schreiben für `.ods`/`.xlsx` beim Tabellen-Import (reines JS)   |
| Vitest 5 + Testing Library        | Unit- & Komponententests mit Coverage-Gate                   |
| Playwright (Electron)             | End-to-End-Tests gegen die laufende App                      |
| electron-builder 26               | Paketierung als Installer/portable/AppImage/tar.gz           |

<a id="projektstruktur"></a>

### Projektstruktur

```text
src/
├── shared/      Typen, Zod-Schemas, reine Domain-Logik (Fortschritt, Pinning, XP,
│                Tabellen-Import: domain/import/)
├── main/        Electron-Hauptprozess: storage/, documents/, notifications/, pdf/,
│                import/ (CSV/ODS/XLSX lesen, Vorlagen schreiben), ipc/
├── preload/     typisierte window.api-Bridge
└── renderer/    React-UI: features/ (applications, followup, gamification, import, settings),
                 components/ui/, stores/, hooks/, lib/
tests/
├── unit/        Unit- & Komponententests (spiegelt die Struktur von src/)
├── fixtures/    Testdateien, z. B. import/ für alle Import-Problemfälle (siehe README dort)
└── e2e/         Playwright-Tests
scripts/         Build- & Wartungsskripte (Linux-Builds per Docker, Override-Prüfung,
                 Erzeugen der Import-Testdateien)
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

Die Testdateien für den Tabellen-Import liegen unter `tests/fixtures/import/` (Beschreibung und
erwartete Ergebnisse in der dortigen README). Sie eignen sich auch zum manuellen Ausprobieren in der
App. Neu erzeugen (benötigt LibreOffice): `node scripts/generate-import-samples.mjs`.

Die E2E-Tests lassen sich auch gegen die gepackte App ausführen:

```powershell
$env:BEWERBERY_EXE = "$PWD\release\1.0.0\win-unpacked\Bewerbery.exe"; npx playwright test
```

<a id="deps-de"></a>

### Abhängigkeiten aktualisieren

```bash
npm outdated              # veraltete Pakete anzeigen
npm audit                 # bekannte Sicherheitslücken anzeigen
npm run deps:overrides    # prüfen, ob die Overrides in package.json noch gebraucht werden
```

Updates werden pro Paket einzeln installiert (`npm install <paket>@<version>`) und als eigener
Commit `chore(deps): bump <paket> from X to Y` festgehalten. Pakete, die exakt dieselbe Version
verlangen (`react`/`react-dom`, `vitest`/`@vitest/coverage-v8`), werden gemeinsam aktualisiert.

**Overrides:** Unter `overrides` in der `package.json` werden anfällige Versionen indirekter
Abhängigkeiten ersetzt, für die es upstream noch keinen Fix gibt. Aktuell:

| Override | Grund |
|---|---|
| `minimatch@>=7.0.0 <11.0.1` → `^11.0.8` | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (DoS); betrifft nur Build/Lint über `electron-builder` und `typescript-eslint` |

Der Override greift nur auf die anfälligen Versionen, ältere Hauptversionen (3.x, 5.x) bleiben
unberührt. Durch den Caret-Bereich werden neue 11.x-Versionen weiterhin mit `npm update` geholt.
Meldet `npm run deps:overrides` „kann aus package.json entfernt werden“, den Eintrag löschen und
anschließend `npm install`, `npm audit` und `npm run test:all` ausführen.

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
a printable summary to a location of your choice: each application is shown as a rounded card with
a header line ("Sent on" on the left, "Status" on the right) and three tiles ("Company and
position", "Contact at the company", "Documents and notes" – document names only, no file contents;
the follow-up deadline is not exported). A subtle gamification system (XP, levels, badges, weekly streak, confetti)
keeps you motivated, and optional system notifications remind you to follow up in time. There are up
to 5,000 levels with rank titles, and the XP needed per level keeps growing. Badges are tiered by
category: applications, follow-ups, interviews and rejections (1 to 1,000 each), offers (1 to 10)
and weekly streaks (3 to 52 weeks). Newly unlocked badges are announced with a notice, and locked
badges show their progress.

Existing applications can be taken over from a spreadsheet via **"Bewerbungen importieren"** (import
applications) – as CSV (`;`, `,` or tab; UTF-8 or Windows-1252), LibreOffice (`.ods`) or Excel
(`.xlsx`). A wizard detects the header row, sheet and columns automatically (German and English
column names, otherwise by content), normalises dates and status values and shows a preview with
errors, notices and duplicates before importing. Unrecognised columns and values are kept in the
notes so nothing gets lost. A fillable template is available as `.xlsx`, `.ods` and `.csv`. Imported
applications count towards XP and badges, but only a single summary notice is shown. Company,
position and submission date are required fields.

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
| fflate                             | ZIP reading/writing for `.ods`/`.xlsx` in the spreadsheet import (pure JS) |
| Vitest 5 + Testing Library         | Unit & component tests with coverage gate                       |
| Playwright (Electron)              | End-to-end tests against the running app                        |
| electron-builder 26                | Packaging as installer/portable/AppImage/tar.gz                 |

<a id="project-structure"></a>

### Project Structure

```text
src/
├── shared/      Types, Zod schemas, pure domain logic (progress, pinning, XP,
│                spreadsheet import: domain/import/)
├── main/        Electron main process: storage/, documents/, notifications/, pdf/,
│                import/ (read CSV/ODS/XLSX, write templates), ipc/
├── preload/     typed window.api bridge
└── renderer/    React UI: features/ (applications, followup, gamification, import, settings),
                 components/ui/, stores/, hooks/, lib/
tests/
├── unit/        Unit & component tests (mirrors the src/ structure)
├── fixtures/    test files, e.g. import/ for every import edge case (see the README there)
└── e2e/         Playwright tests
scripts/         build & maintenance scripts (Linux builds via Docker, override check,
                 generating the import test files)
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

The test files for the spreadsheet import live in `tests/fixtures/import/` (description and expected
results in the README there). They are also handy for trying the import manually in the app.
Regenerate them (requires LibreOffice): `node scripts/generate-import-samples.mjs`.

The E2E tests can also be run against the packaged app:

```powershell
$env:BEWERBERY_EXE = "$PWD\release\1.0.0\win-unpacked\Bewerbery.exe"; npx playwright test
```

<a id="deps-en"></a>

### Updating Dependencies

```bash
npm outdated              # list outdated packages
npm audit                 # list known vulnerabilities
npm run deps:overrides    # check whether the overrides in package.json are still needed
```

Updates are installed one package at a time (`npm install <package>@<version>`) and recorded as a
separate commit `chore(deps): bump <package> from X to Y`. Packages that require the exact same
version (`react`/`react-dom`, `vitest`/`@vitest/coverage-v8`) are updated together.

**Overrides:** The `overrides` section in `package.json` replaces vulnerable versions of transitive
dependencies for which no upstream fix exists yet. Currently:

| Override | Reason |
|---|---|
| `minimatch@>=7.0.0 <11.0.1` → `^11.0.8` | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) (DoS); only affects build/lint via `electron-builder` and `typescript-eslint` |

The override only applies to the vulnerable versions; older major versions (3.x, 5.x) are left
untouched. Thanks to the caret range, new 11.x releases are still picked up by `npm update`.
Once `npm run deps:overrides` reports "kann aus package.json entfernt werden" (can be removed),
delete the entry and run `npm install`, `npm audit` and `npm run test:all`.

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
