// apps/lynx/src/index.tsx
import { root } from '@lynx-js/react'
import { MemoryRouter, Routes, Route, Navigate } from 'react-router'
import { Home } from './screens/home.jsx'
import { PageTwo } from './screens/page2.jsx'
import { Login } from './screens/auth/login.tsx'
import { App } from './App.tsx'
import { useSessionStore } from './stores/sessionStore.ts'
import './styles/main.scss'

function ProtectedRoute({ element }: { element: React.ReactElement }) {
  const { authUser, isLoading } = useSessionStore()
  
  if (isLoading) {
    return <view style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
      <text>Loading...</text>
    </view>
  }
  
  return authUser ? element : <Navigate to="/" replace />
}

root.render(
  <App>
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<ProtectedRoute element={<Home />} />} />
        <Route path="/page2" element={<ProtectedRoute element={<PageTwo />} />} />
      </Routes>
    </MemoryRouter>
  </App>
)

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}