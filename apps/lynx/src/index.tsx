import { root } from '@lynx-js/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { Home } from './screens/home.jsx'
import { PageTwo } from './screens/page2.jsx'
import { Login } from 'screens/auth/login.tsx'
import { SessionProvider } from 'lib/SessionProvider.tsx'
import { AuthWrapper } from 'components/auth/AuthWrapper.tsx'
import './styles/main.scss'
import { BackgroundSession } from 'lib/BackgroundSession.tsx'

root.render(
  <BackgroundSession>
    <SessionProvider>
      <AuthWrapper>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/page2" element={<PageTwo />} />
          </Routes>
        </MemoryRouter>
      </AuthWrapper>
    </SessionProvider>
  </BackgroundSession>
)

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}