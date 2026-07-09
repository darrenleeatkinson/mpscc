import { Link } from 'react-router-dom'
import TopBar from '../components/TopBar'
import { PERSONAS } from '../personas'

export default function PersonaPlaceholder({ personaKey }: { personaKey: string }) {
  const persona = PERSONAS.find((p) => p.key === personaKey)!

  return (
    <div style={{ minHeight: '100vh' }}>
      <TopBar tag={persona.title.toUpperCase()} />

      <main style={{ maxWidth: 820, margin: '0 auto', padding: '48px 24px' }}>
        <div className="panel fade-in" style={{ textAlign: 'center', padding: '48px 32px' }}>
          <div
            className="badge"
            style={{ width: 64, height: 64, fontSize: 30, margin: '0 auto 18px' }}
          >
            {persona.icon}
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>{persona.title}</h1>
          <p className="dim" style={{ marginTop: 8, marginBottom: 20 }}>
            {persona.description}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 28 }}>
            <span className="chip accent">Coming in {persona.phase}</span>
          </div>
          <Link to="/home" className="btn primary" style={{ textDecoration: 'none' }}>
            ← Back to consoles
          </Link>
        </div>
      </main>
    </div>
  )
}
