import { useMutation } from '@tanstack/react-query'
import { API_URL } from '@env'
import { supabase } from 'lib/supabase'

export const useCreatePost = () => {
  return useMutation({
    mutationFn: async ({ content, mediaIds }: { content: string; mediaIds: string[] }) => {
      console.log('Creating post with content:', content, 'mediaIds:', mediaIds)

      const session = await supabase.auth.getSession()
      if (!session.data.session?.access_token) {
        throw new Error('No auth token available')
      }

      try {
        const response = await fetch(`${API_URL}/graphql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({
            query: `
              mutation CreatePost($input: PostInput!) {
                createPost(input: $input) {
                  id
                  content
                  media {
                    id
                    url
                  }
                }
              }
            `,
            variables: {
              input: {
                content,
                mediaIds,
              },
            },
          }),
        })

        console.log('GraphQL response status:', response.status)
        const data = await response.json()
        console.log('GraphQL response data:', data)

        if (data.errors) {
          console.error('GraphQL Errors:', data.errors)
          throw new Error(data.errors[0].message)
        }
        return data.data.createPost
      } catch (error) {
        console.error('Post creation error:', error)
        throw error
      }
    },
  })
}
