import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client'

interface WatchEvent {
  id: number
  incidentId: number
  incidentRef: string
  author: string
  noteText: string
  noteType: string
  createdAt: string
  crimeType: string
  priority: number
  address: string
  postcode: string
  incidentStatus: string
  latitude: number
  longitude: number
  officers: string | null
}

const PRIO_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#3b82f6', 5: '#6b7280',
}

const NOTE_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  FIRST_CONTACT:  { label: 'First Contact', color: '#8b5cf6' },
  DISPATCH:       { label: 'Dispatched',    color: '#22c55e' },
  EN_ROUTE:       { label: 'En Route',      color: '#06b6d4' },
  ON_SCENE:       { label: 'On Scene',      color: '#3b82f6' },
  SCENE_UPDATE:   { label: 'Scene Update',  color: '#f59e0b' },
  RESOLUTION:     { label: 'Resolved',      color: '#6b7280' },
  INVESTIGATION:  { label: 'Investigation', color: '#ec4899' },
  TEXT:           { label: 'Note',          color: '#94a3b8' },
}

function relTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 5)   return 'just now'
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function fmt(t: string): string { return t?.replace(/_/g, ' ') ?? '' }

interface Props {
  onIncidentClick?: (incidentId: number) => void
}

export default function IncidentWatchPanel({ onIncidentClick }: Props) {
  const [events, setEvents]       = useState<WatchEvent[]>([])
  const [lastId, setLastId]       = useState<number | null>(null)
  const [newCount, setNewCount]   = useState(0)
  const [, forceRender]           = useState(0)
  const listRef                   = useRef<HTMLDivElement>(null)
  const atTopRef                  = useRef(true)

  // Fetch activity feed every 5 seconds
  useEffect(() => {
    const poll = () =>
      api<WatchEvent[]>('/api/dispatch/watch?limit=60')
        .then(data => {
          setEvents(data)
          if (data.length > 0 && data[0].id !== lastId) {
            const oldTop = lastId
            const newest = data[0].id
            if (oldTop !== null && newest > oldTop) {
              const newItems = data.filter(e => e.id > oldTop).length
              if (!atTopRef.current) setNewCount(n => n + newItems)
            }
            setLastId(newest)
          }
        })
        .catch(() => {})
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tick for relative-time rerender
  useEffect(() => {
    const id = setInterval(() => forceRender(n => n + 1), 15_000)
    return () => clearInterval(id)
  }, [])

  function handleScroll() {
    if (!listRef.current) return
    atTopRef.current = listRef.current.scrollTop < 40
    if (atTopRef.current) setNewCount(0)
  }

  function scrollToTop() {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setNewCount(0)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--panel)', borderRadius: 12, overflow: 'hidden',
      border: '1px solid var(--hair)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--hair)',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: '#22c55e',
          boxShadow: '0 0 6px #22c55e', flexShrink: 0,
          animation: 'pulse 2s infinite',
        }} />
        <span style={{ fontWeight: 700, fontSize: '0.82rem', letterSpacing: '0.08em', color: 'var(--text)' }}>
          INCIDENT WATCH
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.68rem',
          color: 'var(--text-faint)', fontFamily: 'var(--mono)',
        }}>
          {events.length} events
        </span>
      </div>

      {/* New-events banner */}
      {newCount > 0 && (
        <button
          onClick={scrollToTop}
          style={{
            margin: '6px 8px 0', padding: '5px 10px',
            background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: 8, cursor: 'pointer', color: '#4ade80',
            fontSize: '0.74rem', fontWeight: 600, flexShrink: 0,
          }}
        >
          ↑ {newCount} new event{newCount > 1 ? 's' : ''}
        </button>
      )}

      {/* Event list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', padding: '8px' }}
      >
        {events.length === 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--text-faint)', textAlign: 'center', marginTop: 20 }}>
            Waiting for incident activity…
          </p>
        )}

        {events.map(ev => {
          const badge = NOTE_TYPE_BADGE[ev.noteType] ?? NOTE_TYPE_BADGE.TEXT
          const pColor = PRIO_COLORS[ev.priority] ?? '#6b7280'
          return (
            <div
              key={ev.id}
              onClick={() => onIncidentClick?.(ev.incidentId)}
              style={{
                padding: '9px 11px', borderRadius: 9, marginBottom: 5,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--hair)',
                cursor: onIncidentClick ? 'pointer' : 'default',
                transition: 'border-color 0.12s',
              }}
              onMouseEnter={e => { if (onIncidentClick) (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(47,107,255,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--hair)' }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, flexWrap: 'wrap' }}>
                <span style={{
                  background: pColor + '28', border: `1px solid ${pColor}`,
                  color: pColor, borderRadius: 5, padding: '1px 5px',
                  fontSize: '0.62rem', fontWeight: 700, flexShrink: 0,
                }}>P{ev.priority}</span>

                <span className="mono" style={{ fontSize: '0.68rem', color: 'var(--text-dim)' }}>
                  {ev.incidentRef}
                </span>

                <span style={{
                  background: badge.color + '22', border: `1px solid ${badge.color}55`,
                  color: badge.color, borderRadius: 5, padding: '1px 6px',
                  fontSize: '0.60rem', fontWeight: 600,
                }}>{badge.label}</span>

                <span style={{ marginLeft: 'auto', fontSize: '0.60rem', color: 'var(--text-faint)' }}>
                  {relTime(ev.createdAt)}
                </span>
              </div>

              {/* Crime type + address */}
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                {fmt(ev.crimeType)}
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-faint)', marginBottom: 4 }}>
                {ev.address}{ev.postcode ? `, ${ev.postcode}` : ''}
              </div>

              {/* Note text */}
              <div style={{
                fontSize: '0.70rem', color: 'var(--text-dim)', lineHeight: 1.55,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {ev.noteText}
              </div>

              {/* Officers & author footer */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 5, flexWrap: 'wrap', gap: 3,
              }}>
                {ev.officers && (
                  <span style={{ fontSize: '0.62rem', color: '#3b82f6', fontFamily: 'var(--mono)' }}>
                    {ev.officers.length > 40 ? ev.officers.slice(0, 40) + '…' : ev.officers}
                  </span>
                )}
                <span style={{ fontSize: '0.60rem', color: 'var(--text-faint)', marginLeft: 'auto' }}>
                  {ev.author}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
