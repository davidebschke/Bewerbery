import type { StageFilter } from '@shared/domain/sorting'

export const FILTERS: { value: StageFilter; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'due', label: 'Fällig' },
  { value: 'applied', label: 'Beworben' },
  { value: 'interview', label: 'Termin' },
  { value: 'offer', label: 'Angebot' },
  { value: 'rejected', label: 'Absage' },
]
