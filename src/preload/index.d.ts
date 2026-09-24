import type { BewerberyApi } from '../shared/ipc'

declare global {
  interface Window {
    api: BewerberyApi
  }
}

export {}
