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
  user?: User
  optimistic?: boolean
}

export type CommentConnection = {
  comments: Comment[]
  totalCount: number
  hasNextPage: boolean
}

export type CommentSortOption = 'newest' | 'oldest'
