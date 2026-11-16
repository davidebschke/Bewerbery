import { describe, expect, it } from 'vitest'
import { detectHeaderRow, matchColumns, IMPORT_FIELDS } from '@shared/domain/import/fields'
import { buildDrafts, draftErrors } from '@shared/domain/import/rows'
import {
  TEMPLATE_EXAMPLE_ROWS,
  TEMPLATE_HEADER,
  templateSheets,
} from '@shared/domain/import/template'
import { detectDateOrder } from '@shared/domain/import/values'

describe('template', () => {
  it('has one column per import field', () => {
    expect(TEMPLATE_HEADER).toHaveLength(IMPORT_FIELDS.length)
    for (const row of TEMPLATE_EXAMPLE_ROWS) expect(row).toHaveLength(IMPORT_FIELDS.length)
  })

  it('imports without manual mapping, warnings or errors', () => {
    const [sheet, hints] = templateSheets()
    expect(hints.name).toBe('Hinweise')
    const headerRow = detectHeaderRow(sheet.rows)
    expect(headerRow).toBe(0)
    const data = sheet.rows.slice(1)
    const mapping = matchColumns(sheet.rows[0], data)
    expect(mapping).toEqual([...IMPORT_FIELDS])
    const order = detectDateOrder(data.flat())
    const drafts = buildDrafts(sheet.rows, { headerRow, mapping, dateOrder: order.order })
    expect(drafts).toHaveLength(TEMPLATE_EXAMPLE_ROWS.length)
    for (const draft of drafts) {
      expect(draft.warnings).toEqual([])
      expect(draftErrors(draft)).toEqual([])
    }
    expect(drafts[1]).toMatchObject({ stage: 'interview', appointmentAt: '2026-10-20T14:00' })
  })
})
