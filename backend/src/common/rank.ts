export const NEXT_REACTION_SLOTS = 4;

export function reactionScore(counts: { likes?: number; comments?: number } | null | undefined): number {
  return (counts?.likes ?? 0) * 2 + (counts?.comments ?? 0) * 3;
}
