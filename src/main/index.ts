import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BrowserWindow, Menu, Notification, app, dialog, ipcMain, protocol, session as electronSession, shell
} from 'electron'
import { Session } from './session'
import { loadSettings, sanitize, saveSettings } from './settings'
import { DEFAULT_SETTINGS, Settings } from '../shared/types'

// Settings belong to the selected account (its own folder). Defaults apply on the login screen.
let settings: Settings = DEFAULT_SETTINGS
const loadActive = (): void => {
  const p = sess.settingsPath
  settings = p ? loadSettings(p) : DEFAULT_SETTINGS
}
// Packaged: copied to resources/ by electron-builder. Dev: read from build/.
const iconPath = app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(app.getAppPath(), 'build/icon.png')
let win: BrowserWindow | null = null
let idleTimer: NodeJS.Timeout | null = null

const sess = new Session(app.getPath('userData'), () => {
  // The window is already destroyed when the app locks on close.
  if (win && !win.isDestroyed()) win.webContents.send('locked')
})

function resetIdle(): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => sess.lock(), settings.idleMinutes * 60 * 1000)
}

// Checks every 30s; fires once per day at the chosen time (needs the app to be running).
let lastReminderDay = ''
function startReminder(): void {
  setInterval(() => {
    if (!settings.reminder) return
    const n = new Date()
    const hm = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
    const day = n.toDateString()
    if (hm !== settings.reminder || day === lastReminderDay) return
    lastReminderDay = day
    new Notification({ title: 'MiniLifeLetter', icon: iconPath, body: 'وقت نوشتن خاطره‌ی امروز است.' }).show()
  }, 30_000)
}

function registerIpc(): void {
  const guard = <A extends unknown[], R>(fn: (...a: A) => R) =>
    (_e: Electron.IpcMainInvokeEvent, ...a: A): R => {
      resetIdle()
      return fn(...a)
    }
  ipcMain.handle('getSettings', () => { loadActive(); return settings })
  ipcMain.handle('setSettings', (_e, s: unknown) => {
    settings = sanitize(s)
    if (sess.settingsPath) saveSettings(sess.settingsPath, settings)
    resetIdle()
    return settings
  })
  ipcMain.handle('backup', guard(async () => {
    const r = sess.backup()
    if (!r.ok) return r
    const d = await dialog.showSaveDialog(win!, {
      defaultPath: `MiniLifeLetter-${new Date().toISOString().slice(0, 10)}.mlbackup`,
      filters: [{ name: 'MiniLifeLetter backup', extensions: ['mlbackup'] }]
    })
    if (d.canceled || !d.filePath) return { ok: true, value: false }
    writeFileSync(d.filePath, r.value)
    return { ok: true, value: true }
  }))
  ipcMain.handle('restore', guard(async () => {
    const d = await dialog.showOpenDialog(win!, {
      properties: ['openFile'], filters: [{ name: 'MiniLifeLetter backup', extensions: ['mlbackup'] }]
    })
    if (d.canceled || !d.filePaths[0]) return { ok: true, value: false }
    const r = sess.restoreBackup(readFileSync(d.filePaths[0]))
    return r.ok ? { ok: true, value: true } : r
  }))
  ipcMain.handle('exportPdf', guard(async (html: string) => {
    if (!sess.status().unlocked) return { ok: false, error: 'LOCKED' }
    const d = await dialog.showSaveDialog(win!, {
      defaultPath: 'MiniLifeLetter.pdf', filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })
    if (d.canceled || !d.filePath) return { ok: true, value: false }
    const inlined = String(html).replace(/mll:\/\/a\/([0-9a-f-]{36})/g, (_m, id: string) => {
      const img = sess.image(id)
      return img ? `data:${img.mime};base64,${img.data.toString('base64')}` : ''
    })
    writeFileSync(d.filePath, await renderPdf(inlined))
    return { ok: true, value: true }
  }))
  ipcMain.handle('status', guard(() => sess.status()))
  ipcMain.handle('selectAccount', guard((id: string) => { const r = sess.select(String(id)); loadActive(); return r }))
  ipcMain.handle('createAccount', guard(async (n: string, c: string, p: string) => {
    const r = await sess.create(String(n), String(c), String(p))
    loadActive()
    return r
  }))
  ipcMain.handle('adoptLegacy', guard((n: string, c: string) => { const r = sess.adoptLegacy(String(n), String(c)); loadActive(); return r }))
  ipcMain.handle('deleteAccount', guard((p: string) => sess.deleteAccount(String(p))))
  ipcMain.handle('changePassword', guard((o: string, n: string) => sess.changePassword(String(o), String(n))))
  ipcMain.handle('unlock', guard((p: string) => sess.unlock(String(p))))
  ipcMain.handle('unlockWithRecovery', guard((ph: string, np: string) => sess.recover(String(ph), String(np))))
  ipcMain.handle('lock', () => sess.lock())
  ipcMain.handle('listEntries', guard(() => sess.list()))
  ipcMain.handle('saveEntry', guard((i) => sess.save(i)))
  ipcMain.handle('trashEntry', guard((id: string) => sess.trash(String(id))))
  ipcMain.handle('listTrash', guard(() => sess.listTrash()))
  ipcMain.handle('restoreEntry', guard((id: string) => sess.restore(String(id))))
  ipcMain.handle('deleteForever', guard((id: string) => sess.deleteForever(String(id))))
  ipcMain.handle('addImage', guard((eid: string, mime: string, data: Uint8Array) =>
    sess.addImage(String(eid), String(mime), data)))
}

// Serves decrypted images to the renderer only while the app is unlocked.
function registerImageProtocol(): void {
  protocol.handle('mll', (req) => {
    const img = sess.image(new URL(req.url).pathname.slice(1))
    if (!img) return new Response(null, { status: 404 })
    return new Response(new Uint8Array(img.data), { headers: { 'Content-Type': img.mime } })
  })
}

protocol.registerSchemesAsPrivileged([{ scheme: 'mll', privileges: { secure: true, supportFetchAPI: true } }])

// Renders entry HTML in a hidden, script-less window. Journal text is untrusted HTML, so JS is off
// and the CSP blocks every network request (images come from data: URLs inlined by the renderer).
async function renderPdf(body: string): Promise<Buffer> {
  const w = new BrowserWindow({ show: false, webPreferences: { javascript: false, sandbox: true, offscreen: false } })
  try {
    const page = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>body{font-family:Tahoma,sans-serif;line-height:1.9;font-size:12pt}h1{font-size:18pt}article{page-break-inside:avoid;margin-bottom:24pt}img{max-width:100%}small{color:#666}</style>
</head><body>${body}</body></html>`
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page))
    return await w.webContents.printToPDF({ pageSize: 'A4', printBackground: false })
  } finally {
    w.destroy()
  }
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true, // Alt would reveal a hidden menu, so the menu is removed below instead
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.once('ready-to-show', () => win?.show())
  win.on('minimize', () => sess.lock())
  win.on('closed', () => { win = null })
  // Block navigation and new windows; open external links in the system browser only for https.
  win.webContents.on('will-navigate', (e) => e.preventDefault())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (process.env['ELECTRON_RENDERER_URL']) void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  electronSession.defaultSession.webRequest.onHeadersReceived((d, cb) => {
    const dev = !!process.env['ELECTRON_RENDERER_URL']
    const csp = dev
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws:; img-src 'self' data: blob: mll:"
      : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: mll:; connect-src 'none'"
    cb({ responseHeaders: { ...d.responseHeaders, 'Content-Security-Policy': [csp] } })
  })
  Menu.setApplicationMenu(null)
  registerIpc()
  registerImageProtocol()
  createWindow()
  resetIdle()
  startReminder()
})

app.on('window-all-closed', () => {
  sess.lock()
  app.quit()
})
