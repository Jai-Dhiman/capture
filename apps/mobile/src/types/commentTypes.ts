export type User = {
  id: string
  username: string
  profileImage?: string
}

export type Comment = {
  id: string
  content: string
  path: string
  depth: number
  createdAt: string
  isDeleted?: boolean
  user?: User
  optimistic?: boolean
  parentId?: string
}

export type CommentConnection = {
  comments: Comment[]
  totalCount: number
  hasNextPage: boolean
  nextCursor?: string
}

export type CommentSortOption = 'newest' | 'oldest' | 'popular'
