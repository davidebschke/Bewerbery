import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

const MAIN = join(__dirname, '../../out/main/index.js')
const SCREENSHOTS = join(__dirname, '../../test-results/screenshots')

function isoDaysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function application(id: string, company: string, sentDaysAgo: number, extra: object = {}) {
  return {
    id,
    company,
    position: 'Softwareentwickler:in',
    contactName: 'Frau Beispiel',
    contactPhone: '+49 30 1234567',
    contactEmail: 'jobs@example.com',
    sentAt: isoDaysAgo(sentDaysAgo),
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  }
}

let userData: string

async function launch(seed?: object): Promise<{ app: ElectronApplication; page: Page }> {
  if (seed) await writeFile(join(userData, 'bewerbery-data.json'), JSON.stringify(seed), 'utf8')
  // VS Code & Co. setzen ELECTRON_RUN_AS_NODE – damit würde Electron als reines Node starten
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    BEWERBERY_USER_DATA: userData,
    NODE_ENV: 'production',
  }
  delete env.ELECTRON_RUN_AS_NODE
  // BEWERBERY_EXE=<Pfad zur gepackten exe> testet den fertigen Build statt out/main
  const executablePath = process.env.BEWERBERY_EXE
  const app = await electron.launch({
    executablePath,
    args: executablePath ? [] : [MAIN],
    env: env as Record<string, string>,
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  return { app, page }
}

async function resize(app: ElectronApplication, width: number, height: number) {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height)
    },
    { width, height },
  )
}

test.beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'bewerbery-e2e-'))
})

test.afterEach(async () => {
  // Chromium gibt Dateien unter Windows verzögert frei
  await rm(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
})

test('creates an application and keeps it after restart', async () => {
  let { app, page } = await launch()
  await expect(page.getByText('Deine Jobsuche startet hier')).toBeVisible()

  await page.getByRole('button', { name: 'Erste Bewerbung anlegen' }).click()
  await page.getByLabel('Unternehmen *').fill('Muster GmbH')
  await page.getByLabel('Ansprechpartner').fill('Herr Muster')
  await page.getByLabel('E-Mail').fill('herr@muster.de')
  await page.getByRole('button', { name: 'Bewerbung anlegen (+10 XP)' }).click()

  await expect(page.getByRole('article', { name: 'Bewerbung bei Muster GmbH' })).toBeVisible()
  await expect(page.getByText('+10 XP · Bewerbung angelegt')).toBeVisible()
  await app.close()

  ;({ app, page } = await launch())
  await expect(page.getByRole('article', { name: 'Bewerbung bei Muster GmbH' })).toBeVisible()
  await app.close()
})

test('pins due applications at the top and follows settings', async () => {
  const { app, page } = await launch({
    version: 1,
    applications: [
      application('fresh', 'Frisch AG', 3),
      application('due', 'Überfällig KG', 20),
      application('iv', 'Termin GmbH', 10, {
        stage: 'interview',
        appointmentAt: '2026-12-01T10:00',
      }),
    ],
    settings: { followUpWeeks: 2, notificationsEnabled: false, theme: 'light' },
  })

  const pinned = page.getByRole('region', { name: /Jetzt melden/ })
  await expect(pinned.getByRole('article')).toHaveCount(1)
  await expect(pinned.getByRole('article', { name: 'Bewerbung bei Überfällig KG' })).toBeVisible()
  await resize(app, 1400, 900)
  await page.screenshot({ path: join(SCREENSHOTS, 'desktop-light.png'), fullPage: true })

  // „Nachgefragt“ setzt den Zähler zurück → Card verlässt den gepinnten Bereich
  await pinned.getByRole('button', { name: 'Nachgefragt' }).click()
  await expect(page.getByRole('region', { name: /Jetzt melden/ })).toHaveCount(0)
  await expect(page.getByText('+5 XP · Nachgefasst')).toBeVisible()

  await page.getByRole('button', { name: 'Einstellungen' }).click()
  await page.getByText('Dunkel').click()
  await page.getByRole('button', { name: 'Schließen' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.waitForTimeout(500) // Farbübergänge abwarten
  await page.screenshot({ path: join(SCREENSHOTS, 'desktop-dark.png'), fullPage: true })
  await app.close()
})

test('is responsive down to 360px without horizontal scrolling', async () => {
  const { app, page } = await launch({
    version: 1,
    applications: [application('due', 'Sehr Langer Unternehmensname Holding GmbH & Co. KG', 30)],
    settings: { followUpWeeks: 2, notificationsEnabled: false, theme: 'light' },
  })
  for (const width of [360, 768, 1280]) {
    await resize(app, width, 800)
    await page.waitForTimeout(200)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0)
    await page.screenshot({ path: join(SCREENSHOTS, `width-${width}.png`), fullPage: true })
  }

  await resize(app, 360, 800)
  await page.getByRole('button', { name: 'Neu', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  // Auf schmalen Fenstern füllt der Dialog die komplette Breite
  const box = await dialog.boundingBox()
  const viewport = await page.evaluate(() => document.documentElement.clientWidth)
  expect(box?.width).toBeGreaterThanOrEqual(viewport - 1)
  await page.screenshot({ path: join(SCREENSHOTS, 'form-360.png') })
  await app.close()
})
