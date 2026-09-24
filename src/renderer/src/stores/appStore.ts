import { create } from 'zustand'
import { toIsoDate } from '@shared/domain/dates'
import { createApplication, createEmptyData } from '@shared/domain/factory'
import { awardXp, stageEvent, type XpEvent } from '@shared/domain/gamification'
import { applicationInputSchema, settingsSchema } from '@shared/schemas'
import type {
  AppData,
  Application,
  ApplicationDocument,
  ApplicationInput,
  Settings,
  Stage,
} from '@shared/types'
import { getApi } from '../lib/api'

export type ToastKind = 'xp' | 'level' | 'info' | 'error'

export interface Toast {
  id: number
  kind: ToastKind
  message: string
}

export type CelebrationKind = 'interview' | 'offer' | 'level'

export interface Celebration {
  id: number
  kind: CelebrationKind
}

export interface AppState {
  status: 'loading' | 'ready' | 'error'
  error: string | null
  data: AppData
  toasts: Toast[]
  celebration: Celebration | null

  hydrate(): Promise<void>
  addApplication(
    input: ApplicationInput,
    id?: string,
    documents?: ApplicationDocument[],
  ): Application
  updateApplication(id: string, input: ApplicationInput, documents?: ApplicationDocument[]): void
  deleteApplication(id: string): Promise<void>
  markFollowedUp(id: string): void
  setStage(id: string, stage: Stage, appointmentAt?: string | null): void
  updateSettings(patch: Partial<Settings>): void
  pushToast(kind: ToastKind, message: string): void
  dismissToast(id: number): void
}

let sequence = 0
const nextId = () => ++sequence

export const initialState = {
  status: 'loading' as const,
  error: null,
  data: createEmptyData(),
  toasts: [] as Toast[],
  celebration: null,
}

const XP_MESSAGES: Record<XpEvent, string> = {
  create: 'Bewerbung angelegt',
  followUp: 'Nachgefasst',
  interview: 'Termin ergattert',
  offer: 'Angebot erhalten',
  rejected: 'Weitermachen lohnt sich',
}

export const useAppStore = create<AppState>()((set, get) => {
  function persist(data: AppData): void {
    set({ data })
    getApi()
      .saveData(data)
      .catch(() => get().pushToast('error', 'Speichern fehlgeschlagen. Bitte erneut versuchen.'))
  }

  /** Vergibt XP, zeigt Toast und löst ggf. Level-Up-Feier aus */
  function reward(data: AppData, event: XpEvent): AppData {
    const result = awardXp(data.progress, event, new Date())
    get().pushToast('xp', `+${result.gained} XP · ${XP_MESSAGES[event]}`)
    if (result.leveledUp) {
      get().pushToast('level', 'Level-Up! 🎉')
      set({ celebration: { id: nextId(), kind: 'level' } })
    }
    return { ...data, progress: result.progress }
  }

  function mapApplication(id: string, update: (app: Application) => Application): AppData {
    const { data } = get()
    return {
      ...data,
      applications: data.applications.map((app) =>
        app.id === id ? { ...update(app), updatedAt: new Date().toISOString() } : app,
      ),
    }
  }

  return {
    ...initialState,

    async hydrate() {
      set({ status: 'loading', error: null })
      try {
        const data = await getApi().loadData()
        set({ data, status: 'ready' })
      } catch (error) {
        set({ status: 'error', error: (error as Error).message })
      }
    },

    addApplication(input, id, documents) {
      const application = createApplication(input, { id, documents })
      let data: AppData = { ...get().data, applications: [...get().data.applications, application] }
      data = reward(data, 'create')
      persist(data)
      return application
    },

    updateApplication(id, input, documents) {
      const parsed = applicationInputSchema.parse(input)
      persist(
        mapApplication(id, (app) => ({ ...app, ...parsed, documents: documents ?? app.documents })),
      )
    },

    async deleteApplication(id) {
      const { data } = get()
      persist({ ...data, applications: data.applications.filter((app) => app.id !== id) })
      await getApi()
        .removeAllDocuments(id)
        .catch(() => undefined)
    },

    markFollowedUp(id) {
      if (!get().data.applications.some((app) => app.id === id)) return
      const data = mapApplication(id, (app) => ({ ...app, lastFollowUpAt: toIsoDate(new Date()) }))
      persist(reward(data, 'followUp'))
    },

    setStage(id, stage, appointmentAt = null) {
      const current = get().data.applications.find((app) => app.id === id)
      if (!current) return
      const event = stageEvent(current, stage)
      let data = mapApplication(id, (app) => ({
        ...app,
        stage,
        appointmentAt: stage === 'interview' ? appointmentAt : app.appointmentAt,
        awardedStages: event ? [...app.awardedStages, stage] : app.awardedStages,
      }))
      if (event) {
        data = reward(data, event)
        if (event === 'interview' || event === 'offer') {
          set({ celebration: { id: nextId(), kind: event } })
        }
      }
      persist(data)
    },

    updateSettings(patch) {
      const { data } = get()
      persist({ ...data, settings: settingsSchema.parse({ ...data.settings, ...patch }) })
    },

    pushToast(kind, message) {
      set((state) => ({ toasts: [...state.toasts, { id: nextId(), kind, message }] }))
    },

    dismissToast(id) {
      set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
    },
  }
})
