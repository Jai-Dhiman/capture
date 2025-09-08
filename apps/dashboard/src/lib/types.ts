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

// Feedback System Types

export interface FeedbackCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  priorityLevel: number;
  ticketCount: number;
  createdAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  username: string;
  profileImage?: string;
  bio?: string;
  verifiedType: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceInfo {
  platform?: string;
  osVersion?: string;
  appVersion?: string;
  deviceModel?: string;
  screenSize?: string;
}

export interface FeedbackResponse {
  id: string;
  responder: Profile;
  responderType: 'USER' | 'ADMIN' | 'SYSTEM';
  message: string;
  isInternal: boolean;
  createdAt: string;
}

export interface FeedbackAttachment {
  id: string;
  media: {
    id: string;
    type: string;
    storageKey: string;
  };
  uploadedBy: Profile;
  description?: string;
  createdAt: string;
}

export interface FeedbackTicket {
  id: string;
  user: Profile;
  category: FeedbackCategory;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  type: 'FEEDBACK' | 'BUG_REPORT' | 'FEATURE_REQUEST' | 'SUPPORT';
  appVersion?: string;
  deviceInfo?: DeviceInfo;
  responses: FeedbackResponse[];
  attachments: FeedbackAttachment[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  responseCount: number;
  lastResponseAt?: string;
}

export interface AdminTicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  urgentCount: number;
  avgResponseTime?: number;
}

export interface AdminTicketConnection {
  tickets: FeedbackTicket[];
  totalCount: number;
  hasNextPage: boolean;
  stats: AdminTicketStats;
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  type?: string;
  categoryId?: string;
  search?: string;
}