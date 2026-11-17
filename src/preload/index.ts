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
  pickImportFile: () => ipcRenderer.invoke(IPC.pickImportFile),
  saveImportTemplate: (format) => ipcRenderer.invoke(IPC.saveImportTemplate, format),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getAiKeyStatus: () => ipcRenderer.invoke(IPC.getAiKeyStatus),
  setAiKey: (apiKey) => ipcRenderer.invoke(IPC.setAiKey, apiKey),
  testAiKey: (apiKey) => ipcRenderer.invoke(IPC.testAiKey, apiKey),
  removeAiKey: () => ipcRenderer.invoke(IPC.removeAiKey),
  pickCvFile: () => ipcRenderer.invoke(IPC.pickCvFile),
  readCvFile: (filePath) => ipcRenderer.invoke(IPC.readCvFile, filePath),
  optimizeCv: (request) => ipcRenderer.invoke(IPC.optimizeCv, request),
  cancelCvOptimization: () => ipcRenderer.invoke(IPC.cancelCvOptimization),
}

contextBridge.exposeInMainWorld('api', api)
