import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IPC, type BewerberyApi } from '@shared/ipc'

export const api: BewerberyApi = {
  loadData: () => ipcRenderer.invoke(IPC.loadData),
  saveData: (data) => ipcRenderer.invoke(IPC.saveData, data),
  pickDocuments: (applicationId) => ipcRenderer.invoke(IPC.pickDocuments, applicationId),
  importDocuments: (applicationId, filePaths) =>
    ipcRenderer.invoke(IPC.importDocuments, applicationId, filePaths),
  openDocument: (applicationId, document) =>
    ipcRenderer.invoke(IPC.openDocument, applicationId, document),
  removeDocument: (applicationId, document) =>
    ipcRenderer.invoke(IPC.removeDocument, applicationId, document),
  removeAllDocuments: (applicationId) => ipcRenderer.invoke(IPC.removeAllDocuments, applicationId),
  exportApplicationsPdf: (applicationIds) =>
    ipcRenderer.invoke(IPC.exportApplicationsPdf, applicationIds),
  getPathForFile: (file) => webUtils.getPathForFile(file),
}

contextBridge.exposeInMainWorld('api', api)
