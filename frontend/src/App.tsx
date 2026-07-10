import { Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import ResponderConsolePage from './pages/ResponderConsolePage'
import DispatcherConsolePage from './pages/DispatcherConsolePage'
import PlannerConsolePage from './pages/PlannerConsolePage'

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
            <ResponderConsolePage />
          </RequireAuth>
        }
      />
      <Route
        path="/dispatch"
        element={
          <RequireAuth role="DISPATCHER">
            <DispatcherConsolePage />
          </RequireAuth>
        }
      />
      <Route
        path="/planner"
        element={
          <RequireAuth role="PLANNER">
            <PlannerConsolePage />
          </RequireAuth>
        }
      />

      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  )
}
