# Project Plan: User Interest Theme Discovery via UMAP and API Integration

## 1. Goal

- To analyze the high-dimensional user interest vectors (derived from saved/created post embeddings and associated hashtags) using UMAP to discover latent thematic clusters within the user base.
- To interpret and label these clusters, identifying distinct user interest "themes".
- To determine, for each user, the **Top N (e.g., 3-5) closest themes** based on their position relative to theme cluster centers in the UMAP projection.
- To integrate the display of these Top N assigned themes into the existing `GET /api/profile/interests` API endpoint for logged-in users.

## 2. Current State

- User interest vectors (768 dimensions) are being generated via a weighted average of saved post embeddings, created post embeddings, and combined hashtag embeddings. These are stored in the `USER_VECTORS` KV namespace.
- Post embeddings are stored in the `POST_VECTORS` KV namespace and Cloudflare Vectorize.
- Source data (post content, hashtags, saved/created relationships) is stored in D1 database tables (`post`, `savedPost`, `hashtag`, `postHashtag`).
- An API endpoint `GET /api/profile/interests` successfully retrieves and displays the source data (saved/created posts, hashtags) and confirms the existence of the user's vector.

## 3. Required Technologies & Tools

- **Cloudflare:** Workers, KV Store, D1 Database, Wrangler CLI
- **Python Environment:** Local machine or dedicated compute instance.
- **Python Libraries:** `umap-learn`, `hdbscan`, `numpy`, `pandas`, `matplotlib`, `seaborn`, `scikit-learn` (for distance calculation)
- **Scripting:** Shell scripts (`wrangler` commands) or potentially a dedicated Python script for data export/import.

## 4. Execution Phases

### Phase 1: Data Export (Offline Preparation)

- **Objective:** Extract user vectors from Cloudflare KV for offline analysis.
- **Steps:**
  1.  **Identify Target Users:** Decide whether to run on all users or a representative sample initially.
  2.  **Develop Export Script:** Create a script (using `wrangler kv:key list` and `wrangler kv:key get --binding=USER_VECTORS`) to iterate through user IDs and fetch their corresponding JSON vector data from the `USER_VECTORS` KV namespace.
  3.  **Format Data:** Process the fetched JSON vectors into:
      - A NumPy array (`user_vectors.npy`) containing the raw vectors (Shape: `[num_users, 768]`).
      - A mapping file (e.g., `user_ids.csv` or `user_ids.json`) linking each `userId` to its corresponding row index in the `.npy` file.
- **Considerations:** KV read costs/limits, script execution time, handling missing vectors.

### Phase 2: UMAP Analysis & Theme Discovery (Offline Python)

- **Objective:** Reduce dimensionality, cluster users, visualize, interpret themes, and calculate theme centroids.
- **Steps:**
  1.  **Setup Python Environment:** Install required libraries (`pip install umap-learn hdbscan numpy pandas matplotlib seaborn scikit-learn`).
  2.  **Load Data:** Load `user_vectors.npy` and `user_ids.csv`.
  3.  **Run UMAP:**
      - Instantiate `umap.UMAP`. Key parameters to tune: `n_neighbors` (e.g., 15-50), `min_dist` (e.g., 0.0-0.5), `n_components=2`, `metric='cosine'`, `random_state=42`.
      - Run `reducer.fit_transform(user_vectors)` to get the 2D embeddings (`embedding_2d`). Store these alongside user IDs.
  4.  **Run Clustering (HDBSCAN):**
      - Instantiate `hdbscan.HDBSCAN` on the 2D UMAP output. Key parameters to tune: `min_cluster_size` (e.g., 1% of data points), `min_samples`.
      - Run `clusterer.fit_predict(embedding_2d)` to get cluster labels (integers, -1 for noise) for each user.
  5.  **Visualize:**
      - Create a scatter plot of the 2D UMAP embeddings using Matplotlib/Seaborn.
      - Color points based on their HDBSCAN cluster labels.
      - Save the plot for analysis.
  6.  **Interpret & Label Themes (Manual Step):**
      - Identify the main cluster IDs (ignore -1).
      - For each significant cluster:
        - Sample several `userId`s belonging to that cluster.
        - Look up the source data (saved/created posts, hashtags from D1/KV) for these sample users. _This might require a helper script or manual queries_.
        - Identify common topics, keywords, or patterns in their content.
        - Assign a concise, descriptive text label (Theme Name, e.g., "Tech News", "Travel Photography", "Finance & Stocks") to the cluster ID.
  7.  **Calculate Theme Centroids:**
      - For each labeled cluster ID, calculate its centroid (the mean/average 2D coordinate `[cx, cy]`) based on the `embedding_2d` coordinates of all users belonging to that cluster.
  8.  **Create Theme Definitions:** Generate and store a final mapping of theme definitions: `clusterId` -> `{ "themeLabel": "AssignedThemeName", "centroid": [cx, cy] }`.
- **Considerations:** UMAP/HDBSCAN parameter tuning is iterative. Theme interpretation requires domain understanding. Centroid calculation needs careful handling of cluster memberships.

### Phase 3: Store Top N Theme Assignments (Offline Preparation)

- **Objective:** Calculate and persist the Top N closest themes for each user back into Cloudflare.
- **Steps:**
  1.  **Choose N:** Decide how many closest themes to store (e.g., N=3 or N=5).
  2.  **Create KV Namespace:** Create a new KV namespace (e.g., `USER_TOP_THEMES`). Add binding to `wrangler.toml`.
  3.  **Develop Calculation & Import Script:**
      - Load the user ID to 2D UMAP coordinates mapping (`userId` -> `[ux, uy]`).
      - Load the theme definitions (`clusterId` -> `{ themeLabel, centroid }`).
      - For each user `userId`:
        - Get their 2D coordinates `[ux, uy]`.
        - Calculate the Euclidean distance from `[ux, uy]` to each theme `centroid` (`[cx, cy]`).
        - Create a list of ` { themeLabel, clusterId, distance }` objects for all defined themes.
        - Sort this list by `distance` (ascending).
        - Select the top N entries from the sorted list.
        - Format the result as a JSON array: `[{ themeLabel: "...", clusterId: ..., distance: ... }, ...]`.
        - Use `wrangler kv:key put --binding=USER_TOP_THEMES <userId> '<top_n_json_payload>'` to upload the Top N theme list JSON for the user.
- **Considerations:** Computational cost of distance calculations (all users vs all themes). Size of the JSON payload stored in KV. Error handling during calculation and upload.

### Phase 4: API Integration (Worker Code Update)

- **Objective:** Modify the `GET /api/profile/interests` endpoint to display the assigned Top N themes.
- **Steps:**
  1.  **Update Bindings:** Ensure the `USER_TOP_THEMES` binding is available to the Worker.
  2.  **Modify Route Handler (`/api/profile/interests`):**
      - Add logic to query the `USER_TOP_THEMES` KV using the authenticated `userId`. `const topThemesData = await c.env.USER_TOP_THEMES.get(userId, { type: 'json' });`
      - Handle cases where `topThemesData` is null (user not found, analysis hasn't run, etc.). Default to an empty array.
      - Add a `themes` field containing the retrieved array (the Top N theme list) to the final JSON response payload. Ensure the type definition matches the array structure `[{ themeLabel: string, clusterId: number, distance: number }, ...]`.
  3.  **Deploy:** Deploy the updated Worker code.
- **Considerations:** API response structure definition, handling empty theme lists gracefully in the UI. Decide if `distance` or `clusterId` should be included in the final API response or just `themeLabel`.

### Phase 5: Maintenance & Iteration

- **Objective:** Keep the theme analysis up-to-date and refine the process.
- **Steps:**
  1.  **Scheduled Re-runs:** Plan periodic re-runs of Phases 1-3 (e.g., weekly, monthly) to capture new users, update theme definitions/centroids based on data shifts, and refresh the Top N assignments. Automate the scripts.
  2.  **Monitoring:** Periodically review the UMAP plots and theme relevance. Do the clusters/centroids still make sense? Are the labels accurate?
  3.  **Parameter Tuning:** Revisit UMAP/HDBSCAN parameters if cluster quality degrades. Revisit N for the Top N calculation.
  4.  **Theme Refinement:** Update theme labels based on ongoing analysis.

## 5. Expected Outcome

- A robust offline process for analyzing user embeddings, discovering thematic clusters, and defining theme centroids.
- A clear mapping stored in Cloudflare KV, associating each user with their **Top N closest themes** based on proximity in the UMAP space.
- An enhanced `/api/profile/interests` endpoint that provides users with insight into the source data for their embedding _and_ the list of **multiple high-level interest themes** the system identifies as being most relevant to them, potentially indicating diverse interests.
