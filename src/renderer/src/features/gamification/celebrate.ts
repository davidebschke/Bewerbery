import confetti from 'canvas-confetti'
import type { CelebrationKind } from '../../stores/appStore'

const COLORS = ['#6a47f5', '#ff5f9e', '#16a36a', '#f5b93c']

/** Kurze Konfetti-Animation – respektiert „Bewegung reduzieren“ */
export function celebrate(kind: CelebrationKind): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const particleCount = kind === 'offer' ? 180 : kind === 'level' ? 120 : 90
  void confetti({
    particleCount,
    spread: 75,
    origin: { y: 0.7 },
    colors: COLORS,
    disableForReducedMotion: true,
  })
}
