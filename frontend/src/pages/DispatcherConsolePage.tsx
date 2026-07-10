import { useState, useEffect, useCallback } from 'react'
import TopBar from '../components/TopBar'
import IncidentMap from '../components/IncidentMap'
import type { IncidentPin, ActivePin } from '../components/IncidentMap'
import { api } from '../api/client'

// ── types ─────────────────────────────────────────────────────────────────

interface WaitingIncident {
  id: number; reference: string; priority: number; status: string
  crimeType: string; address: string; postcode: string
  latitude: number; longitude: number; createdAt: string
}
interface ResourceOfficer {
  id: number; collarNumber: string; name: string; rank: string
  status: string; firearms: boolean; mode: string
  stationName: string; borough: string; distanceM: number
}
interface ResourceVehicle {
  id: number; identifier: string; type: string; seats: number
  stationName: string; borough: string; distanceM: number
}
interface SuggestedResources {
  officers: ResourceOfficer[]
  vehicles: ResourceVehicle[]
}
interface ActiveDispatch {
  id: number; incidentId: number; incidentRef: string; priority: number
  status: string; address: string; postcode: string
  latitude: number; longitude: number; crimeType: string
  createdAt: string; onSceneAt: string | null
  resources: { type: string; ref: string; name: string }[]
}

const PRIO_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#3b82f6', 5: '#6b7280',
}
function fmt(t: string) { return t.replace(/_/g, ' ') }
function distStr(m: number) { return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km` }

// ── component ─────────────────────────────────────────────────────────────

export default function DispatcherConsolePage() {
  const [waiting,   setWaiting]   = useState<WaitingIncident[]>([])
  const [active,    setActive]    = useState<ActiveDispatch[]>([])
  const [selected,  setSelected]  = useState<WaitingIncident | null>(null)
  const [suggested, setSuggested] = useState<SuggestedResources | null>(null)
  const [selOfficers, setSelOfficers] = useState<Set<number>>(new Set())
  const [selVehicles, setSelVehicles] = useState<Set<number>>(new Set())
  const [dispatching, setDispatching] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  const pollWaiting = useCallback(() =>
    api<WaitingIncident[]>('/api/dispatch/incidents/waiting').then(setWaiting).catch(() => {}), [])
  const pollActive  = useCallback(() =>
    api<ActiveDispatch[]>('/api/dispatch').then(setActive).catch(() => {}), [])

  useEffect(() => {
    pollWaiting(); pollActive()
    const id = setInterval(() => { pollWaiting(); pollActive() }, 5000)
    return () => clearInterval(id)
  }, [pollWaiting, pollActive])

  async function selectIncident(inc: WaitingIncident) {
    setSelected(inc)
    setSelOfficers(new Set())
    setSelVehicles(new Set())
    setSuggested(null)
    const res = await api<SuggestedResources>(
      `/api/dispatch/incidents/${inc.id}/resources`).catch(() => null)
    setSuggested(res)
  }

  function clearSelection() {
    setSelected(null); setSuggested(null)
    setSelOfficers(new Set()); setSelVehicles(new Set())
  }

  async function handleDispatch() {
    if (!selected) return
    setDispatching(true)
    try {
      await api('/api/dispatch', {
        method: 'POST',
        body: { incidentId: selected.id, officerIds: [...selOfficers], vehicleIds: [...selVehicles] },
      })
      setFlash(`Dispatched to ${selected.reference}`)
      clearSelection()
      pollWaiting(); pollActive()
      setTimeout(() => setFlash(null), 5000)
    } catch { /* already dispatched? ignore */ } finally { setDispatching(false) }
  }

  async function handleOnScene(id: number) {
    await api(`/api/dispatch/${id}/on-scene`, { method: 'POST' }).catch(() => {})
    pollActive()
  }

  async function handleResolve(id: number) {
    await api(`/api/dispatch/${id}/resolve`, { method: 'POST' }).catch(() => {})
    pollActive(); pollWaiting()
  }

  function toggleOfficer(id: number) {
    setSelOfficers(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleVehicle(id: number) {
    setSelVehicles(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // Map pins
  const incidentPins: IncidentPin[] = [
    ...waiting.map(i => ({ id: i.id, lat: i.latitude, lng: i.longitude, reference: i.reference, priority: i.priority, crimeType: i.crimeType, status: i.status })),
    ...active.filter(d => d.latitude).map(d => ({ id: -d.id, lat: d.latitude, lng: d.longitude, reference: d.incidentRef, priority: d.priority, crimeType: d.crimeType, status: d.status })),
  ]
  const activePin: ActivePin | null = selected
    ? { callId: String(selected.id), lat: selected.latitude, lng: selected.longitude, phone: selected.reference, address: selected.address }
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar tag="DISPATCHER" />

      {flash && (
        <div className="fade-in" style={{
          position: 'fixed', top: 70, right: 24, zIndex: 1000,
          background: 'linear-gradient(135deg,rgba(34,197,94,.18),rgba(34,197,94,.08))',
          border: '1px solid rgba(34,197,94,.45)', borderRadius: 12, padding: '12px 18px',
          color: '#bbf7d0', fontWeight: 600, fontSize: '0.88rem',
        }}>{flash}</div>
      )}

      <main style={{
        flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 400px',
        gap: 14, padding: 14, maxHeight: 'calc(100vh - 57px)', overflow: 'hidden',
      }}>

        {/* ── LEFT: waiting incidents ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <div className="panel" style={{ padding: 14 }}>
            <div className="panel-title">Pending Dispatch
              <span className="faint" style={{ float: 'right', fontWeight: 400 }}>{waiting.length}</span>
            </div>
            {waiting.length === 0 && (
              <p className="faint" style={{ fontSize: '0.82rem', marginTop: 10 }}>No incidents waiting.</p>
            )}
            {waiting.map(inc => (
              <div
                key={inc.id}
                onClick={() => selectIncident(inc)}
                style={{
                  padding: '10px 12px', borderRadius: 10, marginBottom: 6, cursor: 'pointer',
                  background: selected?.id === inc.id ? 'rgba(47,107,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selected?.id === inc.id ? 'rgba(47,107,255,0.5)' : 'var(--hair)'}`,
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    background: PRIO_COLORS[inc.priority] + '33',
                    border: `1px solid ${PRIO_COLORS[inc.priority]}`,
                    color: PRIO_COLORS[inc.priority],
                    borderRadius: 6, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700,
                  }}>P{inc.priority}</span>
                  <span className="mono" style={{ fontSize: '0.78rem' }}>{inc.reference}</span>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{fmt(inc.crimeType)}</div>
                <div className="faint" style={{ fontSize: '0.74rem', marginTop: 2 }}>{inc.postcode}</div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="panel" style={{ padding: 12 }}>
            <div className="panel-title" style={{ marginBottom: 8 }}>Map legend</div>
            {[
              { color: '#2f6bff', label: 'Selected incident' },
              { color: '#ef4444', label: 'P1 waiting' },
              { color: '#f97316', label: 'P2 waiting' },
              { color: '#eab308', label: 'P3 waiting' },
              { color: '#3b82f6', label: 'P4 waiting' },
              { color: '#22c55e', label: 'Dispatched' },
              { color: '#06b6d4', label: 'On scene' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, border: '1.5px solid white', flexShrink: 0 }} />
                <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── MIDDLE: map ── */}
        <div className="panel" style={{ overflow: 'hidden', padding: 0, position: 'relative' }}>
          <IncidentMap queued={[]} active={activePin} incidents={incidentPins} />
        </div>

        {/* ── RIGHT: resource picker or active dispatches ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>

          {selected ? (
            /* ── ASSIGN RESOURCES PANEL ── */
            <>
              <div className="panel" style={{ padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="panel-title">Assign Resources</div>
                  <button
                    type="button"
                    onClick={clearSelection}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '1.1rem', lineHeight: 1 }}
                  >✕</button>
                </div>

                <div style={{
                  background: `${PRIO_COLORS[selected.priority]}18`,
                  border: `1px solid ${PRIO_COLORS[selected.priority]}55`,
                  borderRadius: 8, padding: '10px 14px', marginBottom: 12,
                }}>
                  <div style={{ fontWeight: 700, color: PRIO_COLORS[selected.priority], fontSize: '0.82rem' }}>
                    P{selected.priority} · {fmt(selected.crimeType)}
                  </div>
                  <div className="mono" style={{ fontSize: '0.78rem', marginTop: 3 }}>{selected.reference}</div>
                  <div className="faint" style={{ fontSize: '0.74rem', marginTop: 2 }}>{selected.address}, {selected.postcode}</div>
                </div>

                {!suggested ? (
                  <p className="faint" style={{ fontSize: '0.82rem' }}>Loading nearby resources…</p>
                ) : (
                  <>
                    {/* Officers */}
                    <div className="panel-title" style={{ marginBottom: 6 }}>Officers ({suggested.officers.length})</div>
                    {suggested.officers.length === 0 && (
                      <p className="faint" style={{ fontSize: '0.8rem', marginBottom: 10 }}>None available nearby.</p>
                    )}
                    {suggested.officers.map(o => (
                      <div
                        key={o.id}
                        onClick={() => toggleOfficer(o.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                          background: selOfficers.has(o.id) ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${selOfficers.has(o.id) ? 'rgba(34,197,94,0.5)' : 'var(--hair)'}`,
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          background: selOfficers.has(o.id) ? '#22c55e' : 'transparent',
                          border: `2px solid ${selOfficers.has(o.id) ? '#22c55e' : 'var(--hair)'}`,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.80rem', fontWeight: 600 }}>{o.name}</div>
                          <div className="faint" style={{ fontSize: '0.72rem' }}>
                            {o.rank} · {o.collarNumber}
                            {o.firearms && <span style={{ color: '#ef4444', marginLeft: 4 }}>ARV</span>}
                          </div>
                        </div>
                        <div className="faint" style={{ fontSize: '0.70rem', flexShrink: 0 }}>{distStr(o.distanceM)}</div>
                      </div>
                    ))}

                    {/* Vehicles */}
                    <div className="panel-title" style={{ marginTop: 10, marginBottom: 6 }}>Vehicles ({suggested.vehicles.length})</div>
                    {suggested.vehicles.length === 0 && (
                      <p className="faint" style={{ fontSize: '0.8rem', marginBottom: 10 }}>None available nearby.</p>
                    )}
                    {suggested.vehicles.map(v => (
                      <div
                        key={v.id}
                        onClick={() => toggleVehicle(v.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                          background: selVehicles.has(v.id) ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${selVehicles.has(v.id) ? 'rgba(34,197,94,0.5)' : 'var(--hair)'}`,
                          transition: 'all 0.12s',
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          background: selVehicles.has(v.id) ? '#22c55e' : 'transparent',
                          border: `2px solid ${selVehicles.has(v.id) ? '#22c55e' : 'var(--hair)'}`,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="mono" style={{ fontSize: '0.80rem', fontWeight: 600 }}>{v.identifier}</div>
                          <div className="faint" style={{ fontSize: '0.72rem' }}>{v.type} · {v.seats} seats</div>
                        </div>
                        <div className="faint" style={{ fontSize: '0.70rem', flexShrink: 0 }}>{distStr(v.distanceM)}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <button
                className="btn primary big"
                style={{ width: '100%' }}
                disabled={dispatching || (selOfficers.size === 0 && selVehicles.size === 0)}
                onClick={handleDispatch}
              >
                {dispatching
                  ? 'Dispatching…'
                  : `Dispatch ${selOfficers.size + selVehicles.size} resource${selOfficers.size + selVehicles.size === 1 ? '' : 's'}`}
              </button>
            </>
          ) : (
            /* ── ACTIVE DISPATCHES PANEL ── */
            <div className="panel" style={{ padding: 14, flex: 1 }}>
              <div className="panel-title">Active Dispatches
                <span className="faint" style={{ float: 'right', fontWeight: 400 }}>{active.length}</span>
              </div>

              {active.length === 0 && (
                <p className="faint" style={{ fontSize: '0.82rem', marginTop: 10 }}>
                  No active dispatches. Select a pending incident to assign resources.
                </p>
              )}

              {active.map(d => (
                <div key={d.id} style={{
                  padding: '12px 14px', borderRadius: 10, marginBottom: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hair)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      background: PRIO_COLORS[d.priority] + '33',
                      border: `1px solid ${PRIO_COLORS[d.priority]}`,
                      color: PRIO_COLORS[d.priority],
                      borderRadius: 6, padding: '1px 7px', fontSize: '0.70rem', fontWeight: 700,
                    }}>P{d.priority}</span>
                    <span className="mono" style={{ fontSize: '0.78rem' }}>{d.incidentRef}</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: '0.70rem', fontWeight: 600,
                      color: d.status === 'ON_SCENE' ? '#06b6d4' : '#22c55e',
                    }}>{d.status === 'ON_SCENE' ? 'ON SCENE' : 'EN ROUTE'}</span>
                  </div>

                  <div style={{ fontSize: '0.80rem', fontWeight: 600, marginBottom: 2 }}>{fmt(d.crimeType)}</div>
                  <div className="faint" style={{ fontSize: '0.73rem', marginBottom: 8 }}>{d.address}, {d.postcode}</div>

                  {d.resources.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {d.resources.map((r, i) => (
                        <span key={i} style={{
                          display: 'inline-block', margin: '2px 4px 2px 0',
                          padding: '2px 8px', borderRadius: 6,
                          background: r.type === 'OFFICER' ? 'rgba(47,107,255,0.12)' : 'rgba(234,179,8,0.12)',
                          border: `1px solid ${r.type === 'OFFICER' ? 'rgba(47,107,255,0.4)' : 'rgba(234,179,8,0.4)'}`,
                          fontSize: '0.72rem', fontFamily: 'var(--mono)',
                        }}>
                          {r.ref}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6 }}>
                    {d.status === 'ACTIVE' && (
                      <button
                        className="btn"
                        style={{ flex: 1, fontSize: '0.78rem', padding: '6px 0',
                          background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.4)',
                          color: '#06b6d4', borderRadius: 8, cursor: 'pointer' }}
                        onClick={() => handleOnScene(d.id)}
                      >On Scene</button>
                    )}
                    <button
                      className="btn"
                      style={{ flex: 1, fontSize: '0.78rem', padding: '6px 0',
                        background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)',
                        color: '#22c55e', borderRadius: 8, cursor: 'pointer' }}
                      onClick={() => handleResolve(d.id)}
                    >Resolve</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
