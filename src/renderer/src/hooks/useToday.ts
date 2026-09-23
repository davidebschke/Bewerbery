import { useEffect, useState } from 'react'

export const TODAY_REFRESH_MS = 60_000

/** Aktuelles Datum, das sich jede Minute aktualisiert (z. B. über Mitternacht) */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), TODAY_REFRESH_MS)
    return () => clearInterval(timer)
  }, [])
  return today
}
