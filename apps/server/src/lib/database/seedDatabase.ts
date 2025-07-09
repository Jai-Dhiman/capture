import type { createD1Client } from '@/db';
import {
  blockedUser,
  comment,
  commentLike,
  hashtag,
  media,
  notification,
  post,
  postHashtag,
  postLike,
  profile,
  relationship,
  users,
} from '@/db/schema';
import type { Bindings } from '@/types';
import { faker } from '@faker-js/faker';
import { nanoid } from 'nanoid';
import { createEmbeddingService } from '../ai/embeddingService';
import { createCachingService } from '../cache/cachingService';
import { createQdrantClient } from '../infrastructure/qdrantClient';

const BATCH_SIZE = 10;

const postCaptions = [
  'Just finished my morning coffee ☕️ Ready to take on the day!',
  "Can't believe it's already Thursday. This week flew by!",
  'Trying out a new recipe tonight. Wish me luck! 🍝',
  'Sunsets always make everything better.',
  'Anyone else obsessed with this new album? 🔥',
  'Productivity hack: Turn off notifications for an hour. Game changer.',
  'Weekend plans: absolutely nothing and loving it.',
  'Grateful for the little things today.',
  'Caught in the rain without an umbrella—classic me.',
  "If you need me, I'll be binge-watching my favorite show.",
  'Motivation comes and goes. Discipline gets things done.',
  'Is it too late for coffee? Asking for a friend.',
  'New blog post is live! Check it out on my profile.',
  'Why does my dog always steal my spot on the couch? 🐶',
  'Throwback to the best vacation ever.',
  "Monday mood: Let's do this!",
  'Cooking up something special tonight.',
  "What's everyone reading these days? Need recommendations!",
  'Just hit a new personal record at the gym! 💪',
  'Taking a break to enjoy some fresh air.',
  'Dreaming of my next adventure. Where should I go? ✈️',
  'Sometimes a quiet night in is exactly what you need. 😌',
  "Finally tackling that book I've been meaning to read. 📚",
  'Is it just me or did this week feel extra long?',
  "Trying to learn a new skill. It's harder than it looks! 😂",
  'Sunday morning vibes: coffee and pancakes. 🥞☕',
  'Spending the afternoon organizing my space. ✨',
  'That feeling when your favorite song comes on shuffle. 🎶',
  'Looking forward to catching up with friends this weekend.',
  'A little bit of nature therapy always helps. 🌳',
  'Exploring the city streets today. So much to see! 🏙️',
  'Just baked some cookies. The house smells amazing! 🍪',
  'Planning my next big project. Feeling inspired!',
  'Nothing beats a good podcast during the commute. 🎧',
  'Lazy Sunday in full effect. 😴',
  'Trying to eat healthier this week. So far, so good!',
  'Discovered a hidden gem cafe in my neighborhood. ☕️📍',
  'That feeling of accomplishment after a productive day. ✅',
  'Movie night! Any suggestions for a good comedy? 🎬',
  'Working from home has its perks... and distractions. 😅',
  'Golden hour light is just magical. ✨',
  "Learning to play a new instrument. It's a challenge! 🎸",
  'A simple walk can clear the mind. 🚶‍♀️',
  'Decluttering my digital life. Feels good!',
  'Anyone else already thinking about the holidays? 🎄',
  'The best ideas often come when you least expect them.',
  'Re-watching a classic movie tonight.',
  'Spending quality time with family is everything. ❤️',
  'Trying to incorporate more mindfulness into my day. 🙏',
  'Soaking up the last bit of sunshine. ☀️',
];

// R2 storage keys for seeded images (these should be pre-uploaded to R2)
const r2StorageKeys = [
  'seed-images/photo-1.jpg',
  'seed-images/photo-2.jpg',
  'seed-images/photo-3.jpg',
  'seed-images/photo-4.jpg',
  'seed-images/photo-5.jpg',
  'seed-images/photo-6.jpg',
  'seed-images/photo-7.jpg',
  'seed-images/photo-8.jpg',
  'seed-images/photo-9.jpg',
  'seed-images/photo-10.jpg',
  'seed-images/photo-11.jpg',
  'seed-images/photo-12.jpg',
  'seed-images/photo-13.jpg',
  'seed-images/photo-14.jpg',
  'seed-images/photo-15.jpg',
  'seed-images/photo-16.jpg',
  'seed-images/photo-17.jpg',
  'seed-images/photo-18.jpg',
  'seed-images/photo-19.jpg',
  'seed-images/photo-20.jpg',
  'seed-images/photo-21.jpg',
  'seed-images/photo-22.jpg',
  'seed-images/photo-23.jpg',
  'seed-images/photo-24.jpg',
  'seed-images/photo-25.jpg',
  'seed-images/photo-26.jpg',
  'seed-images/photo-27.jpg',
  'seed-images/photo-28.jpg',
];

async function batchInsert(db: ReturnType<typeof createD1Client>, table: any, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await db.insert(table).values(batch);
  }
}

export async function seedDatabase(
  db: ReturnType<typeof createD1Client>,
  env: Bindings,
  userCount = 50,
  postsPerUser = 5,
  commentsPerPost = 3,
) {
  // 1. Create users first (required for foreign keys)
  const seedUsers = Array.from({ length: userCount }, () => {
    const userId = nanoid();
    return {
      id: userId,
      email: faker.internet.email().toLowerCase(),
      emailVerified: 1,
      createdAt: faker.date.past().toISOString(),
      updatedAt: faker.date.recent().toISOString(),
    };
  });

  await batchInsert(db, users, seedUsers);

  // 2. Create profile images as proper media records (one per user)
  const profileImageMedia = seedUsers.map((user) => ({
    id: nanoid(),
    userId: user.id,
    postId: null, // Profile images don't belong to posts
    draftPostId: null,
    type: 'image',
    storageKey: r2StorageKeys[Math.floor(Math.random() * r2StorageKeys.length)],
    order: 0,
    createdAt: new Date().toISOString(),
  }));

  await batchInsert(db, media, profileImageMedia);

  // 3. Create profiles (one per user) - now referencing media IDs
  const seedProfiles = seedUsers.map((user, index) => ({
    id: nanoid(),
    userId: user.id, // Reference to users.id
    username: faker.internet
      .username()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ''),
    profileImage: profileImageMedia[index].id, // Reference to media record ID
    bio: faker.lorem.sentence(),
    verifiedType: faker.helpers.arrayElement(['none', 'verified']),
    isPrivate: faker.datatype.boolean() ? 1 : 0,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
  }));

  await batchInsert(db, profile, seedProfiles);

  // 4. Create hashtags
  const hashtagNames: string[] = [];
  while (hashtagNames.length < 20) {
    const tag = `#${faker.word.sample().toLowerCase()}`;
    if (!hashtagNames.includes(tag)) {
      hashtagNames.push(tag);
    }
  }

  const hashtags = hashtagNames.map((name) => ({
    id: nanoid(),
    name,
    createdAt: new Date().toISOString(),
  }));

  await batchInsert(db, hashtag, hashtags);

  // 5. Create posts
  const posts = [];
  const postHashtags = [];
  const postMediaItems: any[] = [];
  const postHashtagMap: Record<string, string[]> = {};

  for (const user of seedUsers) {
    for (let i = 0; i < postsPerUser; i++) {
      const postId = nanoid();
      const postType = faker.helpers.arrayElement(['post', 'thread']);

      posts.push({
        id: postId,
        userId: user.id, // Reference users.id (not profile.userId)
        content: postCaptions[Math.floor(Math.random() * postCaptions.length)],
        type: postType,
        createdAt: faker.date.recent().toISOString(),
      });

      const postHashtagCount = Math.floor(Math.random() * 4);
      for (let j = 0; j < postHashtagCount; j++) {
        const randomHashtag = hashtags[Math.floor(Math.random() * hashtags.length)];
        postHashtags.push({
          postId,
          hashtagId: randomHashtag.id,
          createdAt: new Date().toISOString(),
        });
        if (!postHashtagMap[postId]) {
          postHashtagMap[postId] = [];
        }
        postHashtagMap[postId].push(randomHashtag.name);
      }

      let mediaCount = 0;
      if (postType === 'post') {
        mediaCount = Math.floor(Math.random() * 4) + 1;
      }

      for (let k = 0; k < mediaCount; k++) {
        postMediaItems.push({
          id: nanoid(),
          userId: user.id, // Reference users.id
          postId,
          type: 'image',
          storageKey: r2StorageKeys[Math.floor(Math.random() * r2StorageKeys.length)],
          order: k,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  await batchInsert(db, post, posts);
  await batchInsert(db, postHashtag, postHashtags);
  await batchInsert(db, media, postMediaItems);

  // 5. Generate post embeddings with enhanced post type detection and optimized model selection
  // Uses voyage-3.5-lite for text-only posts and voyage-multimodal-3 for image/multimodal posts
  let successCount = 0;
  let failureCount = 0;
  const postTypeStats = {
    text: 0,
    image: 0,
    multimodal: 0,
  };

  // Only generate embeddings if VOYAGE_API_KEY is available
  if (env.VOYAGE_API_KEY) {
    console.log(`🚀 Starting enhanced embedding generation for ${posts.length} posts...`);

    try {
      const cachingService = createCachingService(env);
      const embeddingService = createEmbeddingService(env, cachingService);
      const qdrantClient = createQdrantClient(env);

      // Process embeddings in smaller batches to avoid overwhelming the AI service
      const EMBEDDING_BATCH_SIZE = 5;
      for (let i = 0; i < posts.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = posts.slice(i, i + EMBEDDING_BATCH_SIZE);
        await Promise.all(
          batch.map(async (p) => {
            try {
              const tagsForPost = postHashtagMap[p.id] || [];
              
              // Determine post type based on media content
              const postMediaForPost = postMediaItems.filter((m: any) => m.postId === p.id);
              const hasMedia = postMediaForPost.length > 0;
              const hasImageMedia = postMediaForPost.some((m: any) => m.type === 'image');
              
              let postType: 'text' | 'image' | 'multimodal';
              if (!hasMedia) {
                postType = 'text';
              } else if (hasImageMedia && p.content.trim().length > 0) {
                postType = 'multimodal';
              } else if (hasImageMedia) {
                postType = 'image';
              } else {
                postType = 'multimodal'; // Other media types
              }
              
              // Track post type statistics
              postTypeStats[postType]++;
              
              // Prepare media data for future enhancement (matching queue processing structure)
              let mediaData = null;
              if (postType === 'image' || postType === 'multimodal') {
                mediaData = {
                  totalItems: postMediaForPost.length,
                  imageItems: postMediaForPost.filter((m: any) => m.type === 'image'),
                  hasImages: hasImageMedia,
                  storageKeys: postMediaForPost.map((m: any) => m.storageKey),
                };
              }
              
              // Generate embedding with enhanced parameters for optimal model selection
              const { embeddingResult, metadata } = await embeddingService.generatePostEmbedding(
                p.id,
                p.content,
                tagsForPost,
                p.userId,
                false, // isPrivate
                'voyage', // provider
                postType, // Enhanced: pass post type for optimal model selection
              );

              await embeddingService.storeEmbedding(p.id, embeddingResult, metadata, qdrantClient);
              successCount++;
              
              // Log post type and media data for monitoring
              if (postType !== 'text' && mediaData) {
                console.log(`📸 ${postType} post ${p.id}: ${mediaData.totalItems} media items (${mediaData.imageItems.length} images)`);
              }
            } catch (err) {
              failureCount++;
              console.error(`❌ Embedding failed for post ${p.id}:`, err);
            }
          }),
        );
        // Add a small delay between batches to be gentle on the AI service
        if (i + EMBEDDING_BATCH_SIZE < posts.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      console.log(
        `🎯 Enhanced embedding generation complete: ${successCount} successful, ${failureCount} failed`,
      );
      console.log('📊 Post type breakdown:', postTypeStats);
      console.log(`🔤 Text posts using voyage-3.5-lite: ${postTypeStats.text}`);
      console.log(`🖼️ Image/multimodal posts using voyage-multimodal-3: ${postTypeStats.image + postTypeStats.multimodal}`);
    } catch (err) {
      console.error('❌ Failed to initialize embedding services:', err);
      console.log('⚠️ Continuing without embeddings...');
    }
  } else {
    console.log('⚠️ VOYAGE_API_KEY not found - skipping embedding generation');
  }

  // 6. Create comments
  const comments = [];
  for (const p of posts) {
    let topLevelIndex = 1;

    for (let i = 0; i < commentsPerPost; i++) {
      const commentId = nanoid();
      const randomUser = seedUsers[Math.floor(Math.random() * seedUsers.length)];
      const path = topLevelIndex.toString().padStart(2, '0');

      comments.push({
        id: commentId,
        postId: p.id,
        userId: randomUser.id, // Reference users.id
        parentId: null,
        content: faker.lorem.sentence(),
        path,
        depth: 0,
        isDeleted: 0,
        createdAt: faker.date.recent().toISOString(),
      });

      const replyCount = Math.floor(Math.random() * 3);
      for (let j = 0; j < replyCount; j++) {
        const replyId = nanoid();
        const replyUser = seedUsers[Math.floor(Math.random() * seedUsers.length)];
        const replyPath = `${path}.${(j + 1).toString().padStart(2, '0')}`;

        comments.push({
          id: replyId,
          postId: p.id,
          userId: replyUser.id, // Reference users.id
          parentId: commentId,
          content: faker.lorem.sentence(),
          path: replyPath,
          depth: 1,
          isDeleted: 0,
          createdAt: faker.date.recent().toISOString(),
        });
      }

      topLevelIndex++;
    }
  }

  await batchInsert(db, comment, comments);

  // 7. Create relationships
  const relationships = [];
  for (const user of seedUsers) {
    const followCount = 5 + Math.floor(Math.random() * 10);
    const potentialFollowees = seedUsers.filter((u) => u.id !== user.id);

    const shuffled = [...potentialFollowees].sort(() => 0.5 - Math.random());
    const selectedFollowees = shuffled.slice(0, followCount);

    for (const followee of selectedFollowees) {
      relationships.push({
        id: nanoid(),
        followerId: user.id, // Reference users.id
        followedId: followee.id, // Reference users.id
        createdAt: faker.date.recent().toISOString(),
      });
    }
  }

  await batchInsert(db, relationship, relationships);

  return {
    users: seedUsers.length,
    profiles: seedProfiles.length,
    hashtags: hashtags.length,
    posts: posts.length,
    media: profileImageMedia.length + postMediaItems.length,
    comments: comments.length,
    relationships: relationships.length,
    embeddings: {
      successful: successCount,
      failed: failureCount,
      postTypes: postTypeStats,
    },
  };
}
