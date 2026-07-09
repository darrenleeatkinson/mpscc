import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Clock from './Clock'

interface TopBarProps {
  tag?: string
}

export default function TopBar({ tag }: TopBarProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <header className="topbar">
      <div className="brand" role="button" onClick={() => navigate('/home')} style={{ cursor: 'pointer' }}>
        <span className="badge">🛡️</span>
        <span>
          MPSCC
          <small>Command &amp; Control</small>
        </span>
      </div>

      {tag && <span className="pill">{tag}</span>}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Clock />
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="chip">
              <span className="dim">{user.displayName}</span>
            </span>
            <button className="btn danger" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
