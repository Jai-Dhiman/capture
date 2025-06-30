# Capture: Recommendation System Architecture

## Overview

This document outlines the architecture of the recommendation system for the Capture social media platform. It details the current implementation, which is focused on privacy, user control, and content relevance, and describes the planned roadmap for future enhancements, including multi-modal understanding and user-tuned recommendations.

## Table of Contents

1.  [Current System: The Discovery Feed](#part-1-current-system-the-discovery-feed)
    - [1.1 Guiding Principles](#11-guiding-principles)
    - [1.2 System Architecture](#12-system-architecture)
    - [1.3 "Seen Posts" Filter](#13-seen-posts-filter)
    - [1.4 Enhanced Scoring System](#14-enhanced-scoring-system)
2.  [Future Enhancements: The Roadmap](#part-2-future-enhancements-the-roadmap)
    - [2.1 Multi-Modal Embeddings](#21-multi-modal-embeddings)
    - [2.2 UMAP-Powered User Tuning](#22-umap-powered-user-tuning)

---

## Part 1: Current System: The Discovery Feed

The current system is designed to provide a high-quality content discovery experience that respects user privacy and avoids addictive patterns. It is a secondary feed, intended for exploring content beyond a user's direct follows.

### 1.1 Guiding Principles

-   **Privacy by Design**: The algorithm learns from a user's explicit, on-platform actions (e.g., saved posts) without requiring any PII, location, or off-platform tracking.
-   **User Control**: The system includes mechanisms to prevent repetitive content and is designed to incorporate explicit user feedback in the future.
-   **Anti-Addiction**: The scoring model intentionally includes signals for novelty and diversity to prevent "filter bubbles" and avoids engagement-maximizing patterns that create a sense of FOMO.

### 1.2 System Architecture

The recommendation process is triggered when a user requests their `discoverFeed`.

1.  **Fetch Context**: The system fetches the user's pre-calculated interest vector and a list of posts they have recently seen.
2.  **Vector Search**: A query is sent to Qdrant to find posts that are semantically similar to the user's interest vector. This query is filtered to exclude seen posts, blocked users, and private content from non-followed users.
3.  **Build User Context**: A `UserContext` object is built by analyzing the user's recent saved posts to understand their implicit preferences for content types and topics.
4.  **Score & Rank**: Each post from the search results is passed through an enhanced scoring engine, which calculates a final score based on multiple signals. The posts are then ranked by this score.
5.  **Paginate & Return**: The final, ranked list is paginated and returned to the user.

### 1.3 "Seen Posts" Filter

To ensure the feed remains fresh, the system filters out content the user has already seen.

-   **Tracking**: A lightweight `seenPostLog` table in the D1 database logs when a user sees a post. A `markPostsAsSeen` GraphQL mutation is called from the client to populate this log.
-   **Filtering**: The `discoverFeed` resolver fetches the IDs of all posts seen by the user in the last 30 days. These IDs are then passed to the Qdrant search query using a `must_not` filter, which efficiently excludes them from the results at the source.
-   **Maintenance**: To keep the `seenPostLog` table efficient, a cleanup job runs periodically to purge records older than 30 days.

### 1.4 Enhanced Scoring System

Instead of relying on simple similarity or raw popularity, the system uses a multi-faceted scoring model.

#### User Context

The `buildUserContext` function generates a profile of the user's recent tastes:

-   **Natural Content Preferences**: Calculates a user's affinity for different media types (`text`, `image`, `video`) based on their interaction history.
-   **Recent Topics**: Extracts keywords and hashtags from recent interactions to build a set of topics the user is currently interested in. This is used to promote diversity.

#### Content Signals & Scoring Formula

Each post is evaluated on several signals, which are combined in a weighted formula:

`Score = (Similarity * 50%) + (Engagement * 35%) + (Content Pref * 10%) + (Novelty * 5%)`

-   **Vector Similarity (50%)**: The core cosine similarity score from Qdrant.
-   **Engagement Rate (35%)**: A measure of engagements (saves, comments) per hour. This prioritizes content that is currently trending, not just popular overall.
-   **Content Type Affinity (10%)**: A score based on how well the post's media type matches the user's `Natural Content Preferences`.
-   **Novelty (5%)**: A combined bonus for **Temporal Relevance** (a gentle boost for newer content) and a **Diversity Bonus** (a boost for posts with topics not in the user's `RecentTopics`).

---

## Part 2: Future Enhancements: The Roadmap

The current system provides a strong foundation. The following planned enhancements will further improve recommendation quality and user control.

### 2.1 Multi-Modal Embeddings

-   **Goal**: To significantly improve the quality of the core `similarity` signal by allowing the algorithm to understand the visual content of posts, not just their text.
-   **Mechanism**:
    1.  When a post is created, the system will generate an embedding for its text content.
    2.  If the post contains images or videos, it will use multi-modal AI models (e.g., CLIP) to generate separate visual embeddings for that media.
    3.  These individual embeddings will be combined into a single, comprehensive vector that represents the entire post. This final vector is then stored in Qdrant.
-   **Impact**: Recommendations will become much more accurate, as the system will be able to match users with visually similar content even if the text descriptions are sparse or different.

### 2.2 UMAP-Powered User Tuning

-   **Goal**: To give users transparent and explicit control over their recommendations, moving beyond implicit signals.
-   **Mechanism (Phase A - Offline Analysis)**:
    1.  Periodically, an offline process will run the UMAP algorithm on all user interest vectors.
    2.  This process will identify high-level thematic clusters within the user base (e.g., "Travel Photography," "Tech News," "Finance & Stocks").
    3.  For each user, the system will calculate their proximity to these theme clusters and store their "Top 3" or "Top 5" most relevant themes in a new `USER_TOP_THEMES` KV store.
-   **Mechanism (Phase B - Integration)**:
    1.  The `buildUserContext` function will be updated to fetch the user's Top N themes.
    2.  A new signal, `themeRelevance`, will be added to our scoring engine. If a post's content maps to one of the user's top themes, it will receive a score boost.
-   **Impact**: This unlocks a powerful new feature set. The UI can display a user's identified interest themes, and they can be given controls to say "show me more of this theme" or "less of this," which would directly adjust the weights in their personal recommendation score. This is the ultimate implementation of our "User Control" principle.
