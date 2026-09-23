// Baut die Linux-Pakete (AppImage + tar.gz) in einem Linux-Container.
// Nötig unter Windows, weil das AppImage symbolische Links braucht.
// Voraussetzung: Docker läuft und `npm run build` wurde ausgeführt (out/ existiert).
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const IMAGE = 'electronuserland/builder:latest'
const root = resolve(import.meta.dirname, '..')

if (!existsSync(resolve(root, 'out/main/index.js'))) {
  console.error('out/ fehlt – bitte zuerst `npm run build` ausführen.')
  process.exit(1)
}

const docker = spawnSync('docker', ['info'], { stdio: 'ignore' })
if (docker.status !== 0) {
  console.error('Docker läuft nicht. Bitte Docker Desktop starten und erneut versuchen.')
  process.exit(1)
}

// node_modules werden im Container neu installiert (Linux-Binaries), ohne den Windows-Stand anzufassen
const script = [
  'tar -C /project --exclude=./node_modules --exclude=./release --exclude=./.git -cf - . | tar -C /build -xf -',
  'cd /build',
  'npm ci --ignore-scripts --no-audit --no-fund',
  'npx electron-builder --linux',
  'mkdir -p /project/release',
  'cp -r release/. /project/release/',
].join(' && ')

const result = spawnSync(
  'docker',
  [
    'run',
    '--rm',
    '-v',
    `${root}:/project`,
    '-v',
    'bewerbery-electron-cache:/root/.cache/electron',
    '-v',
    'bewerbery-builder-cache:/root/.cache/electron-builder',
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
