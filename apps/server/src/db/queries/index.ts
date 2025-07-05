/**
 * Database Query Functions Index
 *
 * Exports all database query functions for easy importing
 */

// User interaction queries
export {
  getSeenPostsForUser,
  getBlockedUsersForUser,
  getUsersWhoBlockedUser,
  getFollowingForUser,
  getFollowersForUser,
  batchGetUserInteractions,
  addSeenPostLog,
  batchAddSeenPostLogs,
} from './userInteractions.js';

// Privacy filter queries
export {
  filterPostsByPrivacyAndFollowing,
  getVisiblePostsForUser,
  canUserSeePost,
  getPostPrivacyStats,
  batchCheckPostVisibility,
} from './privacyFilters.js';

// Cached query functions
export {
  createCachedQueries,
  CacheInvalidation,
} from './cached.js';

// Monitoring and error reporting
export {
  QueryMonitor,
  QueryAlertSystem,
  createMonitoredQueries,
  monitorQuery,
  getGlobalMonitor,
  resetGlobalMonitor,
  type QueryMetrics,
  type PerformanceStats,
} from './monitoring.js';
