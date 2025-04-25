export function computeScore(similarity: number, saveCount: number, commentCount: number): number {
  const pop = saveCount + commentCount;
  const normPop = Math.min(pop / 1000, 1);
  return 0.6 * normPop + 0.4 * similarity;
}
