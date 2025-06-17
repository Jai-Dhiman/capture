export type Post = {
  id: string;
  userId: string;
  content: string;
  type: 'post' | 'thread';
  user: {
    id: string;
    username: string;
    profileImage?: string;
    bio?: string;
    verifiedType: string;
    followersCount: number;
    followingCount: number;
    isFollowing?: boolean;
    createdAt: string;
    updatedAt: string;
  };
  media: Array<{
    id: string;
    type: string;
    storageKey: string;
    order: number;
    createdAt: string;
  }>;
  comments: Array<{
    id: string;
    content: string;
    path: string;
    depth: number;
    parentId?: string;
    isDeleted: boolean;
    user: Post['user'];
    createdAt: string;
  }>;
  hashtags?: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
  savedBy: Array<Post['user']>;
  isSaved: boolean;
  createdAt: string;
  updatedAt: string;
  _commentCount: number;
};

export type Thread = Post & {
  type: 'thread';
};
