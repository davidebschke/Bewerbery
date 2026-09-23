import type { BewerberyApi } from '@shared/ipc'

/** Zugriff auf die Preload-Bridge (in Tests durch ein Mock ersetzt) */
export function getApi(): BewerberyApi {
  return window.api
}
