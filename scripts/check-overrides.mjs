// Prüft, ob die Einträge unter `overrides` in package.json noch gebraucht werden.
// Ein Override der Form `paket@>=A <B` ersetzt anfällige Versionen (z. B. wegen einer
// Sicherheitslücke). Sobald kein Paket im Lockfile mehr eine Version in diesem Bereich
// verlangt, ist der Override überflüssig und kann aus package.json entfernt werden.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'))

const parseVersion = (text) => {
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(text.trim())
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null
}

const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

// Grenzen eines einfachen Bereichs (^x.y.z, ~x.y.z, x.y.z); `null` = nicht auswertbar
const rangeBounds = (range) => {
  const text = range.trim()
  const min = parseVersion(text.replace(/^[\^~=v]+/, ''))
  if (!min || /\s|\|\||[<>*x]/i.test(text.replace(/^[\^~=v]+/, ''))) return null
  if (text.startsWith('^')) {
    const max =
      min[0] > 0 ? [min[0] + 1, 0, 0] : min[1] > 0 ? [0, min[1] + 1, 0] : [0, 0, min[2] + 1]
    return { min, max }
  }
  if (text.startsWith('~')) return { min, max: [min[0], min[1] + 1, 0] }
  return { min, max: [min[0], min[1], min[2] + 1] }
}

const overrides = Object.entries(pkg.overrides ?? {})
if (overrides.length === 0) {
  console.log('Keine Overrides in package.json – nichts zu prüfen.')
  process.exit(0)
}

let removable = 0
for (const [key, target] of overrides) {
  const match = /^(@?[^@]+)@>=\s*([\d.]+)\s+<\s*([\d.]+)$/.exec(key)
  if (!match) {
    console.log(`? ${key} → ${target}: Format nicht auswertbar, bitte manuell prüfen.`)
    continue
  }
  const [, name, fromText, toText] = match
  const from = parseVersion(fromText)
  const to = parseVersion(toText)

  // Alle Pakete im Lockfile, die `name` als Abhängigkeit deklarieren
  const users = []
  for (const [path, entry] of Object.entries(lock.packages ?? {})) {
    const range = entry.dependencies?.[name] ?? entry.optionalDependencies?.[name]
    if (!range) continue
    const parent = path === '' ? pkg.name : path.replace(/^.*node_modules\//, '')
    const bounds = rangeBounds(range)
    // Betroffen, wenn sich der deklarierte Bereich mit [from, to) überschneidet
    const affected = bounds ? compare(bounds.max, from) > 0 && compare(bounds.min, to) < 0 : null
    users.push({ parent, range, affected })
  }

  const stillNeeded = users.filter((u) => u.affected !== false)
  console.log(`\n${key} → ${target}`)
  for (const u of users) {
    const state = u.affected === null ? 'unklar' : u.affected ? 'braucht Override' : 'ok'
    console.log(
      `  ${u.affected ? '✗' : u.affected === null ? '?' : '✓'} ${u.parent} verlangt ${u.range} (${state})`,
    )
  }
  if (stillNeeded.length === 0) {
    removable++
    console.log('  → Override wird nicht mehr gebraucht und kann aus package.json entfernt werden.')
  } else {
    console.log(`  → Override noch nötig (${stillNeeded.length} Paket(e)).`)
  }
}

if (removable > 0) {
  console.log(
    '\nNach dem Entfernen: `npm install`, danach `npm audit` und `npm run test:all` prüfen.',
  )
}
