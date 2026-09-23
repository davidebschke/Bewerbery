# Code-Stil

- TypeScript strict, kein `any` (stattdessen `unknown` + Zod).
- Prettier: keine Semikolons, Single Quotes, Zeilenbreite 100 (`npm run format`).
- Imports: `@shared/*` für geteilten Code, relative Pfade innerhalb des Renderers.
- Alle UI-Texte, Fehlermeldungen und Kommentare auf **Deutsch**; Bezeichner auf Englisch.
- Styling ausschließlich über Tailwind-Klassen und die Design-Tokens in `styles/globals.css`
  (`bg-surface`, `text-muted`, `border-line`, `bg-brand`, `text-due` …). Keine festen Farben in Komponenten.
- Responsiv denken: mobile-first Klassen (`sm:`, `md:`, `xl:`), Mindestbreite 360 px, kein horizontales Scrollen.
- Barrierefreiheit: jedes Icon-Button bekommt `aria-label`, Dialoge `role="dialog"` + Titel.
- Spielelemente (XP, Konfetti) dezent halten und „Bewegung reduzieren“ respektieren.
