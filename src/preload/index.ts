import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/types'

const api: Api = {
  backup: () => ipcRenderer.invoke('backup'),
  restore: () => ipcRenderer.invoke('restore'),
  exportPdf: (html) => ipcRenderer.invoke('exportPdf', html),
  selectAccount: (id) => ipcRenderer.invoke('selectAccount', id),
  createAccount: (n, c, p) => ipcRenderer.invoke('createAccount', n, c, p),
  adoptLegacy: (n, c) => ipcRenderer.invoke('adoptLegacy', n, c),
  deleteAccount: (p) => ipcRenderer.invoke('deleteAccount', p),
  changePassword: (o, n) => ipcRenderer.invoke('changePassword', o, n),
  getSettings: () => ipcRenderer.invoke('getSettings'),
  setSettings: (s) => ipcRenderer.invoke('setSettings', s),
  status: () => ipcRenderer.invoke('status'),
  unlock: (p) => ipcRenderer.invoke('unlock', p),
  unlockWithRecovery: (ph, np) => ipcRenderer.invoke('unlockWithRecovery', ph, np),
  lock: () => ipcRenderer.invoke('lock'),
  listEntries: () => ipcRenderer.invoke('listEntries'),
  saveEntry: (i) => ipcRenderer.invoke('saveEntry', i),
  trashEntry: (id) => ipcRenderer.invoke('trashEntry', id),
  listTrash: () => ipcRenderer.invoke('listTrash'),
  restoreEntry: (id) => ipcRenderer.invoke('restoreEntry', id),
  deleteForever: (id) => ipcRenderer.invoke('deleteForever', id),
  addImage: (entryId, mime, data) => ipcRenderer.invoke('addImage', entryId, mime, data),
  onLocked: (cb) => {
    const h = (): void => cb()
    ipcRenderer.on('locked', h)
    return () => ipcRenderer.removeListener('locked', h)
  }
}

contextBridge.exposeInMainWorld('api', api)
