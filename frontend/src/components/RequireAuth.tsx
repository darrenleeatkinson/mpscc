import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Role } from '../auth/types'

// Guards a route: requires a token, and optionally a role (ADMIN always allowed).
export default function RequireAuth({
  children,
  role,
}: {
  children: ReactNode
  role?: Role
}) {
  const { token, ready, roles } = useAuth()
  const location = useLocation()

  // Wait for initial /me validation before deciding.
  if (!ready) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <span className="dim">Loading…</span>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (role && !(roles.includes('ADMIN') || roles.includes(role))) {
    // Authenticated but lacks the role — send back to the shell.
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}
