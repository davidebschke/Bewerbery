/** Verbindet CSS-Klassen und ignoriert leere Werte */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
