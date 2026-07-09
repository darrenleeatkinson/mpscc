import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import PersonaPlaceholder from './pages/PersonaPlaceholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/home"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />

      <Route
        path="/responder"
        element={
          <RequireAuth role="RESPONDER">
            <PersonaPlaceholder personaKey="responder" />
          </RequireAuth>
        }
      />
      <Route
        path="/dispatch"
        element={
          <RequireAuth role="DISPATCHER">
            <PersonaPlaceholder personaKey="dispatch" />
          </RequireAuth>
        }
      />
      <Route
        path="/planner"
        element={
          <RequireAuth role="PLANNER">
            <PersonaPlaceholder personaKey="planner" />
          </RequireAuth>
        }
      />

      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}
