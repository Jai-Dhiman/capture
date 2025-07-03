export interface ContentSignals {
  similarity: number;
  engagementRate: number;
  contentType: 'text' | 'image' | 'video' | 'mixed';
  temporalRelevance: number;
  diversityBonus: number;
}

export interface UserContext {
  naturalContentPreferences: Record<string, number>;
  recentTopics: Set<string>;
}

export function computeEnhancedScore(signals: ContentSignals, userContext: UserContext): number {
  const { similarity, engagementRate, contentType, temporalRelevance, diversityBonus } = signals;

  // Revised weights: Similarity: 50%, Engagement: 35%, Content Preference: 10%, Novelty: 5%
  let score = similarity * 0.5;
  score += normalizeEngagement(engagementRate) * 0.35;
  score += getContentTypeAffinity(contentType, userContext) * 0.1;
  score += temporalRelevance * 0.025; // Part of 5% novelty
  score += diversityBonus * 0.025; // Part of 5% novelty

  return Math.min(score, 1.0);
}

export function normalizeEngagement(rawEngagement: number): number {
  return Math.log(rawEngagement + 1) / Math.log(100);
}

export function getContentTypeAffinity(contentType: string, userContext: UserContext): number {
  const preferences = userContext.naturalContentPreferences;
  return preferences[contentType] || 0.5; // Neutral default
}

export function calculateTemporalRelevance(createdAt: string): number {
  const postAge = Date.now() - new Date(createdAt).getTime();
  const hoursAge = postAge / (1000 * 60 * 60);

  if (hoursAge < 6) return 1.0;
  if (hoursAge < 24) return 0.8;
  if (hoursAge < 168) return 0.6;
  if (hoursAge < 720) return 0.3;
  return 0.1;
}

export function calculateEngagementRate(
  saveCount: number,
  commentCount: number,
  createdAt: string,
): number {
  const totalEngagement = (saveCount || 0) + (commentCount || 0);
  const postAge = Date.now() - new Date(createdAt).getTime();
  const hoursAge = Math.max(postAge / (1000 * 60 * 60), 1);

  const ratePerHour = totalEngagement / hoursAge;
  return Math.min(ratePerHour / 10, 1);
}

export function calculateDiversityBonus(
  postTopics: string[],
  userRecentTopics: Set<string>,
): number {
  const hasNewTopic = postTopics.some((topic) => !userRecentTopics.has(topic.toLowerCase()));
  return hasNewTopic ? 1.0 : 0; // Return 1.0 or 0, will be weighted in final score
}

export function extractTopicsFromPost(content: string, hashtags: string[]): string[] {
  const hashtagTopics = hashtags.map((tag) => tag.toLowerCase());
  const contentWords = content
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 10);

  return [...new Set([...hashtagTopics, ...contentWords])];
}
