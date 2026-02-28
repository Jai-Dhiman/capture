export const STALE_TIMES = {
  FEED: 60_000, // 1 min - feeds need fresh data
  PROFILE: 5 * 60_000, // 5 min - profiles change less often
  STATIC: 30 * 60_000, // 30 min - settings, categories
  MEDIA: 5 * 60_000, // 5 min - media URLs
} as const;
