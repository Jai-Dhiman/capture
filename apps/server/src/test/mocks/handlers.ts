import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('*/auth/v1/user', () => {
    return HttpResponse.json({
      data: {
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
        },
      },
    })
  }),
]
