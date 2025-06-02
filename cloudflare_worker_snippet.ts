// --- Cloudflare Worker Snippet for /api/profile/interests ---
// This snippet demonstrates how to fetch user's top themes from Cloudflare KV
// and add them to an existing API response.
// It assumes a Hono-like framework context.

import { Hono } from 'hono';

// Define the structure of a single theme item
// Note: The 'distance' field was part of assign_user_themes.py for sorting,
// but the KV payload was specified to be compact: [{"themeLabel": "...", "clusterId": ...}]
// Adjust this interface based on the actual data stored in KV.
// If 'distance' is not in KV, remove it from here.
interface TopThemeItem {
  themeLabel: string;
  clusterId: number;
  // distance?: number; // Optional if not stored in KV
}

// Define the type for the array of top themes
type TopThemes = TopThemeItem[];

// Define the binding for the KV namespace in your wrangler.toml
// Example:
// [[kv_namespaces]]
// binding = "USER_TOP_THEMES"
// id = "your_kv_namespace_id_here"
interface Env {
  USER_TOP_THEMES: KVNamespace;
  // ... other environment bindings
}

const app = new Hono<{ Bindings: Env }>();

app.get('/api/profile/interests', async (c) => {
  // Assume userId is available, e.g., from authentication middleware
  // For demonstration, let's hardcode it. In a real app, this would be dynamic.
  const userId = "user123-example"; // Replace with actual userId retrieval logic

  let userTopThemes: TopThemes = []; // Default to empty array

  try {
    // 1. Access KV Namespace (USER_TOP_THEMES)
    // The namespace is available via c.env.BINDING_NAME
    const themesData = await c.env.USER_TOP_THEMES.get(userId, { type: 'json' });

    // 2. Fetch Theme Data & Handle Missing Data
    if (themesData) {
      // Assuming themesData is already in the correct TopThemes format
      // If KV stores a string, you might need JSON.parse, but { type: 'json' } handles it.
      userTopThemes = themesData as TopThemes;
      console.log(`Successfully fetched themes for user ${userId}`);
    } else {
      console.log(`No theme data found in KV for user ${userId}. Defaulting to empty array.`);
      // userTopThemes is already initialized to [], so no action needed here
    }
  } catch (error) {
    console.error(`Error fetching themes from KV for user ${userId}:`, error);
    // Decide on error handling:
    // - Proceed with empty themes (already default)
    // - Return an error response (e.g., c.json({ error: "Failed to load user themes" }, 500))
    // For this snippet, we'll proceed with empty themes.
  }

  // --- Existing Logic (Placeholder) ---
  // Assume this is where you fetch other user profile data
  // For example:
  // const userProfile = await fetchUserProfile(userId);
  // const userInterests = await fetchUserInterests(userId);

  const responseData = {
    // ...userProfile, // Spread existing profile data
    // interests: userInterests, // Existing interests data
    // --- End of Existing Logic Placeholder ---
    
    // Example existing data structure
    profileInfo: {
        username: "exampleUser",
        email: "user@example.com",
    },
    currentInterests: ["hiking", "photography", "coding"], // Placeholder for other interests
  };


  // 3. Integrate into Response
  // Add the new 'topThemes' key to the responseData object.
  const augmentedResponseData = {
    ...responseData,
    topThemes: userTopThemes,
  };

  // 4. Return the final responseData as JSON
  return c.json(augmentedResponseData);
});

// --- Helper Functions (Example, not part of the snippet's core logic) ---
// async function fetchUserProfile(userId: string) {
//   // Placeholder for fetching user profile
//   return { id: userId, name: "John Doe" };
// }
// async function fetchUserInterests(userId: string) {
//   // Placeholder for fetching other interests
//   return ["reading", "traveling"];
// }

export default app;

// To run this (conceptual):
// 1. Ensure you have a Cloudflare Worker project set up.
// 2. Install Hono: npm install hono
// 3. Add the KV namespace binding "USER_TOP_THEMES" to your wrangler.toml.
// 4. Replace placeholder logic with your actual application logic.
// 5. Deploy with `wrangler deploy`.
//
// Remember that the actual data stored in KV for each user by `assign_user_themes.py`
// was `[{"themeLabel": "Some Theme", "clusterId": 1}, ...]`.
// The `TopThemeItem` interface should match this structure. If `distance` is not included
// in the KV value, it should not be in `TopThemeItem` or marked optional.
// The provided `assign_user_themes.py` was configured to store:
// [{"themeLabel": t["themeLabel"], "clusterId": t["clusterId"]}]
// So the `TopThemeItem` interface is correct without `distance`.
