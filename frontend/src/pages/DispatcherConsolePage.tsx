import { useState, useEffect, useCallback, useRef } from 'react'
import TopBar from '../components/TopBar'
import IncidentMap from '../components/IncidentMap'
import type { IncidentPin, ActivePin, ResourcePin, MapBounds } from '../components/IncidentMap'
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
  lat: number; lon: number
}
interface ResourceVehicle {
  id: number; identifier: string; type: string; seats: number
  stationName: string; borough: string; distanceM: number
  lat: number; lon: number
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
  resources: { type: string; ref: string; name: string; mode?: string }[]
}
interface MovingResource {
  id: string; resourceType: string; ref: string; name: string
  mode: string; lat: number; lon: number
  targetLat: number | null; targetLon: number | null
  dispatchStatus: string; incidentId: number | null
  assignedAt: string | null; dispatchCreatedAt: string | null; onSceneAt: string | null
}

// ── constants ─────────────────────────────────────────────────────────────

const PRIO_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#3b82f6', 5: '#6b7280',
}
const MODE_EMOJI: Record<string, string> = {
  CAR: '🚔', VAN: '🚐', MOTORBIKE: '🏍️', SCOOTER: '🛵',
  PUSHBIKE: '🚲', FOOT: '🚶', DOG_CAR: '🐕',
}
const SPEED_MS: Record<string, number> = {
  CAR: 8.3, VAN: 8.3, MOTORBIKE: 11.1, SCOOTER: 8.3,
  PUSHBIKE: 5.6, FOOT: 1.4, DOG_CAR: 8.3,
}
const SKILLS = [
  { code: 'FIREARMS',         label: 'Firearms (ARV)' },
  { code: 'TASER',            label: 'Taser' },
  { code: 'FIRST_AID',        label: 'First Aid' },
  { code: 'ADVANCED_DRIVING', label: 'Advanced Driving' },
  { code: 'NEGOTIATOR',       label: 'Negotiator' },
  { code: 'DOG_HANDLER',      label: 'Dog Handler' },
  { code: 'MARINE',           label: 'Marine Unit' },
  { code: 'ROADS_POLICING',   label: 'Roads Policing' },
  { code: 'MENTAL_HEALTH',    label: 'Mental Health' },
  { code: 'ANTI_TERRORISM',   label: 'Counter Terrorism' },
  { code: 'PUBLIC_ORDER',     label: 'Public Order' },
  { code: 'SURVEILLANCE',     label: 'Surveillance' },
  { code: 'SEARCH',           label: 'Search (POLSA)' },
  { code: 'CRIME_SCENE',      label: 'Crime Scene' },
  { code: 'INTERPRETER',      label: 'Interpreter' },
]

function fmt(t: string)   { return t?.replace(/_/g, ' ') ?? '' }
function etaMin(distM: number, mode: string): number {
  return Math.max(1, Math.ceil(distM / (SPEED_MS[mode] ?? 1.4) / 60))
}
function fmtRadius(m: number, unit: 'metric' | 'imperial'): string {
  if (unit === 'metric') return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
  const ft = m * 3.28084
  return ft >= 5280 ? `${(ft / 5280).toFixed(2)} mi` : `${Math.round(ft)} ft`
}
function distStr(m: number, unit: 'metric' | 'imperial' = 'metric'): string {
  if (unit === 'metric') return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`
  const ft = m * 3.28084
  return ft < 5280 ? `${Math.round(ft)}ft` : `${(ft / 5280).toFixed(2)}mi`
}

// ── component ─────────────────────────────────────────────────────────────

export default function DispatcherConsolePage() {
  const [waiting,      setWaiting]      = useState<WaitingIncident[]>([])
  const [active,       setActive]       = useState<ActiveDispatch[]>([])
  const [moving,       setMoving]       = useState<MovingResource[]>([])
  const [selected,     setSelected]     = useState<WaitingIncident | null>(null)
  const [suggested,    setSuggested]    = useState<SuggestedResources | null>(null)
  const [selOfficers,  setSelOfficers]  = useState<Set<number>>(new Set())
  const [selVehicles,  setSelVehicles]  = useState<Set<number>>(new Set())
  const [dispatching,  setDispatching]  = useState(false)
  const [flash,        setFlash]        = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [skillFilter,  setSkillFilter]  = useState('')
  const [radiusM,      setRadiusM]      = useState(1000)
  const [unit,         setUnit]         = useState<'metric' | 'imperial'>('metric')
  const [loadingRes,   setLoadingRes]   = useState(false)

  const radiusDebounce  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedRadius, setDebouncedRadius] = useState(1000)
  const mapBoundsRef = useRef<MapBounds>({ latMin: 51.2, lngMin: -0.6, latMax: 51.8, lngMax: 0.4 })

  const handleBoundsChange = useCallback((b: MapBounds) => {
    mapBoundsRef.current = b
  }, [])

  // Debounce radius slider (200ms) to avoid hammering the API on drag
  useEffect(() => {
    if (radiusDebounce.current) clearTimeout(radiusDebounce.current)
    radiusDebounce.current = setTimeout(() => setDebouncedRadius(radiusM), 200)
    return () => { if (radiusDebounce.current) clearTimeout(radiusDebounce.current) }
  }, [radiusM])

  // ── polling ──────────────────────────────────────────────────────────────

  const pollWaiting = useCallback(() =>
    api<WaitingIncident[]>('/api/dispatch/incidents/waiting').then(setWaiting).catch(() => {}), [])
  const pollActive  = useCallback(() =>
    api<ActiveDispatch[]>('/api/dispatch').then(setActive).catch(() => {}), [])
  const pollMoving  = useCallback(() => {
    const { latMin, lngMin, latMax, lngMax } = mapBoundsRef.current
    return api<MovingResource[]>(
      `/api/dispatch/resources/all?latMin=${latMin}&lngMin=${lngMin}&latMax=${latMax}&lngMax=${lngMax}`
    ).then(setMoving).catch(() => {})
  }, [])

  useEffect(() => {
    pollWaiting(); pollActive(); pollMoving()
    const id = setInterval(() => { pollWaiting(); pollActive(); pollMoving() }, 5000)
    return () => clearInterval(id)
  }, [pollWaiting, pollActive, pollMoving])

  // Re-fetch suggested resources when incident, skill, or radius changes
  useEffect(() => {
    if (!selected) return
    setLoadingRes(true)
    setSuggested(null)
    api<SuggestedResources>(
      `/api/dispatch/incidents/${selected.id}/resources?skill=${skillFilter}&radius=${debouncedRadius}`
    ).then(r => { setSuggested(r); setLoadingRes(false) })
     .catch(() => setLoadingRes(false))
  }, [selected?.id, skillFilter, debouncedRadius])

  // ── actions ───────────────────────────────────────────────────────────────

  function selectIncident(inc: WaitingIncident) {
    setSelected(inc)
    setSelOfficers(new Set())
    setSelVehicles(new Set())
    setSuggested(null)
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
    } catch { /* no-op */ } finally { setDispatching(false) }
  }

  async function handleOnScene(id: number) {
    await api(`/api/dispatch/${id}/on-scene`, { method: 'POST' }).catch(() => {})
    pollActive(); pollMoving()
  }

  async function handleResolve(id: number) {
    await api(`/api/dispatch/${id}/resolve`, { method: 'POST' }).catch(() => {})
    pollActive(); pollWaiting(); pollMoving()
  }

  function toggleOfficer(id: number) {
    setSelOfficers(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleVehicle(id: number) {
    setSelVehicles(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  // ── derived map data ──────────────────────────────────────────────────────

  const filtered = waiting.filter(i => {
    if (!search) return true
    const q = search.toLowerCase()
    return i.reference.toLowerCase().includes(q)
        || i.crimeType.toLowerCase().includes(q)
        || i.address.toLowerCase().includes(q)
        || i.postcode.toLowerCase().includes(q)
  })

  const incidentPins: IncidentPin[] = [
    ...waiting.map(i => ({ id: i.id, lat: i.latitude, lng: i.longitude, reference: i.reference, priority: i.priority, crimeType: i.crimeType, status: i.status })),
    ...active.filter(d => d.latitude).map(d => ({ id: -d.id, lat: d.latitude, lng: d.longitude, reference: d.incidentRef, priority: d.priority, crimeType: d.crimeType, status: d.status })),
  ]
  const activePin: ActivePin | null = selected
    ? { callId: String(selected.id), lat: selected.latitude, lng: selected.longitude, phone: selected.reference, address: selected.address }
    : null
  const selectedPos: [number, number] | null = selected
    ? [selected.latitude, selected.longitude]
    : null

  const resourcePins: ResourcePin[] = moving.map(r => ({
    id:                r.id,
    lat:               r.lat,
    lng:               r.lon,
    mode:              r.mode,
    ref:               r.ref,
    name:              r.name,
    dispatchStatus:    r.dispatchStatus,
    incidentId:        r.incidentId,
    targetLat:         r.targetLat  ?? undefined,
    targetLng:         r.targetLon  ?? undefined,
    dispatchCreatedAt: r.dispatchCreatedAt,
    assignedAt:        r.assignedAt,
    onSceneAt:         r.onSceneAt,
  }))

  // Only show route lines for resources going to the selected incident
  const routeResources: ResourcePin[] = selected
    ? resourcePins.filter(r => r.incidentId === selected.id)
    : []

  const canDispatch = !dispatching && (selOfficers.size + selVehicles.size) > 0
  const totalSel    = selOfficers.size + selVehicles.size

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar tag="DISPATCHER" />

      {flash && (
        <div style={{
          position: 'fixed', top: 70, right: 24, zIndex: 1000,
          background: 'linear-gradient(135deg,rgba(34,197,94,.18),rgba(34,197,94,.08))',
          border: '1px solid rgba(34,197,94,.45)', borderRadius: 12, padding: '12px 18px',
          color: '#bbf7d0', fontWeight: 600, fontSize: '0.88rem',
        }}>{flash}</div>
      )}

      <main style={{
        flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr 420px',
        gap: 14, padding: 14, maxHeight: 'calc(100vh - 57px)', overflow: 'hidden',
      }}>

        {/* ── LEFT: incident queue ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <div className="panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="panel-title" style={{ marginBottom: 10 }}>
              Pending Dispatch
              <span className="faint" style={{ float: 'right', fontWeight: 400 }}>{waiting.length}</span>
            </div>

            {/* Search */}
            <input
              type="search"
              placeholder="Search incidents…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 8, marginBottom: 10,
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
                color: 'inherit', fontSize: '0.82rem', outline: 'none',
                boxSizing: 'border-box',
              }}
            />

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filtered.length === 0 && (
                <p className="faint" style={{ fontSize: '0.82rem' }}>
                  {search ? 'No matches.' : 'No incidents waiting.'}
                </p>
              )}
              {filtered.map(inc => (
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
                    <span className="mono" style={{ fontSize: '0.76rem' }}>{inc.reference}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{fmt(inc.crimeType)}</div>
                  <div className="faint" style={{ fontSize: '0.73rem', marginTop: 2 }}>{inc.address}</div>
                  <div className="faint" style={{ fontSize: '0.70rem' }}>{inc.postcode}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Map legend */}
          <div className="panel" style={{ padding: 12, flexShrink: 0 }}>
            <div className="panel-title" style={{ marginBottom: 8 }}>Map</div>
            {[
              { color: '#2f6bff', label: 'Selected' },
              { color: '#ef4444', label: 'P1 waiting' },
              { color: '#f97316', label: 'P2 waiting' },
              { color: '#eab308', label: 'P3 waiting' },
              { color: '#22c55e', label: 'Dispatched' },
              { color: '#06b6d4', label: 'On scene' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '1.5px solid white', flexShrink: 0 }} />
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>{label}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--hair)', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {Object.entries(MODE_EMOJI).map(([k, v]) => (
                <span key={k} title={k} style={{ fontSize: '0.78rem' }}>{v}</span>
              ))}
              <span style={{ fontSize: '0.70rem', color: 'var(--text-faint)', alignSelf: 'center', marginLeft: 4 }}>resources</span>
            </div>
          </div>
        </div>

        {/* ── MIDDLE: map ── */}
        <div className="panel" style={{ overflow: 'hidden', padding: 0, position: 'relative' }}>
          <IncidentMap
            queued={[]}
            active={activePin}
            incidents={incidentPins}
            resources={resourcePins}
            routeResources={routeResources}
            selectedPos={selectedPos}
            radiusM={radiusM}
            onBoundsChange={handleBoundsChange}
          />
        </div>

        {/* ── RIGHT: assign + active ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>

          {/* Assign panel */}
          <div className="panel" style={{
            padding: 14, flex: selected ? 1 : '0 0 auto',
            overflowY: 'auto', minHeight: selected ? 300 : 'auto',
          }}>
            {!selected ? (
              <p className="faint" style={{ fontSize: '0.84rem', textAlign: 'center', paddingTop: 20 }}>
                Select a pending incident to assign resources.
              </p>
            ) : (
              <>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div className="panel-title">Assign Resources</div>
                  <button type="button" onClick={clearSelection}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '1.1rem', lineHeight: 1, padding: 0 }}>✕</button>
                </div>

                {/* Incident summary */}
                <div style={{
                  background: `${PRIO_COLORS[selected.priority]}18`,
                  border: `1px solid ${PRIO_COLORS[selected.priority]}55`,
                  borderRadius: 8, padding: '10px 14px', marginBottom: 12,
                }}>
                  <div style={{ fontWeight: 700, color: PRIO_COLORS[selected.priority], fontSize: '0.82rem' }}>
                    P{selected.priority} · {fmt(selected.crimeType)}
                  </div>
                  <div className="mono" style={{ fontSize: '0.76rem', marginTop: 2 }}>{selected.reference}</div>
                  <div className="faint" style={{ fontSize: '0.72rem', marginTop: 2 }}>{selected.address}, {selected.postcode}</div>
                </div>

                {/* Skill filter */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Skill filter</label>
                  <select
                    value={skillFilter}
                    onChange={e => setSkillFilter(e.target.value)}
                    style={{
                      width: '100%', padding: '7px 10px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
                      color: 'inherit', fontSize: '0.82rem', outline: 'none', cursor: 'pointer',
                    }}
                  >
                    <option value="">All skills</option>
                    {SKILLS.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}
                  </select>
                </div>

                {/* Radius slider */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Search radius: <strong style={{ color: 'var(--text)' }}>{fmtRadius(radiusM, unit)}</strong>
                    </label>
                    <button
                      type="button"
                      onClick={() => setUnit(u => u === 'metric' ? 'imperial' : 'metric')}
                      style={{
                        background: 'rgba(255,255,255,0.08)', border: '1px solid var(--hair)',
                        borderRadius: 6, padding: '2px 8px', cursor: 'pointer',
                        color: 'var(--text-dim)', fontSize: '0.70rem',
                      }}
                    >{unit === 'metric' ? 'km/m' : 'mi/ft'} ⇄</button>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20000}
                    step={unit === 'metric' ? 50 : 30}
                    value={radiusM}
                    onChange={e => setRadiusM(Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#2f6bff' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.64rem', color: 'var(--text-faint)', marginTop: 2 }}>
                    <span>{fmtRadius(1, unit)}</span>
                    <span>{fmtRadius(20000, unit)}</span>
                  </div>
                </div>

                {loadingRes && (
                  <p className="faint" style={{ fontSize: '0.80rem', marginBottom: 8 }}>Loading nearby resources…</p>
                )}

                {suggested && (
                  <>
                    {/* Officers */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div className="panel-title" style={{ margin: 0 }}>
                        Officers
                        <span className="faint" style={{ fontWeight: 400, marginLeft: 6 }}>({suggested.officers.length})</span>
                      </div>
                    </div>

                    <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
                      {suggested.officers.length === 0 && (
                        <p className="faint" style={{ fontSize: '0.78rem' }}>None available in radius{skillFilter ? ` with skill ${skillFilter}` : ''}.</p>
                      )}
                      {suggested.officers.map(o => {
                        const selected_ = selOfficers.has(o.id)
                        const eta = etaMin(o.distanceM, o.mode)
                        return (
                          <div key={o.id} onClick={() => toggleOfficer(o.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 9px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                            background: selected_ ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${selected_ ? 'rgba(34,197,94,0.5)' : 'var(--hair)'}`,
                            transition: 'all 0.12s',
                          }}>
                            <div style={{
                              width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                              background: selected_ ? '#22c55e' : 'transparent',
                              border: `2px solid ${selected_ ? '#22c55e' : 'var(--hair)'}`,
                            }} />
                            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{MODE_EMOJI[o.mode] ?? '🚔'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.79rem', fontWeight: 600 }}>{o.name}</div>
                              <div className="faint" style={{ fontSize: '0.69rem' }}>
                                {o.rank} · {o.collarNumber}
                                {o.firearms && <span style={{ color: '#ef4444', marginLeft: 4 }}>ARV</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '0.69rem', color: 'var(--text-dim)' }}>{distStr(o.distanceM, unit)}</div>
                              <div style={{ fontSize: '0.68rem', color: '#22c55e' }}>{eta} min</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Vehicles */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div className="panel-title" style={{ margin: 0 }}>
                        Vehicles
                        <span className="faint" style={{ fontWeight: 400, marginLeft: 6 }}>({suggested.vehicles.length})</span>
                      </div>
                    </div>

                    <div style={{ maxHeight: 160, overflowY: 'auto', marginBottom: 14 }}>
                      {suggested.vehicles.length === 0 && (
                        <p className="faint" style={{ fontSize: '0.78rem' }}>None available in radius.</p>
                      )}
                      {suggested.vehicles.map(v => {
                        const selected_ = selVehicles.has(v.id)
                        const eta = etaMin(v.distanceM, v.type)
                        return (
                          <div key={v.id} onClick={() => toggleVehicle(v.id)} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 9px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                            background: selected_ ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${selected_ ? 'rgba(34,197,94,0.5)' : 'var(--hair)'}`,
                            transition: 'all 0.12s',
                          }}>
                            <div style={{
                              width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                              background: selected_ ? '#22c55e' : 'transparent',
                              border: `2px solid ${selected_ ? '#22c55e' : 'var(--hair)'}`,
                            }} />
                            <span style={{ fontSize: '1rem', lineHeight: 1 }}>{MODE_EMOJI[v.type] ?? '🚐'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="mono" style={{ fontSize: '0.79rem', fontWeight: 600 }}>{v.identifier}</div>
                              <div className="faint" style={{ fontSize: '0.69rem' }}>{v.type} · {v.seats} seats · {v.stationName}</div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontSize: '0.69rem', color: 'var(--text-dim)' }}>{distStr(v.distanceM, unit)}</div>
                              <div style={{ fontSize: '0.68rem', color: '#22c55e' }}>{eta} min</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Dispatch button */}
                    <button
                      className="btn primary big"
                      style={{ width: '100%' }}
                      disabled={!canDispatch}
                      onClick={handleDispatch}
                    >
                      {dispatching
                        ? 'Dispatching…'
                        : canDispatch
                          ? `Dispatch ${totalSel} resource${totalSel === 1 ? '' : 's'}`
                          : 'Select resources to dispatch'}
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Active dispatches */}
          <div className="panel" style={{
            padding: 14,
            flex: selected ? '0 0 auto' : 1,
            maxHeight: selected ? 260 : undefined,
            overflowY: 'auto',
          }}>
            <div className="panel-title" style={{ marginBottom: 10 }}>
              Active Dispatches
              <span className="faint" style={{ float: 'right', fontWeight: 400 }}>{active.length}</span>
            </div>

            {active.length === 0 && (
              <p className="faint" style={{ fontSize: '0.82rem' }}>No active dispatches.</p>
            )}

            {active.map(d => (
              <div key={d.id} style={{
                padding: '11px 12px', borderRadius: 10, marginBottom: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hair)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{
                    background: PRIO_COLORS[d.priority] + '33',
                    border: `1px solid ${PRIO_COLORS[d.priority]}`,
                    color: PRIO_COLORS[d.priority],
                    borderRadius: 6, padding: '1px 7px', fontSize: '0.68rem', fontWeight: 700,
                  }}>P{d.priority}</span>
                  <span className="mono" style={{ fontSize: '0.75rem' }}>{d.incidentRef}</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 600,
                    color: d.status === 'ON_SCENE' ? '#06b6d4' : '#22c55e',
                  }}>{d.status === 'ON_SCENE' ? 'ON SCENE' : 'EN ROUTE'}</span>
                </div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 2 }}>{fmt(d.crimeType)}</div>
                <div className="faint" style={{ fontSize: '0.70rem', marginBottom: 8 }}>{d.address}, {d.postcode}</div>

                {d.resources.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                    {d.resources.map((r, i) => (
                      <span key={i} style={{
                        padding: '2px 7px', borderRadius: 6,
                        background: r.type === 'OFFICER' ? 'rgba(47,107,255,0.12)' : 'rgba(234,179,8,0.12)',
                        border: `1px solid ${r.type === 'OFFICER' ? 'rgba(47,107,255,0.4)' : 'rgba(234,179,8,0.4)'}`,
                        fontSize: '0.68rem', fontFamily: 'var(--mono)',
                      }}>
                        {r.mode && (MODE_EMOJI[r.mode] ?? '')} {r.ref}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6 }}>
                  {d.status === 'ACTIVE' && (
                    <button className="btn" onClick={() => handleOnScene(d.id)} style={{
                      flex: 1, fontSize: '0.76rem', padding: '6px 0',
                      background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.4)',
                      color: '#06b6d4', borderRadius: 8, cursor: 'pointer',
                    }}>On Scene</button>
                  )}
                  <button className="btn" onClick={() => handleResolve(d.id)} style={{
                    flex: 1, fontSize: '0.76rem', padding: '6px 0',
                    background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)',
                    color: '#22c55e', borderRadius: 8, cursor: 'pointer',
                  }}>Resolve</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  )
}
