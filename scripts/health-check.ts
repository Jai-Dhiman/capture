import * as readline from "node:readline";
import * as fs from "node:fs";

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = "https://capture-api.jai-d.workers.dev";
const AUTH_EMAIL = "jaidhiman2000@gmail.com";

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
    skip?: boolean;
    skipReason?: string;
    setup?: () => Promise<void>;
    cleanup?: () => Promise<void>;
  }>;
}

// ── State ───────────────────────────────────────────────────────────────────
let accessToken = "";
let refreshToken = "";
let userId = "";
let profileId = "";

// IDs captured during lifecycle tests
let testPostId = "";
let testCommentId = "";
let testHashtagId = "";

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
  } = {}
): Promise<{ status: number; data: any; latency: number }> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, data, latency };
}

function snippet(data: any): string {
  const str = typeof data === "string" ? data : JSON.stringify(data);
  return str.length > 200 ? str.slice(0, 200) + "..." : str;
}

function gql(query: string, variables?: Record<string, unknown>) {
  return { query, variables };
}

// ── Auth Flow ───────────────────────────────────────────────────────────────
async function authenticate(): Promise<void> {
  console.log("\n--- Authentication ---");

  // Check if token was passed directly (--token <jwt>)
  const tokenArgIdx = process.argv.indexOf("--token");
  if (tokenArgIdx !== -1 && process.argv[tokenArgIdx + 1]) {
    accessToken = process.argv[tokenArgIdx + 1];
    console.log("Using token from CLI argument.");
    const meRes = await request("GET", "/auth/me", { auth: true });
    if (meRes.status === 200) {
      userId = meRes.data.id || meRes.data.userId || "";
      profileId = meRes.data.profileId || meRes.data.profile?.id || "";
      console.log(`Authenticated as user: ${userId}, profile: ${profileId}`);
    }
    return;
  }

  // Check if code was passed as CLI arg (--code 123456)
  const codeArgIdx = process.argv.indexOf("--code");
  let code: string;

  if (codeArgIdx !== -1 && process.argv[codeArgIdx + 1]) {
    code = process.argv[codeArgIdx + 1];
    console.log(`Using code from CLI argument.`);
  } else {
    console.log(`Sending code to ${AUTH_EMAIL}...`);
    const sendRes = await request("POST", "/auth/send-code", {
      body: { email: AUTH_EMAIL },
    });

    if (sendRes.status !== 200) {
      throw new Error(
        `Failed to send code: ${sendRes.status} ${JSON.stringify(sendRes.data)}`
      );
    }
    console.log("Code sent successfully.");
    code = await prompt("Enter the 6-digit code from your email: ");
  }

  const verifyRes = await request("POST", "/auth/verify-code", {
    body: { email: AUTH_EMAIL, code },
  });

  if (verifyRes.status !== 200) {
    throw new Error(
      `Failed to verify code: ${verifyRes.status} ${JSON.stringify(verifyRes.data)}`
    );
  }

  // Token lives at data.session.access_token or data.access_token
  const session = verifyRes.data.session || verifyRes.data;
  accessToken = session.access_token || session.accessToken;
  refreshToken = session.refresh_token || session.refreshToken;

  if (!accessToken) {
    console.error("verify-code response:", JSON.stringify(verifyRes.data).slice(0, 500));
    throw new Error("No access token returned from verify-code");
  }

  // Extract user ID from verify response
  userId = verifyRes.data.user?.id || "";

  // Get user info
  const meRes = await request("GET", "/auth/me", { auth: true });
  if (meRes.status === 200) {
    userId = meRes.data.id || meRes.data.userId || meRes.data.user?.id || userId;
    profileId = meRes.data.profileId || meRes.data.profile?.id || "";
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
      name: "Public Endpoints",
      tests: [
        { name: "Health check", method: "GET", path: "/", auth: false },
        { name: "Version", method: "GET", path: "/version", auth: false },
        {
          name: "AASA",
          method: "GET",
          path: "/.well-known/apple-app-site-association",
          auth: false,
        },
        {
          name: "Analytics: overview",
          method: "GET",
          path: "/api/analytics/overview",
          auth: false,
        },
        {
          name: "Analytics: user-growth",
          method: "GET",
          path: "/api/analytics/user-growth",
          auth: false,
        },
        {
          name: "Analytics: content-activity",
          method: "GET",
          path: "/api/analytics/content-activity",
          auth: false,
        },
        {
          name: "Analytics: top-users",
          method: "GET",
          path: "/api/analytics/top-users",
          auth: false,
        },
        {
          name: "Analytics: recent-activity",
          method: "GET",
          path: "/api/analytics/recent-activity",
          auth: false,
        },
        {
          name: "Profile: check-username",
          method: "GET",
          path: "/api/profile/check-username?username=__health_check_test__",
          auth: false,
        },
      ],
    },

    // ── AUTH ENDPOINTS ────────────────────────────────────────────────────
    {
      name: "Auth Endpoints",
      tests: [
        { name: "Auth: me", method: "GET", path: "/auth/me", auth: true },
        {
          name: "Auth: refresh",
          method: "POST",
          path: "/auth/refresh",
          auth: false,
          body: { refresh_token: "will-use-actual" },
          // We'll override this in the runner
        },
        {
          name: "Auth: passkey list",
          method: "GET",
          path: "/auth/passkey/list",
          auth: true,
        },
        {
          name: "Auth: passkey check",
          method: "POST",
          path: "/auth/passkey/check",
          auth: false,
          body: { email: AUTH_EMAIL },
        },
        {
          name: "Auth: register-device (no token)",
          method: "POST",
          path: "/auth/register-device",
          auth: true,
          body: { token: "health-check-test-token", platform: "ios" },
        },
        {
          name: "Auth: unregister-device",
          method: "POST",
          path: "/auth/unregister-device",
          auth: true,
          body: { token: "health-check-test-token" },
        },
      ],
    },

    // ── MEDIA ENDPOINTS ──────────────────────────────────────────────────
    {
      name: "Media Endpoints",
      tests: [
        {
          name: "Media: get upload URL",
          method: "POST",
          path: "/api/media/image-upload",
          auth: true,
          body: {},
        },
        {
          name: "Media: batch upload URLs",
          method: "POST",
          path: "/api/media/batch-upload",
          auth: true,
          body: { count: 2 },
        },
        {
          name: "Media: list deleted",
          method: "GET",
          path: "/api/media/deleted",
          auth: true,
        },
        {
          name: "Media: processor status",
          method: "GET",
          path: "/api/media/processor-status",
          auth: true,
        },
        {
          name: "Media: cleanup status",
          method: "GET",
          path: "/api/media/cleanup-status",
          auth: true,
        },
      ],
    },

    // ── CACHE ENDPOINTS ──────────────────────────────────────────────────
    {
      name: "Cache Endpoints",
      tests: [
        {
          name: "Cache: stats",
          method: "GET",
          path: "/api/cache/stats",
          auth: true,
        },
        {
          name: "Cache: health",
          method: "GET",
          path: "/api/cache/health",
          auth: true,
        },
        {
          name: "Cache: keys (discovery)",
          method: "GET",
          path: () => `/api/cache/keys/discovery?id=${userId}`,
          auth: true,
        },
        {
          name: "Cache: operations (get)",
          method: "POST",
          path: "/api/cache/operations",
          auth: true,
          body: { operation: "get", key: "health_check_probe" },
        },
      ],
    },

    // ── INTERESTS ────────────────────────────────────────────────────────
    {
      name: "Interests",
      tests: [
        {
          name: "Interests: get",
          method: "GET",
          path: "/api/interests",
          auth: true,
        },
      ],
    },

    // ── GRAPHQL QUERIES ──────────────────────────────────────────────────
    {
      name: "GraphQL Queries",
      tests: [
        {
          name: "GQL: profile",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(`query { profile(id: "${profileId || userId}") { id username } }`),
        },
        {
          name: "GQL: discoverFeed",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `query { discoverFeed(limit: 3) { posts { id content } hasMore nextCursor } }`
          ),
        },
        {
          name: "GQL: followingFeed",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `query { followingFeed(limit: 3) { posts { id content } hasMore nextCursor } }`
          ),
        },
        {
          name: "GQL: savedPosts",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(`query { savedPosts(limit: 3) { id content } }`),
        },
        {
          name: "GQL: likedPosts",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(`query { likedPosts(limit: 3) { id content } }`),
        },
        {
          name: "GQL: followers",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(`query { followers(userId: "${userId}") { id username } }`),
        },
        {
          name: "GQL: following",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(`query { following(userId: "${userId}") { id username } }`),
        },
        {
          name: "GQL: blockedUsers",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(`query { blockedUsers { id username } }`),
        },
        {
          name: "GQL: searchUsers",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(`query { searchUsers(query: "test") { id username } }`),
        },
        {
          name: "GQL: searchHashtags",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `query { searchHashtags(query: "test", limit: 3) { id name } }`
          ),
        },
        {
          name: "GQL: notifications",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `query { notifications(limit: 5) { id type message isRead createdAt } }`
          ),
        },
        {
          name: "GQL: unreadNotificationCount",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(`query { unreadNotificationCount }`),
        },
        {
          name: "GQL: notificationSettings",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `query { notificationSettings { id enablePush likes comments follows } }`
          ),
        },
        {
          name: "GQL: draftPosts",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(`query { draftPosts(limit: 3) { id content } }`),
        },
        {
          name: "GQL: discoveryAnalytics",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(
              `query { discoveryAnalytics(userId: "${userId}", limit: 3) { sessionLogs { sessionId phase processingTimeMs } seenPostsAnalytics { averageSeenPostsPerUser } } }`
            ),
        },
        {
          name: "GQL: discoveryPerformanceSummary",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `query { discoveryPerformanceSummary { totalSessions averageProcessingTime averageResults errorRate } }`
          ),
        },
        {
          name: "GQL: feedbackCategories",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `query { feedbackCategories { id name description isActive } }`
          ),
        },
        {
          name: "GQL: myTickets",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `query { myTickets(limit: 3) { id subject status priority } }`
          ),
        },
      ],
    },

    // ── GRAPHQL MUTATIONS (Lifecycle Tests) ──────────────────────────────
    {
      name: "GraphQL Mutations (Lifecycle)",
      tests: [
        // Create hashtag
        {
          name: "GQL: createHashtag",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `mutation { createHashtag(name: "healthcheck${Date.now()}") { id name } }`
          ),
        },
        // Create post
        {
          name: "GQL: createPost",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `mutation { createPost(input: { content: "Health check test post ${Date.now()}", type: post }) { id content } }`
          ),
        },
        // Create comment (uses testPostId)
        {
          name: "GQL: createComment",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(
              `mutation { createComment(input: { postId: "${testPostId}", content: "Health check test comment" }) { id content } }`
            ),
          skip: false,
        },
        // Like post
        {
          name: "GQL: likePost",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(
              `mutation { likePost(postId: "${testPostId}") { success post { id _likeCount } } }`
            ),
        },
        // Unlike post
        {
          name: "GQL: unlikePost",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(
              `mutation { unlikePost(postId: "${testPostId}") { success } }`
            ),
        },
        // Save post
        {
          name: "GQL: savePost",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(
              `mutation { savePost(postId: "${testPostId}") { success } }`
            ),
        },
        // Unsave post
        {
          name: "GQL: unsavePost",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(
              `mutation { unsavePost(postId: "${testPostId}") { success } }`
            ),
        },
        // Mark notifications read
        {
          name: "GQL: markAllNotificationsRead",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: gql(
            `mutation { markAllNotificationsRead { success count } }`
          ),
        },
        // Delete comment (uses testCommentId)
        {
          name: "GQL: deleteComment",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(
              `mutation { deleteComment(id: "${testCommentId}") { id success } }`
            ),
        },
        // Delete post (uses testPostId)
        {
          name: "GQL: deletePost",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(
              `mutation { deletePost(id: "${testPostId}") { id success } }`
            ),
        },
        // Query post to verify
        {
          name: "GQL: post (single)",
          method: "POST",
          path: "/graphql",
          auth: true,
          body: () =>
            gql(
              `query { post(id: "${testPostId}") { id content } }`
            ),
        },
      ],
    },
  ];
}

// ── Test Runner ─────────────────────────────────────────────────────────────

async function runTest(test: TestGroup["tests"][0]): Promise<TestResult> {
  const path = typeof test.path === "function" ? (test.path as () => string)() : test.path;
  const body = typeof test.body === "function" ? (test.body as () => unknown)() : test.body;

  // Special override for refresh token test
  let actualBody = body;
  if (test.name === "Auth: refresh" && refreshToken) {
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

    const pass = expectedStatuses.includes(res.status);

    // Capture IDs from lifecycle mutations
    if (test.name === "GQL: createPost" && res.data?.data?.createPost?.id) {
      testPostId = res.data.data.createPost.id;
    }
    if (
      test.name === "GQL: createComment" &&
      res.data?.data?.createComment?.id
    ) {
      testCommentId = res.data.data.createComment.id;
    }
    if (
      test.name === "GQL: createHashtag" &&
      res.data?.data?.createHashtag?.id
    ) {
      testHashtagId = res.data.data.createHashtag.id;
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
      error: hasGqlErrors
        ? res.data.errors.map((e: any) => e.message).join("; ")
        : undefined,
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

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Capture API Health Check ===");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Authenticate
  await authenticate();

  // After auth, update the refresh token test body
  const groups = buildTestGroups();
  const allResults: TestResult[] = [];

  for (const group of groups) {
    console.log(`\n--- ${group.name} (${group.tests.length} tests) ---`);

    for (const test of group.tests) {
      if (test.skip) {
        console.log(`  SKIP  ${test.name} - ${test.skipReason || "skipped"}`);
        continue;
      }

      // Skip mutation tests that depend on missing IDs
      if (
        typeof test.body === "function" &&
        test.name.includes("GQL:") &&
        (test.name.includes("Comment") ||
          test.name.includes("like") ||
          test.name.includes("save") ||
          test.name.includes("delete") ||
          test.name.includes("post (single)")) &&
        !testPostId &&
        test.name !== "GQL: createPost" &&
        test.name !== "GQL: createHashtag" &&
        test.name !== "GQL: markAllNotificationsRead"
      ) {
        console.log(`  SKIP  ${test.name} - no testPostId available`);
        allResults.push({
          endpoint: `${test.method} ${test.path}`,
          method: test.method,
          statusCode: null,
          latency: 0,
          pass: false,
          error: "Skipped: dependency (testPostId) not available",
        });
        continue;
      }

      if (
        typeof test.body === "function" &&
        test.name.includes("deleteComment") &&
        !testCommentId
      ) {
        console.log(`  SKIP  ${test.name} - no testCommentId available`);
        allResults.push({
          endpoint: `${test.method} ${test.path}`,
          method: test.method,
          statusCode: null,
          latency: 0,
          pass: false,
          error: "Skipped: dependency (testCommentId) not available",
        });
        continue;
      }

      const result = await runTest(test);
      allResults.push(result);

      const icon = result.pass ? "PASS" : "FAIL";
      const latStr = `${result.latency}ms`;
      const status = result.statusCode ?? "ERR";
      console.log(
        `  ${icon}  ${test.name.padEnd(40)} ${String(status).padStart(3)} ${latStr.padStart(7)}${result.error ? `  ${result.error.slice(0, 80)}` : ""}`
      );
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  const passed = allResults.filter((r) => r.pass).length;
  const failed = allResults.filter((r) => !r.pass).length;
  const total = allResults.length;
  const avgLatency =
    total > 0
      ? Math.round(
          allResults.reduce((sum, r) => sum + r.latency, 0) / total
        )
      : 0;

  console.log("\n=== Summary ===");
  console.log(`Total: ${total}  Passed: ${passed}  Failed: ${failed}`);
  console.log(`Average Latency: ${avgLatency}ms`);
  console.log(`Pass Rate: ${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%`);

  if (failed > 0) {
    console.log("\n--- Failed Tests ---");
    for (const r of allResults.filter((r) => !r.pass)) {
      console.log(`  ${r.endpoint}`);
      if (r.error) console.log(`    Error: ${r.error}`);
    }
  }

  // ── Save Report ───────────────────────────────────────────────────────
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: { total, passed, failed, avgLatency, passRate: `${total > 0 ? ((passed / total) * 100).toFixed(1) : 0}%` },
    results: allResults,
  };

  const reportPath = new URL("./health-check-report.json", import.meta.url)
    .pathname;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${reportPath}`);
}

main().catch((err) => {
  console.error("Health check failed:", err);
  process.exit(1);
});
