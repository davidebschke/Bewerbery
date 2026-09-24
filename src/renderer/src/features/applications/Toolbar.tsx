import { Search } from 'lucide-react'
import type { StageFilter } from '@shared/domain/sorting'
import { cn } from '../../lib/cn'
import { FILTERS } from './filters'

export interface ToolbarProps {
  search: string
  onSearch(value: string): void
  filter: StageFilter
  onFilter(value: StageFilter): void
}

export function Toolbar({ search, onSearch, filter, onFilter }: ToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <label className="relative block w-full md:max-w-xs">
        <span className="sr-only">Bewerbungen durchsuchen</span>
        <Search
          size={16}
          aria-hidden="true"
          className="absolute top-1/2 left-3 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Unternehmen, Position, Kontakt …"
          className="h-10 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-sm focus:border-brand focus:outline-none"
        />
      </label>
      <div
        role="group"
        aria-label="Nach Status filtern"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
      >
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => onFilter(value)}
            className={cn(
              'h-8 shrink-0 rounded-full px-3 text-xs font-semibold transition',
              filter === value ? 'bg-fg text-bg' : 'bg-surface text-muted hover:text-fg',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
