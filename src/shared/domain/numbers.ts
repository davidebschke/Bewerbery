/** Ganzzahl mit deutschem Tausenderpunkt, z. B. „1.250“ – unabhängig von der System-Locale */
export function formatNumber(value: number): string {
  const sign = value < 0 ? '-' : ''
  const digits = Math.abs(Math.trunc(value)).toString()
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
