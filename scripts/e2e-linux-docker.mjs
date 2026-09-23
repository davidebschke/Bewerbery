// Führt die Playwright-E2E-Tests gegen die gepackte Linux-App in einem Linux-Container aus
// (virtuelles Display per xvfb). Voraussetzung: `npm run dist:linux:docker` wurde ausgeführt.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const playwrightVersion = JSON.parse(
  readFileSync(resolve(root, 'node_modules/@playwright/test/package.json'), 'utf8'),
).version
const IMAGE = `mcr.microsoft.com/playwright:v${playwrightVersion}-noble`
const unpacked = `release/${pkg.version}/linux-unpacked`

if (!existsSync(resolve(root, unpacked, 'bewerbery'))) {
  console.error(
    `${unpacked}/bewerbery fehlt – bitte zuerst \`npm run dist:linux:docker\` ausführen.`,
  )
  process.exit(1)
}

const script = [
  'tar -C /project --exclude=./node_modules --exclude=./release --exclude=./.git -cf - . | tar -C /build -xf - && cd /build && npm ci --ignore-scripts --no-audit --no-fund || exit 1',
  `xvfb-run -a env BEWERBERY_EXE=/project/${unpacked}/bewerbery BEWERBERY_ELECTRON_ARGS=--no-sandbox npx playwright test`,
  'status=$?',
  'mkdir -p /project/test-results/linux && cp -r test-results/screenshots/. /project/test-results/linux/ 2>/dev/null',
  'exit $status',
].join('; ')

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '--ipc=host',
    '-v',
    `${root}:/project`,
    '--tmpfs',
    '/build:exec,size=4g',
    IMAGE,
    '/bin/bash',
    '-c',
    script,
  ],
  { stdio: 'inherit' },
)
process.exit(result.status ?? 1)
