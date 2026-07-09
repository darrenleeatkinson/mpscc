import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import Clock from '../components/Clock'

const DEMO_USERS = ['responder', 'dispatcher', 'planner', 'admin']

export default function LoginPage() {
  const { login, token, ready } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Already signed in? Skip the login screen.
  if (ready && token) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : '/home'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(username.trim(), password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from !== '/login' ? from : '/home', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid username or password.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Unable to reach the sign-in service. Please try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="topbar">
        <div className="brand">
          <span className="badge">🛡️</span>
          <span>
            MPSCC
            <small>Command &amp; Control</small>
          </span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <Clock />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
        }}
      >
        <div className="panel fade-in" style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div
              className="badge"
              style={{ width: 56, height: 56, fontSize: 26, margin: '0 auto 14px' }}
            >
              🛡️
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              Sign in to MPSCC
            </h1>
            <p className="dim" style={{ marginTop: 6 }}>
              Metropolitan Police Service Command &amp; Control
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 14 }}>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                className="input"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. dispatcher"
                required
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="error-banner fade-in" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <button
              className="btn primary big"
              type="submit"
              style={{ width: '100%' }}
              disabled={busy || !username || !password}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px solid var(--hair)',
            }}
          >
            <div className="panel-title">Demo credentials</div>
            <p className="dim" style={{ fontSize: '0.82rem', margin: '0 0 10px' }}>
              Any user below with password{' '}
              <code className="mono" style={{ color: 'var(--accent-2)' }}>
                police123
              </code>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DEMO_USERS.map((u) => (
                <button
                  key={u}
                  type="button"
                  className="chip"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setUsername(u)
                    setPassword('police123')
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
