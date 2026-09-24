import { join } from 'node:path'
import { BrowserWindow, Notification, app, dialog, ipcMain, shell } from 'electron'
import { DOCUMENTS_DIR_NAME } from '@shared/constants'
import type { AppData } from '@shared/types'
import { createDocumentService } from './documents/documentService'
import { registerIpc } from './ipc/registerIpc'
import { createReminderService } from './notifications/reminderService'
import { createDataStore } from './storage/dataStore'
import { createWindowOptions, decideNavigation, isExternalUrl } from './window'

const REMINDER_INTERVAL_MS = 60 * 60 * 1000

// Für E2E-Tests: eigenes, isoliertes Datenverzeichnis
if (process.env.BEWERBERY_USER_DATA) app.setPath('userData', process.env.BEWERBERY_USER_DATA)

let mainWindow: BrowserWindow | null = null
let latestData: AppData | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow(createWindowOptions(join(__dirname, '../preload')))
  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // mailto:/tel:-Links nicht im App-Fenster navigieren, sondern extern öffnen
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const decision = decideNavigation(url, process.env.ELECTRON_RENDERER_URL)
    if (decision === 'allow') return
    event.preventDefault()
    if (decision === 'external') void shell.openExternal(url)
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setAppUserModelId('de.ebschke.bewerbery')

app.whenReady().then(() => {
  const userData = app.getPath('userData')
  const reminders = createReminderService(({ title, body }) => {
    if (Notification.isSupported()) new Notification({ title, body }).show()
  })

  registerIpc({
    ipcMain,
    dataStore: createDataStore(userData),
    documents: createDocumentService(join(userData, DOCUMENTS_DIR_NAME)),
    pickFiles: async () => {
      const result = await dialog.showOpenDialog({
        title: 'Dokumente hinzufügen',
        properties: ['openFile', 'multiSelections'],
      })
      return result.canceled ? [] : result.filePaths
    },
    openPath: (path) => shell.openPath(path),
    onDataChanged: (data) => {
      latestData = data
      reminders.check(data)
    },
  })

  setInterval(() => latestData && reminders.check(latestData), REMINDER_INTERVAL_MS)

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
