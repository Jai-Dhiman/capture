export type Post = {
  id: string;
  userId: string;
  content: string;
  type: "post" | "thread";
  user: {
    id: string;
    username: string;
    profileImage?: string;
  };
  media: Array<{
    id: string;
    type: string;
    storageKey: string;
    order: number;
  }>;
  createdAt: string;
  updatedAt: string;
  hashtags?: Array<{
    id: string;
    name: string;
  }>;
};

export type Thread = Post & {
  type: "thread";
};
