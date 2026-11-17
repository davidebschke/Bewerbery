import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test'
import { buildDocx, PDF_BYTES } from '../fixtures/cv/buildFixtures'

const MAIN = join(__dirname, '../../out/main/index.js')
const SCREENSHOTS = join(__dirname, '../../test-results/screenshots')
const FAKE_KEY = 'sk-ant-e2e-nur-ein-test-schluessel-wxyz'

let userData: string
let files: string

const seed = {
  version: 1,
  applications: [
    {
      id: 'app-1',
      company: 'Muster GmbH',
      position: 'Frontend-Entwickler',
      sentAt: new Date().toISOString().slice(0, 10),
      jobDescription: 'Wir suchen React, TypeScript und Vitest Erfahrung.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  settings: { followUpWeeks: 2, notificationsEnabled: false, theme: 'light' },
}

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BEWERBERY_USER_DATA: userData,
    BEWERBERY_AI_FAKE: '1',
    NODE_ENV: 'production',
  }
  delete env.ELECTRON_RUN_AS_NODE
  const executablePath = process.env.BEWERBERY_EXE
  const extraArgs = process.env.BEWERBERY_ELECTRON_ARGS?.split(' ').filter(Boolean) ?? []
  const app = await electron.launch({
    executablePath,
    args: [...extraArgs, ...(executablePath ? [] : [MAIN])],
    env: env as Record<string, string>,
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

/** Ersetzt die nativen Dateidialoge durch feste Pfade */
async function stubDialogs(app: ElectronApplication, openPath: string, savePath = '') {
  await app.evaluate(
    ({ dialog }, paths) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [paths.openPath],
      })) as typeof dialog.showOpenDialog
      dialog.showSaveDialog = (async () => ({
        canceled: false,
        filePath: paths.savePath,
      })) as typeof dialog.showSaveDialog
    },
    { openPath, savePath },
  )
}

async function resize(app: ElectronApplication, width: number, height: number) {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height)
    },
    { width, height },
  )
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
}

/** Alle Dateien im Datenordner als Text – für die Prüfung auf Klartext-Keys */
async function allUserDataText(dir: string): Promise<string> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  const texts = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => readFile(join(entry.parentPath, entry.name), 'latin1').catch(() => '')),
  )
  return texts.join('\n')
}

test.beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'bewerbery-e2e-cv-'))
  files = await mkdtemp(join(tmpdir(), 'bewerbery-e2e-cv-files-'))
  await writeFile(join(userData, 'bewerbery-data.json'), JSON.stringify(seed), 'utf8')
  await writeFile(join(files, 'Lebenslauf.docx'), buildDocx())
  await writeFile(join(files, 'Lebenslauf.pdf'), PDF_BYTES)
})

test.afterEach(async () => {
  for (const dir of [userData, files]) {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
  }
})

test('optimizes a cv and saves the variants in the original design', async () => {
  let { app, page } = await launch()
  const savePath = join(files, 'Variante.docx')
  await stubDialogs(app, join(files, 'Lebenslauf.docx'), savePath)

  // 1. API-Key hinterlegen
  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await page.getByLabel('API-Key').fill(FAKE_KEY)
  await page.getByRole('button', { name: 'Speichern', exact: true }).click()
  await expect(page.getByText('Key hinterlegt (…wxyz)')).toBeVisible()
  await page.getByRole('button', { name: 'Verbindung prüfen' }).click()
  await expect(page.getByText('der API-Key ist gültig')).toBeVisible()
  await page.keyboard.press('Escape')

  // 2. Lebenslauf und Bewerbung wählen
  await page
    .getByRole('navigation', { name: 'Bereiche' })
    .getByRole('button', { name: /CV/ })
    .click()
  await page.getByRole('button', { name: 'Lebenslauf wählen' }).click()
  await expect(page.getByText('Lebenslauf.docx')).toBeVisible()
  await page.getByLabel('Bewerbung (optional)').selectOption('app-1')
  await expect(page.getByLabel('Text der Stellenanzeige')).toHaveValue(/React, TypeScript/)

  // 3. Optimieren mit Datenschutzhinweis
  await page.getByRole('button', { name: 'Optimieren' }).click()
  await page.getByRole('button', { name: 'Zustimmen und senden' }).click()
  await expect(
    page.getByRole('heading', { name: 'Frontend-Entwickler · Muster GmbH' }),
  ).toBeVisible()

  await resize(app, 1280, 900)
  const columns = page.getByRole('article')
  await expect(columns).toHaveCount(4)
  const ats = columns.nth(3)
  await expect(ats.getByText('Beste Übereinstimmung')).toBeVisible()
  await expect(ats.getByRole('img', { name: 'Übereinstimmung 83 von 100' })).toBeVisible()
  await expect(ats.getByLabel('+29 Punkte gegenüber dem Original')).toBeVisible()
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  await page.screenshot({ path: join(SCREENSHOTS, 'cv-comparison-1280.png'), fullPage: true })

  // 4. Speichern unter … im Originaldesign
  await ats.getByRole('button', { name: 'Speichern unter …' }).click()
  await expect(page.getByText('Variante gespeichert.')).toBeVisible()
  const saved = unzipSync(new Uint8Array(await readFile(savePath)))
  const original = unzipSync(buildDocx())
  expect(Object.keys(saved)).toEqual(Object.keys(original))
  expect(saved['word/styles.xml']).toEqual(original['word/styles.xml'])
  expect(saved['word/media/image1.png']).toEqual(original['word/media/image1.png'])
  expect(new TextDecoder().decode(saved['word/document.xml'])).toContain('(ATS-optimiert)')

  // 5. An die Bewerbung hängen
  await ats.getByRole('button', { name: 'An Bewerbung speichern' }).click()
  await expect(page.getByText('Variante an der Bewerbung gespeichert.')).toBeVisible()
  await expect
    .poll(async () => await readFile(join(userData, 'bewerbery-data.json'), 'utf8'))
    .toContain('Lebenslauf – ATS-optimiert.docx')

  // 6. Schmale Fenster: Tabs statt Spalten, kein horizontales Scrollen
  await resize(app, 360, 800)
  await page.waitForTimeout(200)
  await expect(page.getByRole('tab', { name: 'ATS-optimiert' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await page.getByRole('tab', { name: 'Original' }).click()
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  await page.screenshot({ path: join(SCREENSHOTS, 'cv-comparison-360.png'), fullPage: true })

  // 7. Der Key steht nirgends im Klartext
  expect(await allUserDataText(userData)).not.toContain(FAKE_KEY)
  await app.close()

  // 8. Nach dem Neustart ist das Ergebnis wieder da
  ;({ app, page } = await launch())
  await page
    .getByRole('navigation', { name: 'Bereiche' })
    .getByRole('button', { name: /CV/ })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Frontend-Entwickler · Muster GmbH' }),
  ).toBeVisible()
  await app.close()
})

test('rejects a pdf cv with instructions', async () => {
  const { app, page } = await launch()
  await stubDialogs(app, join(files, 'Lebenslauf.pdf'))
  await page
    .getByRole('navigation', { name: 'Bereiche' })
    .getByRole('button', { name: /CV/ })
    .click()
  await expect(page.getByText(/Hinterlege zuerst deinen Anthropic-API-Key/)).toBeVisible()
  await page.getByRole('button', { name: 'Lebenslauf wählen' }).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('PDF kann nicht mit Design bearbeitet werden')
  await expect(alert).toContainText('als .docx')
  await app.close()
})
