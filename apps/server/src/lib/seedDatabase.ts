import { nanoid } from "nanoid";
import { faker } from "@faker-js/faker";
import type { createD1Client } from "../db";
import type { Bindings } from "../types";
import { profile, post, comment, relationship, media, hashtag, postHashtag } from "../db/schema";
import { generatePostEmbedding, storePostEmbedding } from "./embeddings";

const BATCH_SIZE = 10;

const postCaptions = [
  "Just finished my morning coffee ☕️ Ready to take on the day!",
  "Can’t believe it’s already Thursday. This week flew by!",
  "Trying out a new recipe tonight. Wish me luck! 🍝",
  "Sunsets always make everything better.",
  "Anyone else obsessed with this new album? 🔥",
  "Productivity hack: Turn off notifications for an hour. Game changer.",
  "Weekend plans: absolutely nothing and loving it.",
  "Grateful for the little things today.",
  "Caught in the rain without an umbrella—classic me.",
  "If you need me, I’ll be binge-watching my favorite show.",
  "Motivation comes and goes. Discipline gets things done.",
  "Is it too late for coffee? Asking for a friend.",
  "New blog post is live! Check it out on my profile.",
  "Why does my dog always steal my spot on the couch? 🐶",
  "Throwback to the best vacation ever.",
  "Monday mood: Let’s do this!",
  "Cooking up something special tonight.",
  "What’s everyone reading these days? Need recommendations!",
  "Just hit a new personal record at the gym! 💪",
  "Taking a break to enjoy some fresh air.",
  "Dreaming of my next adventure. Where should I go? ✈️",
  "Sometimes a quiet night in is exactly what you need. 😌",
  "Finally tackling that book I've been meaning to read. 📚",
  "Is it just me or did this week feel extra long?",
  "Trying to learn a new skill. It's harder than it looks! 😂",
  "Sunday morning vibes: coffee and pancakes. 🥞☕",
  "Spending the afternoon organizing my space. ✨",
  "That feeling when your favorite song comes on shuffle. 🎶",
  "Looking forward to catching up with friends this weekend.",
  "A little bit of nature therapy always helps. 🌳",
  "Exploring the city streets today. So much to see! 🏙️",
  "Just baked some cookies. The house smells amazing! 🍪",
  "Planning my next big project. Feeling inspired!",
  "Nothing beats a good podcast during the commute. 🎧",
  "Lazy Sunday in full effect. 😴",
  "Trying to eat healthier this week. So far, so good!",
  "Discovered a hidden gem cafe in my neighborhood. ☕️📍",
  "That feeling of accomplishment after a productive day. ✅",
  "Movie night! Any suggestions for a good comedy? 🎬",
  "Working from home has its perks... and distractions. 😅",
  "Golden hour light is just magical. ✨",
  "Learning to play a new instrument. It's a challenge! 🎸",
  "A simple walk can clear the mind. 🚶‍♀️",
  "Decluttering my digital life. Feels good!",
  "Anyone else already thinking about the holidays? 🎄",
  "The best ideas often come when you least expect them.",
  "Re-watching a classic movie tonight.",
  "Spending quality time with family is everything. ❤️",
  "Trying to incorporate more mindfulness into my day. 🙏",
  "Soaking up the last bit of sunshine. ☀️",
];

const cloudflareImageIds = [
  "fd614351-7bdb-4898-7b99-9ee4f79e3700",
  "ebeaae49-5880-4e07-0b3a-33660a9d5e00",
  "b6943add-002e-467a-11f0-eb04f2894a00",
  "eb0b1ba1-95b2-4607-5278-deefb44f4e00",
  "ec3456eb-e0ef-40ca-870e-c3cf89793600",
  "354bf58b-880a-418d-d1b5-b2ef3e7d0900",
  "558fc1fa-e0ca-4a24-cc80-33f7041a3e00",
  "86d4a478-fa99-4a45-1702-256c5199b600",
  "acf35897-2084-4092-6717-2abf8c38a200",
  "313f8ec1-5363-4da8-701e-1e9a4e45ce00",
  "c6508313-0548-43e4-da5c-71ed969ed400",
  "6b69a72c-4cf0-4584-9cf1-82374f738f00",
  "82ac1696-e0e3-40f8-3c32-00932cbd1b00",
  "6beaa687-0d02-4ff1-7877-baea7bdb4a00",
  "7d907593-c14f-47c4-dc9d-6ea908ced900",
  "6e391c56-c1f3-4748-c639-39880d900600",
  "c544b406-3f08-43ce-7f0e-a79cbde13c00",
  "32a15ecb-14c0-4bef-7049-147d9c3b2100",
  "3285d359-adc0-4ccb-39e4-be0ac2a0e900",
  "b6b02750-6198-4ce6-47a6-ddc7ffad3d00",
  "00f5d0dd-1225-46c7-41db-c4bfa9b16200",
  "9c3c5f57-ed3b-4e28-5304-27a4c828ed00",
  "38a5032e-75e2-4e39-9f60-ba4f86f59100",
  "ce6bd285-33e3-4374-f717-8c95d54b4500",
  "05742317-255a-486a-b8c3-0892fd604a00",
  "ac4e0814-f3ca-482f-d1c6-801f8ed95c00",
  "34241a14-35e7-4ff3-8bdc-cefbfe8b9e00",
  "64595be6-8a60-4a81-0be1-713c1d1eb600",
];

async function batchInsert(db: any, table: any, rows: any[]) {
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
  commentsPerPost = 3
) {
  const users = Array.from({ length: userCount }, () => ({
    id: nanoid(),
    userId: nanoid(),
    username: faker.internet
      .username()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ""),
    profileImage: cloudflareImageIds[Math.floor(Math.random() * cloudflareImageIds.length)],
    bio: faker.lorem.sentence(),
    verifiedType: faker.helpers.arrayElement(["none", "verified"]),
    isPrivate: faker.datatype.boolean() ? 1 : 0,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
  }));

  await batchInsert(db, profile, users);

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

  const posts = [];
  const postHashtags = [];
  const mediaItems = [];
  const postHashtagMap: Record<string, string[]> = {};

  for (const user of users) {
    for (let i = 0; i < postsPerUser; i++) {
      const postId = nanoid();
      const postType = faker.helpers.arrayElement(["post", "thread"]);

      posts.push({
        id: postId,
        userId: user.userId,
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
      if (postType === "post") {
        mediaCount = Math.floor(Math.random() * 4) + 1;
      }

      for (let k = 0; k < mediaCount; k++) {
        mediaItems.push({
          id: nanoid(),
          userId: user.userId,
          postId,
          type: "image",
          storageKey: cloudflareImageIds[Math.floor(Math.random() * cloudflareImageIds.length)],
          order: k,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  await batchInsert(db, post, posts);
  await batchInsert(db, postHashtag, postHashtags);
  await batchInsert(db, media, mediaItems);

  // ── seed post vectors ──
  await Promise.all(
    posts.map(async (p) => {
      try {
        const tagsForPost = postHashtagMap[p.id] || [];
        const vecData = await generatePostEmbedding(p.id, p.content, tagsForPost, env.AI);
        await storePostEmbedding(vecData, env.POST_VECTORS, env.VECTORIZE);
      } catch (err) {
        console.error(`seedDatabase> embedding failed for post ${p.id}:`, err);
      }
    })
  );

  const comments = [];
  for (const p of posts) {
    // Track comment indices for each post
    let topLevelIndex = 1;

    for (let i = 0; i < commentsPerPost; i++) {
      const commentId = nanoid();
      const randomUser = users[Math.floor(Math.random() * users.length)];
      const path = topLevelIndex.toString().padStart(2, "0");

      comments.push({
        id: commentId,
        postId: p.id,
        userId: randomUser.userId,
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
        const replyUser = users[Math.floor(Math.random() * users.length)];
        const replyPath = `${path}.${(j + 1).toString().padStart(2, "0")}`;

        comments.push({
          id: replyId,
          postId: p.id,
          userId: replyUser.userId,
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

  const relationships = [];
  for (const user of users) {
    const followCount = 5 + Math.floor(Math.random() * 10);
    const potentialFollowees = users.filter((u) => u.userId !== user.userId);

    const shuffled = [...potentialFollowees].sort(() => 0.5 - Math.random());
    const selectedFollowees = shuffled.slice(0, followCount);

    for (const followee of selectedFollowees) {
      relationships.push({
        id: nanoid(),
        followerId: user.userId,
        followedId: followee.userId,
        createdAt: faker.date.recent().toISOString(),
      });
    }
  }

  await batchInsert(db, relationship, relationships);

  return {
    users: users.length,
    hashtags: hashtags.length,
    posts: posts.length,
    comments: comments.length,
    relationships: relationships.length,
  };
}
