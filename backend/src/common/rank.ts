export const NEXT_REACTION_SLOTS = 4;
export const FOLLOW_NEW_MS = 7 * 24 * 60 * 60 * 1000;
export const FOLLOW_PRIORITY_CAP = 8;

export function reactionScore(counts: { likes?: number; comments?: number } | null | undefined): number {
  return (counts?.likes ?? 0) * 2 + (counts?.comments ?? 0) * 3;
}
