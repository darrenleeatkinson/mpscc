import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { useAuth } from '../auth/AuthContext'
import { PERSONAS, canAccess } from '../personas'

export default function HomePage() {
  const { user, roles } = useAuth()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar tag="PROTOTYPE" />

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 24px' }}>
        <div className="fade-in" style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 700, margin: 0 }}>
            Welcome back, {user?.displayName?.split(' ')[0] ?? 'officer'}
          </h1>
          <p className="dim" style={{ marginTop: 6 }}>
            Choose a console to begin. You can only open the consoles your roles allow.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            {roles.length === 0 && <span className="chip">No roles assigned</span>}
            {roles.map((r) => (
              <span key={r} className="chip accent">
                {r}
              </span>
            ))}
            {user?.groups?.map((g) => (
              <span key={g} className="chip">
                {g}
              </span>
            ))}
          </div>
        </div>

        <div className="panel-title">Persona switcher</div>
        <div
          style={{
            display: 'grid',
            gap: 18,
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          }}
        >
          {PERSONAS.map((p) => {
            const allowed = canAccess(p, roles)
            return (
              <button
                key={p.key}
                type="button"
                disabled={!allowed}
                onClick={() => allowed && navigate(p.path)}
                className={allowed ? 'panel card-hover' : 'panel'}
                style={{
                  textAlign: 'left',
                  cursor: allowed ? 'pointer' : 'not-allowed',
                  opacity: allowed ? 1 : 0.5,
                  color: 'var(--text)',
                  font: 'inherit',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  minHeight: 210,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="badge" style={{ width: 44, height: 44, fontSize: 22 }}>
                    {p.icon}
                  </span>
                  <div>
                    <div style={{ fontWeight: 650, fontSize: '1.1rem' }}>{p.title}</div>
                    <div className="faint" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {p.subtitle}
                    </div>
                  </div>
                </div>
                <p className="dim" style={{ margin: 0, fontSize: '0.88rem', flex: 1 }}>
                  {p.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="chip">{p.phase}</span>
                  {allowed ? (
                    <span style={{ color: 'var(--accent-2)', fontWeight: 600, fontSize: '0.85rem' }}>
                      Open →
                    </span>
                  ) : (
                    <span className="chip">🔒 Needs {p.requiredRole}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </main>
    </div>
  )
}
