import { createD1Client } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import type { Bindings } from "@/types";
import { Hono } from "hono";

const deeplinkRouter = new Hono<{ Bindings: Bindings }>();

deeplinkRouter.get("/:id", async (c) => {
  const postId = c.req.param("id");
  const db = createD1Client(c.env);
  const post = await db.select().from(schema.post).where(eq(schema.post.id, postId)).get();
  const description = post?.content.slice(0, 200) ?? "";
  const shareLink = `capture://post/${postId}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta property="og:title" content="Capture Post" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${c.req.url}" />
  <meta http-equiv="refresh" content="0;URL='${shareLink}'"/>
</head>
<body>Redirecting...</body>
</html>`;
  return c.html(html);
});

export default deeplinkRouter;
