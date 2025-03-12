import { root } from '@lynx-js/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { Home } from './screens/home.jsx'
import { PageTwo } from './screens/page2.jsx'
import { Login } from 'screens/auth/login.tsx'
import { App } from './App.tsx'
import './styles/main.scss'

root.render(
  <App>
          <MemoryRouter>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/page2" element={<PageTwo />} />
            </Routes>
          </MemoryRouter>
  </App>
)

if (import.meta.webpackHot) {
  import.meta.webpackHot.accept()
}