// Standard Elo maths.

/** Expected score of A against B (0..1). A 400-point edge ≈ 10:1 odds. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/**
 * Rating change for A after a match against B.
 * score: 1 = A won, 0.5 = draw, 0 = A lost. B's change is the exact negative.
 */
export function eloDelta(ratingA: number, ratingB: number, score: number, k: number): number {
  return k * (score - expectedScore(ratingA, ratingB));
}
