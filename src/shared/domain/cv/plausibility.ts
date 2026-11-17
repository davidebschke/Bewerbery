/** Zahlen inkl. Tausenderpunkten, Dezimalkomma und Prozent, z. B. „1.500“, „2,5“, „30 %“ */
const NUMBER = /\d+(?:[.,]\d+)*(?:\s?%)?/g

function normalizeNumber(raw: string): string {
  const percent = raw.includes('%')
  let value = raw.replace(/\s?%/, '')
  // Tausenderpunkte (1.500.000) entfernen, Dezimalkomma vereinheitlichen
  if (/^\d{1,3}(\.\d{3})+$/.test(value)) value = value.replace(/\./g, '')
  value = value.replace(',', '.')
  return percent ? `${value}%` : value
}

function numbersIn(text: string): Map<string, string> {
  const numbers = new Map<string, string>()
  for (const match of text.matchAll(NUMBER)) {
    const key = normalizeNumber(match[0])
    if (!numbers.has(key)) numbers.set(key, match[0].trim())
  }
  return numbers
}

/**
 * Findet Zahlen (Kennzahlen, Jahreszahlen, Prozente), die in der Variante, aber nicht
 * im Original vorkommen – ein Hinweis auf erfundene Angaben.
 */
export function findInventedNumbers(originalText: string, variantText: string): string[] {
  const original = numbersIn(originalText)
  const originalPlain = new Set([...original.keys()].map((key) => key.replace('%', '')))
  const invented: string[] = []
  for (const [key, raw] of numbersIn(variantText)) {
    if (original.has(key)) continue
    // „30“ im Original deckt „30 %“ nicht ab, umgekehrt aber schon
    if (!key.endsWith('%') && originalPlain.has(key)) continue
    invented.push(raw)
  }
  return invented
}
