import { useCallback, useEffect, useRef, useState } from 'react'
import type { AiErrorCode, AiResult } from '@shared/domain/cv/aiErrors'
import { checkJobDescription } from '@shared/domain/cv/limits'
import type { CvOptimizationResult, CvSource } from '@shared/domain/cv/schemas'

import { getApi } from '../../lib/api'
import { useAppStore } from '../../stores/appStore'

export type CvPhase = 'input' | 'consent' | 'running' | 'result' | 'error'

/** Titel für Ergebnis und Dateinamen, z. B. „Frontend-Entwickler · Muster GmbH“ */
function titleOf(position: string, company: string): string {
  return [position.trim(), company.trim()].filter(Boolean).join(' · ')
}

/**
 * Zustand der Ansicht „CV-Optimierung“:
 * Eingabe → (Datenschutzhinweis) → Lauf → Ergebnis bzw. Fehler.
 */
export function useCvOptimization() {
  const applications = useAppStore((s) => s.data.applications)
  const consentAt = useAppStore((s) => s.data.settings.aiConsentAt)
  const updateSettings = useAppStore((s) => s.updateSettings)

  const [keyConfigured, setKeyConfigured] = useState<boolean | null>(null)
  const [source, setSource] = useState<CvSource | null>(null)
  const [sourceError, setSourceError] = useState<AiErrorCode | null>(null)
  const [loadingSource, setLoadingSource] = useState(false)
  const [applicationId, setApplicationId] = useState<string | null>(null)
  const [jobDescription, setJobDescription] = useState('')
  const [phase, setPhase] = useState<CvPhase>('input')
  const [result, setResult] = useState<CvOptimizationResult | null>(null)
  const [error, setError] = useState<AiErrorCode | null>(null)
  const running = useRef(false)

  const loadKeyStatus = useCallback(
    () =>
      getApi()
        .getAiKeyStatus()
        .then((status) => status.configured)
        .catch(() => false),
    [],
  )

  const refreshKey = useCallback(async () => {
    setKeyConfigured(await loadKeyStatus())
  }, [loadKeyStatus])

  useEffect(() => {
    let active = true
    void loadKeyStatus().then((configured) => active && setKeyConfigured(configured))
    // Letztes Ergebnis (auch aus einer früheren Sitzung) direkt anzeigen
    void getApi()
      .getLastCvResult()
      .then((last) => {
        if (!active || !last || running.current) return
        setResult(last)
        setPhase((current) => (current === 'input' ? 'result' : current))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [loadKeyStatus])

  async function applySource(load: () => Promise<AiResult<CvSource> | null>) {
    setLoadingSource(true)
    try {
      const loaded = await load()
      if (!loaded) return
      if (loaded.ok) {
        setSource(loaded.value)
        setSourceError(null)
      } else {
        setSourceError(loaded.error)
      }
    } catch {
      setSourceError('unreadable-file')
    } finally {
      setLoadingSource(false)
    }
  }

  const pickFile = () => applySource(() => getApi().pickCvFile())
  const dropFile = (file: File) =>
    applySource(() => getApi().readCvFile(getApi().getPathForFile(file)))

  function selectApplication(id: string | null) {
    setApplicationId(id)
    const application = applications.find((candidate) => candidate.id === id)
    if (application?.jobDescription) setJobDescription(application.jobDescription)
  }

  const application = applications.find((candidate) => candidate.id === applicationId) ?? null
  const jobCheck = checkJobDescription(jobDescription)
  const canStart = Boolean(keyConfigured && source && jobCheck.ok && phase !== 'running')

  async function run() {
    if (running.current) return
    running.current = true
    setPhase('running')
    setError(null)
    try {
      const outcome = await getApi().optimizeCv({
        jobDescription: jobDescription.trim(),
        applicationId,
        jobTitle: application ? titleOf(application.position, application.company) : '',
      })
      if (outcome.ok) {
        setResult(outcome.value)
        setPhase('result')
      } else if (outcome.error === 'canceled') {
        setPhase('input')
      } else {
        setError(outcome.error)
        setPhase('error')
      }
    } catch {
      setError('server')
      setPhase('error')
    } finally {
      running.current = false
    }
  }

  function start() {
    if (!canStart) return
    if (!consentAt) setPhase('consent')
    else void run()
  }

  function confirmConsent() {
    updateSettings({ aiConsentAt: new Date().toISOString() })
    void run()
  }

  async function discard() {
    try {
      await getApi().clearLastCvResult()
    } finally {
      setResult(null)
      setPhase('input')
    }
  }

  function cancel() {
    void getApi()
      .cancelCvOptimization()
      .catch(() => undefined)
    setPhase('input')
  }

  return {
    keyConfigured,
    refreshKey,
    source,
    sourceError,
    loadingSource,
    pickFile,
    dropFile,
    applications,
    application,
    applicationId,
    selectApplication,
    jobDescription,
    setJobDescription,
    jobCheck,
    phase,
    result,
    error,
    canStart,
    start,
    confirmConsent,
    declineConsent: () => setPhase('input'),
    cancel,
    retry: () => void run(),
    backToInput: () => setPhase('input'),
    discard,
  }
}

export type CvOptimizationState = ReturnType<typeof useCvOptimization>
