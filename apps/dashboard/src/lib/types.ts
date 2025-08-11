export interface AnalyticsOverview {
  users: {
    total: number;
    verified: number;
    private: number;
    weeklyGrowth: number;
    monthlyGrowth: number;
    verificationRate: string;
  };
  content: {
    posts: {
      total: number;
      weeklyNew: number;
      monthlyNew: number;
    };
    comments: {
      total: number;
      weeklyNew: number;
      averagePerPost: string;
    };
  };
  engagement: {
    totalSaves: number;
    totalPostLikes: number;
    totalCommentLikes: number;
    totalFollows: number;
    engagementRate: string;
    savesPerPost: string;
  };
  timestamp: string;
}

export interface UserGrowthData {
  period: string;
  data: Array<{
    date: string;
    count: number;
  }>;
  timestamp: string;
}

export interface ContentActivityData {
  period: string;
  posts: Array<{
    date: string;
    count: number;
  }>;
  comments: Array<{
    date: string;
    count: number;
  }>;
  timestamp: string;
}

export interface TopUser {
  userId: string;
  username: string;
  profileImage: string | null;
  verifiedType: string;
  postCount: number;
  totalSaves: number;
  totalComments: number;
}

export interface TopUsersData {
  users: TopUser[];
  timestamp: string;
}

export interface RecentActivityData {
  period: string;
  activity: {
    posts: number;
    comments: number;
    likes: number;
    follows: number;
  };
  timestamp: string;
}