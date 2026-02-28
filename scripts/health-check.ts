import * as fs from 'node:fs';
import * as readline from 'node:readline';

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = 'https://capture-api.jai-d.workers.dev';
const AUTH_EMAIL = 'jaidhiman2000@gmail.com';

// ── Types ───────────────────────────────────────────────────────────────────
interface TestResult {
  endpoint: string;
  method: string;
  statusCode: number | null;
  latency: number;
  pass: boolean;
  error?: string;
  responseSnippet?: string;
}

interface TestGroup {
  name: string;
  tests: Array<{
    name: string;
    method: string;
    path: string;
    auth: boolean;
    body?: unknown;
    headers?: Record<string, string>;
    expectedStatus?: number | number[];
    routingOnly?: boolean;
    skip?: boolean;
    skipReason?: string;
    setup?: () => Promise<void>;
    cleanup?: () => Promise<void>;
  }>;
}

// ── State ───────────────────────────────────────────────────────────────────
let accessToken = '';
let refreshToken = '';
let userId = '';
let profileId = '';

// IDs captured during lifecycle tests
let testPostId = '';
let testCommentId = '';
let testHashtagId = '';
let testDraftId = '';
let testPublishedDraftPostId = '';
let testNotificationId = '';

// ── Helpers ─────────────────────────────────────────────────────────────────
function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function request(
  method: string,
  path: string,
  opts: {
    body?: unknown;
    auth?: boolean;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; data: any; latency: number }> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.headers,
  };
  if (opts.auth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const fetchOpts: RequestInit = { method, headers };
  if (opts.body) {
    fetchOpts.body = JSON.stringify(opts.body);
  }

  const start = performance.now();
  const res = await fetch(url, fetchOpts);
  const latency = Math.round(performance.now() - start);

  let data: any;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, latency };
}

function snippet(data: any): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return str.length > 200 ? str.slice(0, 200) + '...' : str;
}

function gql(query: string, variables?: Record<string, unknown>) {
  return { query, variables };
}

// ── Auth Flow ───────────────────────────────────────────────────────────────
async function authenticate(): Promise<void> {
  console.log('\n--- Authentication ---');

  // Check if token was passed directly (--token <jwt>)
  const tokenArgIdx = process.argv.indexOf('--token');
  if (tokenArgIdx !== -1 && process.argv[tokenArgIdx + 1]) {
    accessToken = process.argv[tokenArgIdx + 1];
    console.log('Using token from CLI argument.');
    const meRes = await request('GET', '/auth/me', { auth: true });
    if (meRes.status === 200) {
      userId = meRes.data.id || meRes.data.userId || '';
      profileId = meRes.data.profileId || meRes.data.profile?.id || '';
      console.log(`Authenticated as user: ${userId}, profile: ${profileId}`);
    }
    return;
  }

  // Check if code was passed as CLI arg (--code 123456)
  const codeArgIdx = process.argv.indexOf('--code');
  let code: string;

  if (codeArgIdx !== -1 && process.argv[codeArgIdx + 1]) {
    code = process.argv[codeArgIdx + 1];
    console.log(`Using code from CLI argument.`);
  } else {
    console.log(`Sending code to ${AUTH_EMAIL}...`);
    const sendRes = await request('POST', '/auth/send-code', {
      body: { email: AUTH_EMAIL },
    });

    if (sendRes.status !== 200) {
      throw new Error(`Failed to send code: ${sendRes.status} ${JSON.stringify(sendRes.data)}`);
    }
    console.log('Code sent successfully.');
    code = await prompt('Enter the 6-digit code from your email: ');
  }

  const verifyRes = await request('POST', '/auth/verify-code', {
    body: { email: AUTH_EMAIL, code },
  });

  if (verifyRes.status !== 200) {
    throw new Error(`Failed to verify code: ${verifyRes.status} ${JSON.stringify(verifyRes.data)}`);
  }

  // Token lives at data.session.access_token or data.access_token
  const session = verifyRes.data.session || verifyRes.data;
  accessToken = session.access_token || session.accessToken;
  refreshToken = session.refresh_token || session.refreshToken;

  if (!accessToken) {
    console.error('verify-code response:', JSON.stringify(verifyRes.data).slice(0, 500));
    throw new Error('No access token returned from verify-code');
  }

  // Extract user ID from verify response
  userId = verifyRes.data.user?.id || '';

  // Get user info
  const meRes = await request('GET', '/auth/me', { auth: true });
  if (meRes.status === 200) {
    userId = meRes.data.id || meRes.data.userId || meRes.data.user?.id || userId;
    profileId = meRes.data.profileId || meRes.data.profile?.id || '';
    console.log(`Authenticated as user: ${userId}, profile: ${profileId}`);
  } else {
    console.log(`Warning: /auth/me returned ${meRes.status}, using userId from verify: ${userId}`);
  }
}

// ── Test Groups ─────────────────────────────────────────────────────────────

function buildTestGroups(): TestGroup[] {
  return [
    // ── PUBLIC ENDPOINTS ──────────────────────────────────────────────────
    {
      name: 'Public Endpoints',
      tests: [
        { name: 'Health check', method: 'GET', path: '/', auth: false },
        { name: 'Version', method: 'GET', path: '/version', auth: false },
        {
          name: 'AASA',
          method: 'GET',
          path: '/.well-known/apple-app-site-association',
          auth: false,
        },
        {
          name: 'Analytics: overview',
          method: 'GET',
          path: '/api/analytics/overview',
          auth: false,
        },
        {
          name: 'Analytics: user-growth',
          method: 'GET',
          path: '/api/analytics/user-growth',
          auth: false,
        },
        {
          name: 'Analytics: content-activity',
          method: 'GET',
          path: '/api/analytics/content-activity',
          auth: false,
        },
        {
          name: 'Analytics: top-users',
          method: 'GET',
          path: '/api/analytics/top-users',
          auth: false,
        },
        {
          name: 'Analytics: recent-activity',
          method: 'GET',
          path: '/api/analytics/recent-activity',
          auth: false,
        },
        {
          name: 'Profile: check-username',
          method: 'GET',
          path: '/api/profile/check-username?username=__health_check_test__',
          auth: true,
        },
      ],
    },

    // ── AUTH ENDPOINTS ────────────────────────────────────────────────────
    {
      name: 'Auth Endpoints',
      tests: [
        { name: 'Auth: me', method: 'GET', path: '/auth/me', auth: true },
        {
          name: 'Auth: refresh',
          method: 'POST',
          path: '/auth/refresh',
          auth: false,
          body: { refresh_token: 'will-use-actual' },
          // We'll override this in the runner
        },
        {
          name: 'Auth: passkey list',
          method: 'GET',
          path: '/auth/passkey/list',
          auth: true,
        },
        {
          name: 'Auth: passkey check',
          method: 'POST',
          path: '/auth/passkey/check',
          auth: false,
          body: { email: AUTH_EMAIL },
        },
        {
          name: 'Auth: register-device (no token)',
          method: 'POST',
          path: '/auth/register-device',
          auth: true,
          body: { token: 'health-check-test-token', platform: 'ios' },
        },
        {
          name: 'Auth: unregister-device',
          method: 'POST',
          path: '/auth/unregister-device',
          auth: true,
          body: { token: 'health-check-test-token' },
        },
      ],
    },

    // ── MEDIA ENDPOINTS ──────────────────────────────────────────────────
    {
      name: 'Media Endpoints',
      tests: [
        {
          name: 'Media: get upload URL',
          method: 'POST',
          path: '/api/media/image-upload',
          auth: true,
          body: {},
        },
        {
          name: 'Media: batch upload URLs',
          method: 'POST',
          path: '/api/media/batch-upload',
          auth: true,
          body: { count: 2 },
        },
        {
          name: 'Media: list deleted',
          method: 'GET',
          path: '/api/media/deleted',
          auth: true,
        },
        {
          name: 'Media: processor status',
          method: 'GET',
          path: '/api/media/processor-status',
          auth: true,
        },
        {
          name: 'Media: cleanup status',
          method: 'GET',
          path: '/api/media/cleanup-status',
          auth: true,
        },
      ],
    },

    // ── CACHE ENDPOINTS ──────────────────────────────────────────────────
    {
      name: 'Cache Endpoints',
      tests: [
        {
          name: 'Cache: stats',
          method: 'GET',
          path: '/api/cache/stats',
          auth: true,
        },
        {
          name: 'Cache: health',
          method: 'GET',
          path: '/api/cache/health',
          auth: true,
        },
        {
          name: 'Cache: keys (discovery)',
          method: 'GET',
          path: () => `/api/cache/keys/discovery?id=${userId}`,
          auth: true,
        },
        {
          name: 'Cache: operations (get)',
          method: 'POST',
          path: '/api/cache/operations',
          auth: true,
          body: { operation: 'get', key: 'health_check_probe' },
        },
      ],
    },

    // ── INTERESTS ────────────────────────────────────────────────────────
    {
      name: 'Interests',
      tests: [
        {
          name: 'Interests: get',
          method: 'GET',
          path: '/api/interests',
          auth: true,
        },
      ],
    },

    // ── GRAPHQL QUERIES ──────────────────────────────────────────────────
    {
      name: 'GraphQL Queries',
      tests: [
        {
          name: 'GQL: profile',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`query { profile(id: "${profileId || userId}") { id username } }`),
        },
        {
          name: 'GQL: discoverFeed',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { discoverFeed(limit: 3) { posts { id content } hasMore nextCursor } }`),
        },
        {
          name: 'GQL: followingFeed',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(
            `query { followingFeed(limit: 3) { posts { id content } hasMore nextCursor } }`,
          ),
        },
        {
          name: 'GQL: savedPosts',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { savedPosts(limit: 3) { id content } }`),
        },
        {
          name: 'GQL: likedPosts',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { likedPosts(limit: 3) { id content } }`),
        },
        {
          name: 'GQL: followers',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`query { followers(userId: "${userId}") { id username } }`),
        },
        {
          name: 'GQL: following',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`query { following(userId: "${userId}") { id username } }`),
        },
        {
          name: 'GQL: blockedUsers',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { blockedUsers { id username } }`),
        },
        {
          name: 'GQL: searchUsers',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { searchUsers(query: "test") { id username } }`),
        },
        {
          name: 'GQL: searchHashtags',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { searchHashtags(query: "test", limit: 3) { id name } }`),
        },
        {
          name: 'GQL: notifications',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { notifications(limit: 5) { id type message isRead createdAt } }`),
        },
        {
          name: 'GQL: unreadNotificationCount',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { unreadNotificationCount }`),
        },
        {
          name: 'GQL: notificationSettings',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { notificationSettings { id enablePush likes comments follows } }`),
        },
        {
          name: 'GQL: draftPosts',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { draftPosts(limit: 3) { id content } }`),
        },
        {
          name: 'GQL: discoveryAnalytics',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () =>
            gql(
              `query { discoveryAnalytics(userId: "${userId}", limit: 3) { sessionLogs { sessionId phase processingTimeMs } seenPostsAnalytics { averageSeenPostsPerUser } } }`,
            ),
        },
        {
          name: 'GQL: discoveryPerformanceSummary',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(
            `query { discoveryPerformanceSummary { totalSessions averageProcessingTime averageResults errorRate } }`,
          ),
        },
        {
          name: 'GQL: feedbackCategories',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { feedbackCategories { id name description isActive } }`),
        },
        {
          name: 'GQL: myTickets',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`query { myTickets(limit: 3) { id subject status priority } }`),
        },
        // -- Mobile coverage: commentConnection --
        {
          name: 'GQL: commentConnection',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () =>
            gql(
              `query { commentConnection(postId: "${testPostId || '00000000-0000-0000-0000-000000000000'}", limit: 3) { comments { id content } totalCount hasNextPage } }`,
            ),
        },
        // -- Mobile coverage: commentConnection with parentId (reply check) --
        {
          name: 'GQL: commentConnection (replies)',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () =>
            gql(
              `query { commentConnection(postId: "${testPostId || '00000000-0000-0000-0000-000000000000'}", parentId: "00000000-0000-0000-0000-000000000000", limit: 3) { comments { id content } totalCount hasNextPage } }`,
            ),
        },
        // -- Mobile coverage: ticket(id) --
        {
          name: 'GQL: ticket',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(
            `query { ticket(id: "00000000-0000-0000-0000-000000000000") { id subject status } }`,
          ),
          expectedStatus: 200,
        },
        // -- Mobile coverage: profile with posts subfield --
        {
          name: 'GQL: profile (with posts)',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () =>
            gql(
              `query { profile(id: "${profileId || userId}") { id username posts { id content } } }`,
            ),
        },
      ],
    },

    // ── GRAPHQL MUTATIONS (Lifecycle Tests) ──────────────────────────────
    {
      name: 'GraphQL Mutations (Lifecycle)',
      tests: [
        // 1. Create hashtag
        {
          name: 'GQL: createHashtag',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`mutation { createHashtag(name: "healthcheck${Date.now()}") { id name } }`),
        },
        // 2. Create post
        {
          name: 'GQL: createPost',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(
            `mutation { createPost(input: { content: "Health check test post ${Date.now()}", type: post }) { id content } }`,
          ),
        },
        // 3. Update post
        {
          name: 'GQL: updatePost',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () =>
            gql(
              `mutation { updatePost(id: "${testPostId}", input: { content: "Health check updated ${Date.now()}", type: post }) { id content } }`,
            ),
        },
        // 4. Save draft post
        {
          name: 'GQL: saveDraftPost',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(
            `mutation { saveDraftPost(input: { content: "Health check draft ${Date.now()}", type: post }) { id content } }`,
          ),
        },
        // 5. Delete draft post
        {
          name: 'GQL: deleteDraftPost',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { deleteDraftPost(id: "${testDraftId}") { id success } }`),
        },
        // 6. Save another draft for publishing
        {
          name: 'GQL: saveDraftPost (for publish)',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(
            `mutation { saveDraftPost(input: { content: "Health check draft to publish ${Date.now()}", type: post }) { id content } }`,
          ),
        },
        // 7. Publish draft post
        {
          name: 'GQL: publishDraftPost',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { publishDraftPost(id: "${testDraftId}") { id content } }`),
        },
        // 8. Create comment (uses testPostId)
        {
          name: 'GQL: createComment',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () =>
            gql(
              `mutation { createComment(input: { postId: "${testPostId}", content: "Health check test comment" }) { id content } }`,
            ),
        },
        // 9. commentConnection query (verify comments load)
        {
          name: 'GQL: commentConnection (lifecycle)',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () =>
            gql(
              `query { commentConnection(postId: "${testPostId}", limit: 5) { comments { id content } totalCount hasNextPage } }`,
            ),
        },
        // 10. Like post
        {
          name: 'GQL: likePost',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () =>
            gql(
              `mutation { likePost(postId: "${testPostId}") { success post { id _likeCount } } }`,
            ),
        },
        // 11. Mark posts as seen
        {
          name: 'GQL: markPostsAsSeen',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { markPostsAsSeen(postIds: ["${testPostId}"]) { success } }`),
        },
        // 12. Unlike post
        {
          name: 'GQL: unlikePost',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { unlikePost(postId: "${testPostId}") { success } }`),
        },
        // 13. Save post
        {
          name: 'GQL: savePost',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { savePost(postId: "${testPostId}") { success } }`),
        },
        // 14. Unsave post
        {
          name: 'GQL: unsavePost',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { unsavePost(postId: "${testPostId}") { success } }`),
        },
        // 15. Update profile (update bio, then revert)
        {
          name: 'GQL: updateProfile',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(
            `mutation { updateProfile(input: { bio: "Health check test bio ${Date.now()}" }) { id bio } }`,
          ),
        },
        // 16. Follow user (self-follow, expect error)
        {
          name: 'GQL: followUser',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { followUser(userId: "${userId}") { success } }`),
          expectedStatus: 200,
        },
        // 17. Unfollow user (self-unfollow, expect error)
        {
          name: 'GQL: unfollowUser',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { unfollowUser(userId: "${userId}") { success } }`),
          expectedStatus: 200,
        },
        // 18. Block user (self-block, expect error -- validates routing)
        {
          name: 'GQL: blockUser',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { blockUser(userId: "${userId}") { success } }`),
          expectedStatus: 200,
        },
        // 19. Unblock user
        {
          name: 'GQL: unblockUser',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { unblockUser(userId: "${userId}") { success } }`),
          expectedStatus: 200,
        },
        // 20. Mark notification read (if notification exists)
        {
          name: 'GQL: markNotificationRead',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () =>
            gql(
              `mutation { markNotificationRead(id: "${testNotificationId || '00000000-0000-0000-0000-000000000000'}") { success } }`,
            ),
          expectedStatus: 200,
        },
        // 21. Mark all notifications read
        {
          name: 'GQL: markAllNotificationsRead',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(`mutation { markAllNotificationsRead { success count } }`),
        },
        // 22. Update notification settings (toggle then revert)
        {
          name: 'GQL: updateNotificationSettings',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(
            `mutation { updateNotificationSettings(input: { likes: false }) { id enablePush likes comments follows } }`,
          ),
        },
        // 22b. Revert notification settings
        {
          name: 'GQL: updateNotificationSettings (revert)',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: gql(
            `mutation { updateNotificationSettings(input: { likes: true }) { id enablePush likes comments follows } }`,
          ),
        },
        // 23. Delete comment (uses testCommentId)
        {
          name: 'GQL: deleteComment',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { deleteComment(id: "${testCommentId}") { id success } }`),
        },
        // 24. Delete post (uses testPostId)
        {
          name: 'GQL: deletePost',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`mutation { deletePost(id: "${testPostId}") { id success } }`),
        },
        // 25. Delete published draft post (cleanup)
        {
          name: 'GQL: deletePost (published draft)',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () =>
            gql(`mutation { deletePost(id: "${testPublishedDraftPostId}") { id success } }`),
        },
        // 26. Query post to verify deletion
        {
          name: 'GQL: post (single)',
          method: 'POST',
          path: '/graphql',
          auth: true,
          body: () => gql(`query { post(id: "${testPostId}") { id content } }`),
        },
      ],
    },

    // ── REST ENDPOINTS (Mobile Coverage) ──────────────────────────────────
    {
      name: 'REST Endpoints (Mobile Coverage)',
      tests: [
        // Auth: logout
        {
          name: 'REST: POST /auth/logout',
          method: 'POST',
          path: '/auth/logout',
          auth: true,
          body: {},
          routingOnly: true,
        },
        // OAuth: Google
        {
          name: 'REST: POST /auth/oauth/google/token',
          method: 'POST',
          path: '/auth/oauth/google/token',
          auth: false,
          body: { idToken: 'health-check-dummy-token' },
          routingOnly: true,
        },
        // OAuth: Apple
        {
          name: 'REST: POST /auth/oauth/apple',
          method: 'POST',
          path: '/auth/oauth/apple',
          auth: false,
          body: { code: 'health-check-dummy', identityToken: 'health-check-dummy' },
          routingOnly: true,
        },
        // Passkey: register begin
        {
          name: 'REST: POST /auth/passkey/register/begin',
          method: 'POST',
          path: '/auth/passkey/register/begin',
          auth: true,
          body: {},
          routingOnly: true,
        },
        // Passkey: authenticate begin
        {
          name: 'REST: POST /auth/passkey/authenticate/begin',
          method: 'POST',
          path: '/auth/passkey/authenticate/begin',
          auth: false,
          body: { email: AUTH_EMAIL },
          routingOnly: true,
        },
        // Passkey: delete
        {
          name: 'REST: DELETE /auth/passkey/:passkeyId',
          method: 'DELETE',
          path: '/auth/passkey/00000000-0000-0000-0000-000000000000',
          auth: true,
          routingOnly: true,
        },
        // TOTP: setup begin
        {
          name: 'REST: POST /auth/totp/setup/begin',
          method: 'POST',
          path: '/auth/totp/setup/begin',
          auth: true,
          body: {},
          routingOnly: true,
        },
        // TOTP: setup complete
        {
          name: 'REST: POST /auth/totp/setup/complete',
          method: 'POST',
          path: '/auth/totp/setup/complete',
          auth: true,
          body: { token: '000000' },
          routingOnly: true,
        },
        // TOTP: verify
        {
          name: 'REST: POST /auth/totp/verify',
          method: 'POST',
          path: '/auth/totp/verify',
          auth: true,
          body: { token: '000000' },
          routingOnly: true,
        },
        // TOTP: disable
        {
          name: 'REST: DELETE /auth/totp/disable',
          method: 'DELETE',
          path: '/auth/totp/disable',
          auth: true,
          body: { token: '000000' },
          routingOnly: true,
        },
        // Media: image-record
        {
          name: 'REST: POST /api/media/image-record',
          method: 'POST',
          path: '/api/media/image-record',
          auth: true,
          body: { imageId: 'health-check-dummy' },
          routingOnly: true,
        },
        // Media: delete
        {
          name: 'REST: DELETE /api/media/:mediaId',
          method: 'DELETE',
          path: '/api/media/00000000-0000-0000-0000-000000000000',
          auth: true,
          routingOnly: true,
        },
        // Media: restore
        {
          name: 'REST: POST /api/media/restore/:mediaId',
          method: 'POST',
          path: '/api/media/restore/00000000-0000-0000-0000-000000000000',
          auth: true,
          routingOnly: true,
        },
        // Media: get URL
        {
          name: 'REST: GET /api/media/:mediaId/url',
          method: 'GET',
          path: '/api/media/00000000-0000-0000-0000-000000000000/url',
          auth: true,
          routingOnly: true,
        },
        // CDN: get media
        {
          name: 'REST: GET /cdn/:mediaId',
          method: 'GET',
          path: '/cdn/00000000-0000-0000-0000-000000000000',
          auth: false,
          routingOnly: true,
        },
        // Media: Cloudflare URL
        {
          name: 'REST: GET /api/media/cloudflare-url/:cloudflareId',
          method: 'GET',
          path: '/api/media/cloudflare-url/health-check-dummy',
          auth: true,
          routingOnly: true,
        },
        // Profile: create
        {
          name: 'REST: POST /api/profile',
          method: 'POST',
          path: '/api/profile',
          auth: true,
          body: { userId: 'health-check-dummy', username: '__hc_routing_test__' },
          routingOnly: true,
        },
      ],
    },
  ];
}

// ── Test Runner ─────────────────────────────────────────────────────────────

async function runTest(test: TestGroup['tests'][0]): Promise<TestResult> {
  const path = typeof test.path === 'function' ? (test.path as () => string)() : test.path;
  const body = typeof test.body === 'function' ? (test.body as () => unknown)() : test.body;

  // Special override for refresh token test
  let actualBody = body;
  if (test.name === 'Auth: refresh' && refreshToken) {
    actualBody = { refresh_token: refreshToken };
  }

  const expectedStatuses = test.expectedStatus
    ? Array.isArray(test.expectedStatus)
      ? test.expectedStatus
      : [test.expectedStatus]
    : [200, 201];

  try {
    const res = await request(test.method, path, {
      body: actualBody,
      auth: test.auth,
      headers: test.headers,
    });

    // routingOnly: any non-5xx response counts as PASS
    const pass = test.routingOnly ? res.status < 500 : expectedStatuses.includes(res.status);

    // Capture IDs from lifecycle mutations
    if (test.name === 'GQL: createPost' && res.data?.data?.createPost?.id) {
      testPostId = res.data.data.createPost.id;
    }
    if (test.name === 'GQL: createComment' && res.data?.data?.createComment?.id) {
      testCommentId = res.data.data.createComment.id;
    }
    if (test.name === 'GQL: createHashtag' && res.data?.data?.createHashtag?.id) {
      testHashtagId = res.data.data.createHashtag.id;
    }
    if (test.name === 'GQL: saveDraftPost' && res.data?.data?.saveDraftPost?.id) {
      testDraftId = res.data.data.saveDraftPost.id;
    }
    if (test.name === 'GQL: saveDraftPost (for publish)' && res.data?.data?.saveDraftPost?.id) {
      testDraftId = res.data.data.saveDraftPost.id;
    }
    if (test.name === 'GQL: publishDraftPost' && res.data?.data?.publishDraftPost?.id) {
      testPublishedDraftPostId = res.data.data.publishDraftPost.id;
    }
    // Capture a notification ID from the notifications query for markNotificationRead
    if (test.name === 'GQL: notifications' && res.data?.data?.notifications?.[0]?.id) {
      testNotificationId = res.data.data.notifications[0].id;
    }

    // Check for GraphQL errors
    const hasGqlErrors =
      res.data?.errors && Array.isArray(res.data.errors) && res.data.errors.length > 0;

    return {
      endpoint: `${test.method} ${path}`,
      method: test.method,
      statusCode: res.status,
      latency: res.latency,
      pass: pass && !hasGqlErrors,
      error: hasGqlErrors ? res.data.errors.map((e: any) => e.message).join('; ') : undefined,
      responseSnippet: snippet(res.data),
    };
  } catch (err) {
    return {
      endpoint: `${test.method} ${path}`,
      method: test.method,
      statusCode: null,
      latency: 0,
      pass: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ── Hook-Endpoint Map ────────────────────────────────────────────────────────

type Priority = 'P0' | 'P1' | 'P2' | 'P3';

interface HookEndpointEntry {
  hook: string;
  file: string;
  type: 'graphql' | 'rest';
  operation: string;
  testName: string;
  priority: Priority;
}

const HOOK_ENDPOINT_MAP: HookEndpointEntry[] = [
  // P0: Auth
  {
    hook: 'useAuth.sendCode',
    file: 'features/auth/hooks/useAuth.ts',
    type: 'rest',
    operation: 'POST /auth/send-code',
    testName: 'Health check',
    priority: 'P0',
  },
  {
    hook: 'useAuth.verifyCode',
    file: 'features/auth/hooks/useAuth.ts',
    type: 'rest',
    operation: 'POST /auth/verify-code',
    testName: 'Health check',
    priority: 'P0',
  },
  {
    hook: 'useAuth.me',
    file: 'features/auth/hooks/useAuth.ts',
    type: 'rest',
    operation: 'GET /auth/me',
    testName: 'Auth: me',
    priority: 'P0',
  },
  {
    hook: 'useAuth.refresh',
    file: 'features/auth/hooks/useAuth.ts',
    type: 'rest',
    operation: 'POST /auth/refresh',
    testName: 'Auth: refresh',
    priority: 'P0',
  },
  {
    hook: 'useAuth.logout',
    file: 'features/auth/hooks/useAuth.ts',
    type: 'rest',
    operation: 'POST /auth/logout',
    testName: 'REST: POST /auth/logout',
    priority: 'P0',
  },
  {
    hook: 'useOAuth (google)',
    file: 'features/auth/hooks/useOAuth.ts',
    type: 'rest',
    operation: 'POST /auth/oauth/google/token',
    testName: 'REST: POST /auth/oauth/google/token',
    priority: 'P0',
  },
  {
    hook: 'useOAuth (apple)',
    file: 'features/auth/hooks/useOAuth.ts',
    type: 'rest',
    operation: 'POST /auth/oauth/apple',
    testName: 'REST: POST /auth/oauth/apple',
    priority: 'P0',
  },
  {
    hook: 'usePasskey (register begin)',
    file: 'features/auth/hooks/usePasskey.ts',
    type: 'rest',
    operation: 'POST /auth/passkey/register/begin',
    testName: 'REST: POST /auth/passkey/register/begin',
    priority: 'P0',
  },
  {
    hook: 'usePasskey (auth begin)',
    file: 'features/auth/hooks/usePasskey.ts',
    type: 'rest',
    operation: 'POST /auth/passkey/authenticate/begin',
    testName: 'REST: POST /auth/passkey/authenticate/begin',
    priority: 'P0',
  },
  {
    hook: 'usePasskey (check)',
    file: 'features/auth/hooks/usePasskey.ts',
    type: 'rest',
    operation: 'POST /auth/passkey/check',
    testName: 'Auth: passkey check',
    priority: 'P0',
  },
  {
    hook: 'usePasskey (list)',
    file: 'features/auth/hooks/usePasskey.ts',
    type: 'rest',
    operation: 'GET /auth/passkey/list',
    testName: 'Auth: passkey list',
    priority: 'P0',
  },
  {
    hook: 'usePasskey (delete)',
    file: 'features/auth/hooks/usePasskey.ts',
    type: 'rest',
    operation: 'DELETE /auth/passkey/:passkeyId',
    testName: 'REST: DELETE /auth/passkey/:passkeyId',
    priority: 'P0',
  },
  {
    hook: 'useRegisterDevice',
    file: 'features/auth/hooks/useRegisterDevice.ts',
    type: 'rest',
    operation: 'POST /auth/register-device',
    testName: 'Auth: register-device (no token)',
    priority: 'P0',
  },
  {
    hook: 'useUnregisterDevice',
    file: 'features/auth/hooks/useRegisterDevice.ts',
    type: 'rest',
    operation: 'POST /auth/unregister-device',
    testName: 'Auth: unregister-device',
    priority: 'P0',
  },
  {
    hook: 'useTOTP (setup begin)',
    file: 'features/auth/hooks/useTOTP.ts',
    type: 'rest',
    operation: 'POST /auth/totp/setup/begin',
    testName: 'REST: POST /auth/totp/setup/begin',
    priority: 'P0',
  },
  {
    hook: 'useTOTP (setup complete)',
    file: 'features/auth/hooks/useTOTP.ts',
    type: 'rest',
    operation: 'POST /auth/totp/setup/complete',
    testName: 'REST: POST /auth/totp/setup/complete',
    priority: 'P0',
  },
  {
    hook: 'useTOTP (verify)',
    file: 'features/auth/hooks/useTOTP.ts',
    type: 'rest',
    operation: 'POST /auth/totp/verify',
    testName: 'REST: POST /auth/totp/verify',
    priority: 'P0',
  },
  {
    hook: 'useTOTP (disable)',
    file: 'features/auth/hooks/useTOTP.ts',
    type: 'rest',
    operation: 'DELETE /auth/totp/disable',
    testName: 'REST: DELETE /auth/totp/disable',
    priority: 'P0',
  },

  // P1: Core features (posts, comments, feed, media, profile)
  {
    hook: 'useCreatePost',
    file: 'features/post/hooks/usePosts.ts',
    type: 'graphql',
    operation: 'createPost',
    testName: 'GQL: createPost',
    priority: 'P1',
  },
  {
    hook: 'useUpdatePost',
    file: 'features/post/hooks/usePosts.ts',
    type: 'graphql',
    operation: 'updatePost',
    testName: 'GQL: updatePost',
    priority: 'P1',
  },
  {
    hook: 'useDeletePost',
    file: 'features/post/hooks/usePosts.ts',
    type: 'graphql',
    operation: 'deletePost',
    testName: 'GQL: deletePost',
    priority: 'P1',
  },
  {
    hook: 'useSaveDraft',
    file: 'features/post/hooks/useDraftPosts.ts',
    type: 'graphql',
    operation: 'saveDraftPost',
    testName: 'GQL: saveDraftPost',
    priority: 'P1',
  },
  {
    hook: 'usePublishDraft',
    file: 'features/post/hooks/useDraftPosts.ts',
    type: 'graphql',
    operation: 'publishDraftPost',
    testName: 'GQL: publishDraftPost',
    priority: 'P1',
  },
  {
    hook: 'useDeleteDraft',
    file: 'features/post/hooks/useDraftPosts.ts',
    type: 'graphql',
    operation: 'deleteDraftPost',
    testName: 'GQL: deleteDraftPost',
    priority: 'P1',
  },
  {
    hook: 'useDraftPosts',
    file: 'features/post/hooks/useDraftPosts.ts',
    type: 'graphql',
    operation: 'draftPosts',
    testName: 'GQL: draftPosts',
    priority: 'P1',
  },
  {
    hook: 'useDiscoverFeed',
    file: 'features/feed/hooks/useFeed.ts',
    type: 'graphql',
    operation: 'discoverFeed',
    testName: 'GQL: discoverFeed',
    priority: 'P1',
  },
  {
    hook: 'useFollowingFeed',
    file: 'features/feed/hooks/useFeed.ts',
    type: 'graphql',
    operation: 'followingFeed',
    testName: 'GQL: followingFeed',
    priority: 'P1',
  },
  {
    hook: 'useCreateComment',
    file: 'features/comments/hooks/useComments.ts',
    type: 'graphql',
    operation: 'createComment',
    testName: 'GQL: createComment',
    priority: 'P1',
  },
  {
    hook: 'useDeleteComment',
    file: 'features/comments/hooks/useComments.ts',
    type: 'graphql',
    operation: 'deleteComment',
    testName: 'GQL: deleteComment',
    priority: 'P1',
  },
  {
    hook: 'commentsQueryAtom',
    file: 'features/comments/atoms/commentAtoms.ts',
    type: 'graphql',
    operation: 'commentConnection',
    testName: 'GQL: commentConnection',
    priority: 'P1',
  },
  {
    hook: 'commentReplyCheck',
    file: 'features/comments/components/CommentItem.tsx',
    type: 'graphql',
    operation: 'commentConnection (parentId)',
    testName: 'GQL: commentConnection (replies)',
    priority: 'P1',
  },
  {
    hook: 'useProfile',
    file: 'features/profile/hooks/useProfile.ts',
    type: 'graphql',
    operation: 'profile',
    testName: 'GQL: profile',
    priority: 'P1',
  },
  {
    hook: 'useUserPosts',
    file: 'features/post/hooks/usePosts.ts',
    type: 'graphql',
    operation: 'profile (posts)',
    testName: 'GQL: profile (with posts)',
    priority: 'P1',
  },
  {
    hook: 'useCreateProfile',
    file: 'features/profile/hooks/useCreateProfile.ts',
    type: 'rest',
    operation: 'POST /api/profile',
    testName: 'REST: POST /api/profile',
    priority: 'P1',
  },
  {
    hook: 'useUpdateProfile',
    file: 'features/profile/hooks/useUpdateProfile.ts',
    type: 'graphql',
    operation: 'updateProfile',
    testName: 'GQL: updateProfile',
    priority: 'P1',
  },
  {
    hook: 'useCheckUsername',
    file: 'features/profile/hooks/useProfile.ts',
    type: 'rest',
    operation: 'GET /api/profile/check-username',
    testName: 'Profile: check-username',
    priority: 'P1',
  },
  {
    hook: 'useUploadMedia (upload URL)',
    file: 'features/media/hooks/useUploadMedia.ts',
    type: 'rest',
    operation: 'POST /api/media/image-upload',
    testName: 'Media: get upload URL',
    priority: 'P1',
  },
  {
    hook: 'useUploadMedia (batch)',
    file: 'features/media/hooks/useUploadMedia.ts',
    type: 'rest',
    operation: 'POST /api/media/batch-upload',
    testName: 'Media: batch upload URLs',
    priority: 'P1',
  },
  {
    hook: 'useUploadMedia (image-record)',
    file: 'features/media/hooks/useUploadMedia.ts',
    type: 'rest',
    operation: 'POST /api/media/image-record',
    testName: 'REST: POST /api/media/image-record',
    priority: 'P1',
  },
  {
    hook: 'useDeleteMedia',
    file: 'features/media/hooks/useDeleteMedia.ts',
    type: 'rest',
    operation: 'DELETE /api/media/:mediaId',
    testName: 'REST: DELETE /api/media/:mediaId',
    priority: 'P1',
  },
  {
    hook: 'useRestoreMedia',
    file: 'features/media/hooks/useRestoreMedia.ts',
    type: 'rest',
    operation: 'POST /api/media/restore/:mediaId',
    testName: 'REST: POST /api/media/restore/:mediaId',
    priority: 'P1',
  },
  {
    hook: 'useImageUrl',
    file: 'features/media/hooks/useImageUrl.ts',
    type: 'rest',
    operation: 'GET /api/media/:mediaId/url',
    testName: 'REST: GET /api/media/:mediaId/url',
    priority: 'P1',
  },
  {
    hook: 'useImageUrl (CDN)',
    file: 'features/media/hooks/useImageUrl.ts',
    type: 'rest',
    operation: 'GET /cdn/:mediaId',
    testName: 'REST: GET /cdn/:mediaId',
    priority: 'P1',
  },
  {
    hook: 'useCloudflareImageUrl',
    file: 'features/media/hooks/useImageUrl.ts',
    type: 'rest',
    operation: 'GET /api/media/cloudflare-url/:cloudflareId',
    testName: 'REST: GET /api/media/cloudflare-url/:cloudflareId',
    priority: 'P1',
  },

  // P2: Social features
  {
    hook: 'useLikePost',
    file: 'features/post/hooks/useLikePost.ts',
    type: 'graphql',
    operation: 'likePost',
    testName: 'GQL: likePost',
    priority: 'P2',
  },
  {
    hook: 'useUnlikePost',
    file: 'features/post/hooks/useLikePost.ts',
    type: 'graphql',
    operation: 'unlikePost',
    testName: 'GQL: unlikePost',
    priority: 'P2',
  },
  {
    hook: 'useSavePost',
    file: 'features/post/hooks/useSavePost.ts',
    type: 'graphql',
    operation: 'savePost',
    testName: 'GQL: savePost',
    priority: 'P2',
  },
  {
    hook: 'useUnsavePost',
    file: 'features/post/hooks/useSavePost.ts',
    type: 'graphql',
    operation: 'unsavePost',
    testName: 'GQL: unsavePost',
    priority: 'P2',
  },
  {
    hook: 'useSavedPosts',
    file: 'features/post/hooks/useSavedPosts.ts',
    type: 'graphql',
    operation: 'savedPosts',
    testName: 'GQL: savedPosts',
    priority: 'P2',
  },
  {
    hook: 'useLikedPosts',
    file: 'features/post/hooks/useLikedPosts.ts',
    type: 'graphql',
    operation: 'likedPosts',
    testName: 'GQL: likedPosts',
    priority: 'P2',
  },
  {
    hook: 'useFollowUser',
    file: 'features/social/hooks/useFollow.ts',
    type: 'graphql',
    operation: 'followUser',
    testName: 'GQL: followUser',
    priority: 'P2',
  },
  {
    hook: 'useUnfollowUser',
    file: 'features/social/hooks/useFollow.ts',
    type: 'graphql',
    operation: 'unfollowUser',
    testName: 'GQL: unfollowUser',
    priority: 'P2',
  },
  {
    hook: 'useBlockUser',
    file: 'features/social/hooks/useBlock.ts',
    type: 'graphql',
    operation: 'blockUser',
    testName: 'GQL: blockUser',
    priority: 'P2',
  },
  {
    hook: 'useUnblockUser',
    file: 'features/social/hooks/useBlock.ts',
    type: 'graphql',
    operation: 'unblockUser',
    testName: 'GQL: unblockUser',
    priority: 'P2',
  },
  {
    hook: 'useFollowers',
    file: 'features/social/hooks/useFollowers.ts',
    type: 'graphql',
    operation: 'followers',
    testName: 'GQL: followers',
    priority: 'P2',
  },
  {
    hook: 'useFollowing',
    file: 'features/social/hooks/useFollowing.ts',
    type: 'graphql',
    operation: 'following',
    testName: 'GQL: following',
    priority: 'P2',
  },
  {
    hook: 'useBlockedUsers',
    file: 'features/social/hooks/useBlock.ts',
    type: 'graphql',
    operation: 'blockedUsers',
    testName: 'GQL: blockedUsers',
    priority: 'P2',
  },
  {
    hook: 'useSearchUsers',
    file: 'features/search/hooks/useSearch.ts',
    type: 'graphql',
    operation: 'searchUsers',
    testName: 'GQL: searchUsers',
    priority: 'P2',
  },
  {
    hook: 'useSearchHashtags',
    file: 'features/search/hooks/useSearch.ts',
    type: 'graphql',
    operation: 'searchHashtags',
    testName: 'GQL: searchHashtags',
    priority: 'P2',
  },
  {
    hook: 'useMarkPostsAsSeen',
    file: 'features/feed/hooks/useMarkPostsAsSeen.ts',
    type: 'graphql',
    operation: 'markPostsAsSeen',
    testName: 'GQL: markPostsAsSeen',
    priority: 'P2',
  },
  {
    hook: 'useNotifications',
    file: 'features/notifications/hooks/useNotifications.ts',
    type: 'graphql',
    operation: 'notifications',
    testName: 'GQL: notifications',
    priority: 'P2',
  },
  {
    hook: 'useUnreadNotificationCount',
    file: 'features/notifications/hooks/useNotifications.ts',
    type: 'graphql',
    operation: 'unreadNotificationCount',
    testName: 'GQL: unreadNotificationCount',
    priority: 'P2',
  },
  {
    hook: 'useMarkNotificationRead',
    file: 'features/notifications/hooks/useNotifications.ts',
    type: 'graphql',
    operation: 'markNotificationRead',
    testName: 'GQL: markNotificationRead',
    priority: 'P2',
  },
  {
    hook: 'useMarkAllNotificationsRead',
    file: 'features/notifications/hooks/useNotifications.ts',
    type: 'graphql',
    operation: 'markAllNotificationsRead',
    testName: 'GQL: markAllNotificationsRead',
    priority: 'P2',
  },
  {
    hook: 'useNotificationSettings',
    file: 'features/notifications/hooks/useNotificationSettings.ts',
    type: 'graphql',
    operation: 'notificationSettings',
    testName: 'GQL: notificationSettings',
    priority: 'P2',
  },
  {
    hook: 'useUpdateNotificationSettings',
    file: 'features/notifications/hooks/useNotificationSettings.ts',
    type: 'graphql',
    operation: 'updateNotificationSettings',
    testName: 'GQL: updateNotificationSettings',
    priority: 'P2',
  },

  // P2: Feedback
  {
    hook: 'useFeedbackCategories',
    file: 'features/feedback/hooks/useFeedback.ts',
    type: 'graphql',
    operation: 'feedbackCategories',
    testName: 'GQL: feedbackCategories',
    priority: 'P2',
  },
  {
    hook: 'useMyTickets',
    file: 'features/feedback/hooks/useMyTickets.ts',
    type: 'graphql',
    operation: 'myTickets',
    testName: 'GQL: myTickets',
    priority: 'P2',
  },
  {
    hook: 'useTicketDetail',
    file: 'features/feedback/hooks/useMyTickets.ts',
    type: 'graphql',
    operation: 'ticket(id)',
    testName: 'GQL: ticket',
    priority: 'P2',
  },
  {
    hook: 'useCreateHashtag',
    file: 'features/post/hooks/useHashtags.ts',
    type: 'graphql',
    operation: 'createHashtag',
    testName: 'GQL: createHashtag',
    priority: 'P2',
  },

  // P3: Analytics / interests / cache
  {
    hook: 'useInterests',
    file: 'features/interests/hooks/useInterests.ts',
    type: 'rest',
    operation: 'GET /api/interests',
    testName: 'Interests: get',
    priority: 'P3',
  },
  {
    hook: 'useDiscoveryAnalytics',
    file: 'features/analytics/hooks/useAnalytics.ts',
    type: 'graphql',
    operation: 'discoveryAnalytics',
    testName: 'GQL: discoveryAnalytics',
    priority: 'P3',
  },
  {
    hook: 'useDiscoveryPerformance',
    file: 'features/analytics/hooks/useAnalytics.ts',
    type: 'graphql',
    operation: 'discoveryPerformanceSummary',
    testName: 'GQL: discoveryPerformanceSummary',
    priority: 'P3',
  },
];

// ── Coverage & Fix Plan ──────────────────────────────────────────────────────

function generateCoverageReport(allResults: TestResult[]) {
  const testNames = new Set(allResults.map((r) => r.endpoint));
  const groups = buildTestGroups();
  const allTestNames = new Set<string>();
  for (const g of groups) {
    for (const t of g.tests) {
      allTestNames.add(t.name);
    }
  }

  const mapped = HOOK_ENDPOINT_MAP.map((entry) => {
    const result = allResults.find(
      (r) => r.endpoint.includes(entry.operation) || allTestNames.has(entry.testName),
    );
    const matchedResult = allResults.find((_, i) => {
      // Match by walking through groups to find the test result at the right index
      let idx = 0;
      for (const g of groups) {
        for (const t of g.tests) {
          if (t.skip) continue;
          if (t.name === entry.testName) return idx === i;
          idx++;
        }
      }
      return false;
    });

    return {
      ...entry,
      tested: allTestNames.has(entry.testName),
      pass: matchedResult?.pass ?? null,
    };
  });

  const tested = mapped.filter((m) => m.tested).length;
  const total = mapped.length;

  return {
    totalHooks: total,
    testedHooks: tested,
    untestedHooks: total - tested,
    coveragePercent: `${((tested / total) * 100).toFixed(1)}%`,
    hooks: mapped,
  };
}

function generateFixPlan(allResults: TestResult[]) {
  const groups = buildTestGroups();
  const resultsByTestName = new Map<string, TestResult>();

  let idx = 0;
  for (const g of groups) {
    for (const t of g.tests) {
      if (t.skip) continue;
      if (allResults[idx]) {
        resultsByTestName.set(t.name, allResults[idx]);
      }
      idx++;
    }
  }

  const broken: Array<HookEndpointEntry & { error?: string; statusCode?: number | null }> = [];
  for (const entry of HOOK_ENDPOINT_MAP) {
    const result = resultsByTestName.get(entry.testName);
    if (result && !result.pass) {
      broken.push({ ...entry, error: result.error, statusCode: result.statusCode });
    }
  }

  const byPriority: Record<Priority, typeof broken> = { P0: [], P1: [], P2: [], P3: [] };
  for (const item of broken) {
    byPriority[item.priority].push(item);
  }

  return {
    totalBroken: broken.length,
    byPriority,
  };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const isCoverageOnly = process.argv.includes('--coverage-only');

  console.log('=== Capture API Health Check ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // --dry-run: print test plan and exit
  if (isDryRun) {
    const groups = buildTestGroups();
    let total = 0;
    for (const group of groups) {
      console.log(`\n--- ${group.name} (${group.tests.length} tests) ---`);
      for (const test of group.tests) {
        const routing = (test as any).routingOnly ? ' [routing-only]' : '';
        const skipped = test.skip ? ` [SKIP: ${test.skipReason || 'skipped'}]` : '';
        console.log(
          `  ${test.method.padEnd(6)} ${typeof test.path === 'function' ? '(dynamic)' : test.path}  -- ${test.name}${routing}${skipped}`,
        );
        total++;
      }
    }
    console.log(`\nTotal tests: ${total}`);
    console.log(`Hook-endpoint mappings: ${HOOK_ENDPOINT_MAP.length}`);
    return;
  }

  // --coverage-only: print hook mapping and gaps
  if (isCoverageOnly) {
    const groups = buildTestGroups();
    const allTestNames = new Set<string>();
    for (const g of groups) {
      for (const t of g.tests) {
        allTestNames.add(t.name);
      }
    }

    console.log('\n--- Hook-to-Endpoint Mapping ---');
    const priorities: Priority[] = ['P0', 'P1', 'P2', 'P3'];
    for (const p of priorities) {
      const entries = HOOK_ENDPOINT_MAP.filter((e) => e.priority === p);
      console.log(`\n  [${p}] (${entries.length} hooks)`);
      for (const entry of entries) {
        const hasCoverage = allTestNames.has(entry.testName);
        const icon = hasCoverage ? 'OK' : 'GAP';
        console.log(`    ${icon}  ${entry.hook.padEnd(40)} -> ${entry.testName}`);
      }
    }

    const covered = HOOK_ENDPOINT_MAP.filter((e) => allTestNames.has(e.testName)).length;
    const total = HOOK_ENDPOINT_MAP.length;
    const gaps = HOOK_ENDPOINT_MAP.filter((e) => !allTestNames.has(e.testName));

    console.log(`\n--- Coverage Summary ---`);
    console.log(`Total hooks: ${total}`);
    console.log(`Covered: ${covered}`);
    console.log(`Gaps: ${gaps.length}`);
    console.log(`Coverage: ${((covered / total) * 100).toFixed(1)}%`);

    if (gaps.length > 0) {
      console.log(`\n--- Uncovered Hooks ---`);
      for (const g of gaps) {
        console.log(`  [${g.priority}] ${g.hook} (${g.operation}) -- expected test: ${g.testName}`);
      }
    }
    return;
  }

  // Authenticate
  await authenticate();

  // After auth, update the refresh token test body
  const groups = buildTestGroups();
  const allResults: TestResult[] = [];

  for (const group of groups) {
    console.log(`\n--- ${group.name} (${group.tests.length} tests) ---`);

    for (const test of group.tests) {
      if (test.skip) {
        console.log(`  SKIP  ${test.name} - ${test.skipReason || 'skipped'}`);
        continue;
      }

      // Skip mutation tests that depend on missing IDs
      const skipDeps: Array<{ match: (n: string) => boolean; dep: string; check: () => boolean }> =
        [
          {
            match: (n) =>
              typeof test.body === 'function' &&
              n.startsWith('GQL:') &&
              ![
                'GQL: createPost',
                'GQL: createHashtag',
                'GQL: markAllNotificationsRead',
                'GQL: saveDraftPost',
                'GQL: saveDraftPost (for publish)',
                'GQL: updateProfile',
                'GQL: followUser',
                'GQL: unfollowUser',
                'GQL: blockUser',
                'GQL: unblockUser',
                'GQL: markNotificationRead',
                'GQL: updateNotificationSettings',
                'GQL: updateNotificationSettings (revert)',
              ].includes(n) &&
              (n.includes('Comment') ||
                n.includes('like') ||
                n.includes('save') ||
                n.includes('delete') ||
                n.includes('post (single)') ||
                n.includes('updatePost') ||
                n.includes('markPostsAsSeen') ||
                n.includes('commentConnection (lifecycle)')),
            dep: 'testPostId',
            check: () => !testPostId,
          },
          {
            match: (n) => n === 'GQL: deleteComment',
            dep: 'testCommentId',
            check: () => !testCommentId,
          },
          {
            match: (n) => n === 'GQL: deleteDraftPost',
            dep: 'testDraftId',
            check: () => !testDraftId,
          },
          {
            match: (n) => n === 'GQL: publishDraftPost',
            dep: 'testDraftId',
            check: () => !testDraftId,
          },
          {
            match: (n) => n === 'GQL: deletePost (published draft)',
            dep: 'testPublishedDraftPostId',
            check: () => !testPublishedDraftPostId,
          },
        ];

      const skipRule = skipDeps.find((s) => s.match(test.name) && s.check());
      if (skipRule) {
        console.log(`  SKIP  ${test.name} - no ${skipRule.dep} available`);
        allResults.push({
          endpoint: `${test.method} ${typeof test.path === 'function' ? (test.path as () => string)() : test.path}`,
          method: test.method,
          statusCode: null,
          latency: 0,
          pass: false,
          error: `Skipped: dependency (${skipRule.dep}) not available`,
        });
        continue;
      }

      const result = await runTest(test);
      allResults.push(result);

      const icon = result.pass ? 'PASS' : 'FAIL';
      const latStr = `${result.latency}ms`;
      const status = result.statusCode ?? 'ERR';
      console.log(
        `  ${icon}  ${test.name.padEnd(40)} ${String(status).padStart(3)} ${latStr.padStart(7)}${result.error ? `  ${result.error.slice(0, 80)}` : ''}`,
      );
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const passed = allResults.filter((r) => r.pass).length;
  const failed = allResults.filter((r) => !r.pass).length;
  const total = allResults.length;
  const avgLatency =
    total > 0 ? Math.round(allResults.reduce((sum, r) => sum + r.latency, 0) / total) : 0;

  console.log('\n=== Summary ===');
  console.log(`Total: ${total}  Passed: ${passed}  Failed: ${failed}`);
  console.log(`Average Latency: ${avgLatency}ms`);
  console.log(`Pass Rate: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);

  if (failed > 0) {
    console.log('\n--- Failed Tests ---');
    for (const r of allResults.filter((r) => !r.pass)) {
      console.log(`  ${r.endpoint}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    }
  }

  // ── Coverage & Fix Plan ─────────────────────────────────────────────────
  const coverage = generateCoverageReport(allResults);
  const fixPlan = generateFixPlan(allResults);

  console.log('\n=== Coverage ===');
  console.log(
    `Hooks: ${coverage.testedHooks}/${coverage.totalHooks} (${coverage.coveragePercent})`,
  );

  if (fixPlan.totalBroken > 0) {
    console.log('\n=== Fix Plan ===');
    const priorities: Priority[] = ['P0', 'P1', 'P2', 'P3'];
    for (const p of priorities) {
      const items = fixPlan.byPriority[p];
      if (items.length === 0) continue;
      console.log(`\n  [${p}] ${items.length} broken`);
      for (const item of items) {
        console.log(`    ${item.hook} -> ${item.operation}`);
        if (item.error) console.log(`      Error: ${item.error.slice(0, 100)}`);
      }
    }
  }

  // ── Save Report ───────────────────────────────────────────────────────
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: {
      total,
      passed,
      failed,
      avgLatency,
      passRate: `${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`,
    },
    coverage: {
      totalHooks: coverage.totalHooks,
      testedHooks: coverage.testedHooks,
      untestedHooks: coverage.untestedHooks,
      coveragePercent: coverage.coveragePercent,
    },
    fixPlan: {
      totalBroken: fixPlan.totalBroken,
      byPriority: fixPlan.byPriority,
    },
    hookMapping: coverage.hooks,
    results: allResults,
  };

  const reportPath = new URL('./health-check-report.json', import.meta.url).pathname;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${reportPath}`);
}

main().catch((err) => {
  console.error('Health check failed:', err);
  process.exit(1);
});
