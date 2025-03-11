import { useState, useEffect } from '@lynx-js/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <view className="App">
        <view className="App-header">
          <text>Hello Capture</text>
      </view>
      </view>
    </QueryClientProvider>
  )
}