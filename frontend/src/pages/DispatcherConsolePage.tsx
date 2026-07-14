import React, { useState, useEffect, useCallback, useRef } from 'react'
import TopBar from '../components/TopBar'
import IncidentMap from '../components/IncidentMap'
import IncidentDetailPanel from '../components/IncidentDetailPanel'
import IncidentWatchPanel from '../components/IncidentWatchPanel'
import type { IncidentPin, ActivePin, ResourcePin, MapBounds, HistoryNav } from '../components/IncidentMap'
import type { ActiveDispatch } from '../components/IncidentDetailPanel'
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

// ── officer scatter (stable, deterministic by id) ─────────────────────────

// Simple hash so the same resource always lands at the same scatter position.
function hashStr(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return h >>> 0
}
function lcg(seed: number): () => number {
  let s = seed
  return () => { s = (Math.imul(1664525, s) + 1013904223) & 0xffffffff; return (s >>> 0) / 0x100000000 }
}

const SCATTER_MEAN_M = 900   // exponential mean — most officers within ~1.8 km of station

function scatterPos(r: MovingResource): { lat: number; lon: number } {
  if (r.dispatchStatus !== 'FREE') return { lat: r.lat, lon: r.lon }
  const rand  = lcg(hashStr(r.id))
  const u1    = rand(); const u2 = rand(); const u3 = rand()
  const angle = u2 * 2 * Math.PI
  const cosLat = Math.cos(r.lat * Math.PI / 180)
  if (u1 < 0.05) {
    // 5% stay at station with a tiny positional jitter (≤20 m)
    const jitter = u3 * 20
    return {
      lat: r.lat + jitter * Math.cos(angle) / 111000,
      lon: r.lon + jitter * Math.sin(angle) / (111000 * cosLat),
    }
  }
  // 95%: exponential distribution — density falls off naturally away from station
  const distM = Math.min(-Math.log(Math.max(u3, 1e-7)) * SCATTER_MEAN_M, SCATTER_MEAN_M * 5)
  return {
    lat: r.lat + distM * Math.cos(angle) / 111000,
    lon: r.lon + distM * Math.sin(angle) / (111000 * cosLat),
  }
}

function fmt(t: string) { return t?.replace(/_/g, ' ') ?? '' }

function pageBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    background: disabled ? 'transparent' : 'rgba(255,255,255,0.07)',
    border: `1px solid ${disabled ? 'transparent' : 'var(--hair)'}`,
    borderRadius: 6, padding: '3px 9px', cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--text-faint)' : 'var(--text-dim)',
    fontSize: '0.70rem', fontWeight: 600, opacity: disabled ? 0.4 : 1, transition: 'all 0.15s',
  }
}
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
  const [rightTab,     setRightTab]     = useState<'dispatch' | 'watch'>('dispatch')
  const [leftPage,     setLeftPage]     = useState(0)
  const [rightPage,    setRightPage]    = useState(0)

  // Detail panel + map highlight
  const [detailDispatch, setDetailDispatch] = useState<ActiveDispatch | null>(null)
  const [mapHighlightId, setMapHighlightId] = useState<number | null>(null)
  const [histNav,        setHistNav]        = useState<HistoryNav | null>(null)

  const radiusDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedRadius, setDebouncedRadius] = useState(1000)
  const mapBoundsRef = useRef<MapBounds>({ latMin: 51.2, lngMin: -0.6, latMax: 51.8, lngMax: 0.4 })

  const handleBoundsChange = useCallback((b: MapBounds) => {
    mapBoundsRef.current = b
  }, [])

  const handleHistoryChange = useCallback((nav: HistoryNav) => {
    setHistNav(nav)
  }, [])

  // Debounce radius slider
  useEffect(() => {
    if (radiusDebounce.current) clearTimeout(radiusDebounce.current)
    radiusDebounce.current = setTimeout(() => setDebouncedRadius(radiusM), 200)
    return () => { if (radiusDebounce.current) clearTimeout(radiusDebounce.current) }
  }, [radiusM])

  // ── polling ──────────────────────────────────────────────────────────────

  const pollWaiting = useCallback(() =>
    api<WaitingIncident[]>('/api/dispatch/incidents/waiting').then(setWaiting).catch(() => {}), [])

  const pollActive = useCallback(() =>
    api<ActiveDispatch[]>('/api/dispatch').then(d => {
      setActive(d)
      // Keep detailDispatch fresh if it's still in the active list
      setDetailDispatch(prev => {
        if (!prev) return null
        return d.find(a => a.id === prev.id) ?? null
      })
    }).catch(() => {}), [])

  const pollMoving = useCallback(() => {
    const { latMin, lngMin, latMax, lngMax } = mapBoundsRef.current
    return api<MovingResource[]>(
      `/api/dispatch/resources/all?latMin=${latMin}&lngMin=${lngMin}&latMax=${latMax}&lngMax=${lngMax}`
    ).then(setMoving).catch(() => {})
  }, [])

  useEffect(() => {
    pollWaiting(); pollActive(); pollMoving()
    const id = setInterval(() => { pollWaiting(); pollActive(); pollMoving() }, 10_000)
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

  // Reset pages when content changes
  useEffect(() => { setLeftPage(0) }, [search])
  useEffect(() => { setRightPage(0) }, [active.length])

  // ── actions ───────────────────────────────────────────────────────────────

  function selectIncident(inc: WaitingIncident) {
    setSelected(inc)
    setSelOfficers(new Set())
    setSelVehicles(new Set())
    setSuggested(null)
    setDetailDispatch(null)
    setMapHighlightId(inc.id)
  }

  function clearSelection() {
    setSelected(null); setSuggested(null)
    setSelOfficers(new Set()); setSelVehicles(new Set())
    setMapHighlightId(null)
  }

  function closeDetailPanel() {
    setDetailDispatch(null)
    setMapHighlightId(null)
  }

  function openDispatchDetail(d: ActiveDispatch) {
    setDetailDispatch(d)
    setMapHighlightId(-d.id)
    setSelected(null)
    setSuggested(null)
  }

  // Clicking an incident on the map
  function handleIncidentClick(i: IncidentPin) {
    if (i.id < 0) {
      // Active dispatch — id is -dispatchId
      const d = active.find(a => a.id === -i.id)
      if (d) openDispatchDetail(d)
    } else {
      // Waiting incident
      const w = waiting.find(x => x.id === i.id)
      if (w) selectIncident(w)
    }
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
    // Optimistic update on detail panel
    setDetailDispatch(prev =>
      prev?.id === id ? { ...prev, status: 'ON_SCENE', onSceneAt: new Date().toISOString() } : prev
    )
    pollActive(); pollMoving()
  }

  async function handleResolve(id: number) {
    await api(`/api/dispatch/${id}/resolve`, { method: 'POST' }).catch(() => {})
    if (detailDispatch?.id === id) closeDetailPanel()
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

  const activePin: ActivePin | null = selected && !detailDispatch
    ? { callId: String(selected.id), lat: selected.latitude, lng: selected.longitude, phone: selected.reference, address: selected.address }
    : null

  const selectedPos: [number, number] | null = selected && !detailDispatch
    ? [selected.latitude, selected.longitude]
    : null

  const resourcePins: ResourcePin[] = moving.map(r => {
    const { lat, lon } = scatterPos(r)
    return {
      id:                r.id,
      lat,
      lng:               lon,
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
    }
  })

  const routeResources: ResourcePin[] = selected && !detailDispatch
    ? resourcePins.filter(r => r.incidentId === selected.id)
    : detailDispatch
      ? resourcePins.filter(r => r.incidentId === detailDispatch.incidentId)
      : []

  const canDispatch = !dispatching && (selOfficers.size + selVehicles.size) > 0
  const totalSel    = selOfficers.size + selVehicles.size

  // Pagination
  const LEFT_PAGE_SIZE  = 7
  const RIGHT_PAGE_SIZE = 4
  const leftTotalPages  = Math.max(1, Math.ceil(filtered.length / LEFT_PAGE_SIZE))
  const rightTotalPages = Math.max(1, Math.ceil(active.length / RIGHT_PAGE_SIZE))
  const safeLeftPage    = Math.min(leftPage, leftTotalPages - 1)
  const safeRightPage   = Math.min(rightPage, rightTotalPages - 1)
  const pagedLeft       = filtered.slice(safeLeftPage * LEFT_PAGE_SIZE, (safeLeftPage + 1) * LEFT_PAGE_SIZE)
  const pagedRight      = active.slice(safeRightPage * RIGHT_PAGE_SIZE, (safeRightPage + 1) * RIGHT_PAGE_SIZE)

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopBar tag="DISPATCHER" />

      {/* Auto-dispatch active banner */}
      <div style={{
        background: 'rgba(34,197,94,0.07)', borderBottom: '1px solid rgba(34,197,94,0.18)',
        padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.72rem', color: '#4ade80', flexShrink: 0,
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
          boxShadow: '0 0 5px #22c55e', animation: 'pulse 2s infinite', flexShrink: 0,
        }} />
        <span>
          Auto-Dispatch active — {waiting.length} waiting · {active.length} active
          {active.length > 0 && ` · ${active.filter(d => d.status === 'ON_SCENE').length} on scene`}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {(['dispatch', 'watch'] as const).map(tab => (
            <button key={tab} onClick={() => setRightTab(tab)} style={{
              background: rightTab === tab ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
              border: `1px solid ${rightTab === tab ? 'rgba(34,197,94,0.5)' : 'var(--hair)'}`,
              borderRadius: 6, padding: '2px 10px', cursor: 'pointer',
              color: rightTab === tab ? '#4ade80' : 'var(--text-faint)',
              fontSize: '0.70rem', fontWeight: 600, textTransform: 'capitalize',
            }}>
              {tab === 'watch' ? '⚡ Incident Watch' : '🚨 Dispatch'}
            </button>
          ))}
        </div>
      </div>

      {flash && (
        <div style={{
          position: 'fixed', top: 90, right: 24, zIndex: 1000,
          background: 'linear-gradient(135deg,rgba(34,197,94,.18),rgba(34,197,94,.08))',
          border: '1px solid rgba(34,197,94,.45)', borderRadius: 12, padding: '12px 18px',
          color: '#bbf7d0', fontWeight: 600, fontSize: '0.88rem',
        }}>{flash}</div>
      )}

      <main style={{
        flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr 420px',
        gap: 14, padding: 14, overflow: 'hidden', minHeight: 0,
      }}>

        {/* ── LEFT: incident queue ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden', minHeight: 0 }}>
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            {/* Header */}
            <div style={{ padding: '12px 14px 0', flexShrink: 0 }}>
              <div className="panel-title" style={{ marginBottom: 8 }}>
                Pending Dispatch
                <span className="faint" style={{ float: 'right', fontWeight: 400 }}>{waiting.length}</span>
              </div>
              <input
                type="search"
                placeholder="Search incidents…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 8, marginBottom: 8,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
                  color: 'inherit', fontSize: '0.82rem', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {/* Inline map legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', marginBottom: 8 }}>
                {[
                  { color: '#ef4444', label: 'P1' }, { color: '#f97316', label: 'P2' },
                  { color: '#eab308', label: 'P3' }, { color: '#22c55e', label: 'Dispatched' },
                  { color: '#06b6d4', label: 'On scene' },
                ].map(({ color, label }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.66rem', color: 'var(--text-faint)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, border: '1px solid white', display: 'inline-block', flexShrink: 0 }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Paginated list — no scroll, fixed items */}
            <div style={{ flex: 1, padding: '0 14px', overflow: 'hidden', minHeight: 0 }}>
              {pagedLeft.length === 0 && (
                <p className="faint" style={{ fontSize: '0.82rem', paddingTop: 8 }}>
                  {search ? 'No matches.' : 'No incidents waiting.'}
                </p>
              )}
              {pagedLeft.map(inc => (
                <div
                  key={inc.id}
                  onClick={() => selectIncident(inc)}
                  style={{
                    padding: '9px 11px', borderRadius: 10, marginBottom: 5, cursor: 'pointer',
                    background: selected?.id === inc.id ? 'rgba(47,107,255,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${selected?.id === inc.id ? 'rgba(47,107,255,0.5)' : 'var(--hair)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                    <span style={{
                      background: PRIO_COLORS[inc.priority] + '33',
                      border: `1px solid ${PRIO_COLORS[inc.priority]}`,
                      color: PRIO_COLORS[inc.priority],
                      borderRadius: 5, padding: '1px 6px', fontSize: '0.68rem', fontWeight: 700,
                    }}>P{inc.priority}</span>
                    <span className="mono" style={{ fontSize: '0.72rem' }}>{inc.reference}</span>
                  </div>
                  <div style={{ fontSize: '0.80rem', fontWeight: 600 }}>{fmt(inc.crimeType)}</div>
                  <div className="faint" style={{ fontSize: '0.70rem', marginTop: 1 }}>{inc.address}</div>
                  <div className="faint" style={{ fontSize: '0.67rem' }}>{inc.postcode}</div>
                </div>
              ))}
            </div>

            {/* Pagination bar */}
            <div style={{
              flexShrink: 0, padding: '8px 14px',
              borderTop: '1px solid var(--hair)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <button
                onClick={() => setLeftPage(p => Math.max(0, p - 1))}
                disabled={safeLeftPage === 0}
                style={pageBtnStyle(safeLeftPage === 0)}
              >← Prev</button>
              <span style={{ fontSize: '0.70rem', color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                {safeLeftPage + 1} / {leftTotalPages}
                <span style={{ marginLeft: 6, color: 'var(--text-faint)', fontSize: '0.64rem' }}>
                  ({filtered.length} total)
                </span>
              </span>
              <button
                onClick={() => setLeftPage(p => Math.min(leftTotalPages - 1, p + 1))}
                disabled={safeLeftPage >= leftTotalPages - 1}
                style={pageBtnStyle(safeLeftPage >= leftTotalPages - 1)}
              >Next →</button>
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
            selectedIncidentId={mapHighlightId}
            onBoundsChange={handleBoundsChange}
            onIncidentClick={handleIncidentClick}
            onHistoryChange={handleHistoryChange}
          />

          {/* Breadcrumb history bar */}
          {histNav && histNav.total > 1 && (
            <div style={{
              position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
              zIndex: 1000, display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(10,15,30,0.88)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20, padding: '4px 10px',
              boxShadow: '0 4px 16px rgba(0,0,0,.55)',
              backdropFilter: 'blur(8px)',
              userSelect: 'none',
            }}>
              <button
                type="button"
                onClick={histNav.goBack}
                disabled={!histNav.canBack}
                style={{
                  background: 'none', border: 'none', padding: '2px 5px', lineHeight: 1,
                  cursor: histNav.canBack ? 'pointer' : 'not-allowed',
                  color: histNav.canBack ? '#a5b4fc' : '#374151',
                  fontSize: '1rem', transition: 'color 0.15s',
                }}>←</button>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--mono)', minWidth: 32, textAlign: 'center' }}>
                {histNav.pos}/{histNav.total}
              </span>
              <button
                type="button"
                onClick={histNav.goFwd}
                disabled={!histNav.canFwd}
                style={{
                  background: 'none', border: 'none', padding: '2px 5px', lineHeight: 1,
                  cursor: histNav.canFwd ? 'pointer' : 'not-allowed',
                  color: histNav.canFwd ? '#a5b4fc' : '#374151',
                  fontSize: '1rem', transition: 'color 0.15s',
                }}>→</button>
            </div>
          )}
        </div>

        {/* ── RIGHT ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>

          {/* Tab: Incident Watch */}
          {rightTab === 'watch' && !detailDispatch && (
            <IncidentWatchPanel
              onIncidentClick={(id) => {
                // Try to open the active dispatch, otherwise find waiting
                const d = active.find(a => a.incidentId === id)
                if (d) openDispatchDetail(d)
                else {
                  const w = waiting.find(x => x.id === id)
                  if (w) selectIncident(w)
                }
              }}
            />
          )}

          {rightTab === 'watch' && detailDispatch && (
            <div className="panel" style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
              <IncidentDetailPanel
                dispatch={detailDispatch}
                resourcePins={resourcePins}
                onClose={closeDetailPanel}
                onOnScene={handleOnScene}
                onResolve={handleResolve}
                onRefresh={pollActive}
              />
            </div>
          )}

          {rightTab === 'dispatch' && detailDispatch ? (
            /* Full-height incident detail panel */
            <div className="panel" style={{ flex: 1, overflow: 'hidden', padding: 0 }}>
              <IncidentDetailPanel
                dispatch={detailDispatch}
                resourcePins={resourcePins}
                onClose={closeDetailPanel}
                onOnScene={handleOnScene}
                onResolve={handleResolve}
                onRefresh={pollActive}
              />
            </div>
          ) : (
            <>
              {/* Assign panel */}
              <div className="panel" style={{
                padding: 14, flex: '0 0 auto',
                maxHeight: selected ? '55%' : undefined,
                overflowY: selected ? 'auto' : undefined,
              }}>
                {!selected ? (
                  <p className="faint" style={{ fontSize: '0.84rem', textAlign: 'center', paddingTop: 20 }}>
                    Select a pending incident to assign resources.<br />
                    <span style={{ fontSize: '0.74rem', marginTop: 6, display: 'block' }}>
                      Click any incident on the map or in the left panel.
                    </span>
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
                          }}>{unit === 'metric' ? 'km/m' : 'mi/ft'} ⇄</button>
                      </div>
                      <input
                        type="range" min={1} max={20000}
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
                            const sel_ = selOfficers.has(o.id)
                            const eta  = etaMin(o.distanceM, o.mode)
                            return (
                              <div key={o.id} onClick={() => toggleOfficer(o.id)} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '7px 9px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                                background: sel_ ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${sel_ ? 'rgba(34,197,94,0.5)' : 'var(--hair)'}`,
                                transition: 'all 0.12s',
                              }}>
                                <div style={{
                                  width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                                  background: sel_ ? '#22c55e' : 'transparent',
                                  border: `2px solid ${sel_ ? '#22c55e' : 'var(--hair)'}`,
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
                            const sel_ = selVehicles.has(v.id)
                            const eta  = etaMin(v.distanceM, v.type)
                            return (
                              <div key={v.id} onClick={() => toggleVehicle(v.id)} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                padding: '7px 9px', borderRadius: 8, marginBottom: 4, cursor: 'pointer',
                                background: sel_ ? 'rgba(34,197,94,0.10)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${sel_ ? 'rgba(34,197,94,0.5)' : 'var(--hair)'}`,
                                transition: 'all 0.12s',
                              }}>
                                <div style={{
                                  width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                                  background: sel_ ? '#22c55e' : 'transparent',
                                  border: `2px solid ${sel_ ? '#22c55e' : 'var(--hair)'}`,
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

              {/* Active dispatches — paginated */}
              <div className="panel" style={{
                display: 'flex', flexDirection: 'column',
                flex: 1, minHeight: 0, padding: 0, overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{ padding: '10px 14px 8px', flexShrink: 0, borderBottom: '1px solid var(--hair)' }}>
                  <div className="panel-title" style={{ margin: 0 }}>
                    Active Dispatches
                    <span className="faint" style={{ float: 'right', fontWeight: 400 }}>{active.length}</span>
                  </div>
                </div>

                {/* Paginated cards */}
                <div style={{ flex: 1, padding: '8px 14px 0', overflow: 'hidden', minHeight: 0 }}>
                  {pagedRight.length === 0 && (
                    <p className="faint" style={{ fontSize: '0.82rem', paddingTop: 8 }}>No active dispatches.</p>
                  )}

                  {pagedRight.map(d => (
                    <div
                      key={d.id}
                      onClick={() => openDispatchDetail(d)}
                      style={{
                        padding: '10px 11px', borderRadius: 10, marginBottom: 7, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hair)',
                        transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(47,107,255,0.4)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--hair)')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{
                          background: PRIO_COLORS[d.priority] + '33',
                          border: `1px solid ${PRIO_COLORS[d.priority]}`,
                          color: PRIO_COLORS[d.priority],
                          borderRadius: 5, padding: '1px 6px', fontSize: '0.66rem', fontWeight: 700,
                        }}>P{d.priority}</span>
                        <span className="mono" style={{ fontSize: '0.72rem' }}>{d.incidentRef}</span>
                        <span style={{
                          marginLeft: 'auto', fontSize: '0.66rem', fontWeight: 600,
                          color: d.status === 'ON_SCENE' ? '#06b6d4' : '#22c55e',
                        }}>{d.status === 'ON_SCENE' ? 'ON SCENE' : 'EN ROUTE'}</span>
                      </div>
                      <div style={{ fontSize: '0.76rem', fontWeight: 600, marginBottom: 2 }}>{fmt(d.crimeType)}</div>
                      <div className="faint" style={{ fontSize: '0.68rem', marginBottom: 6 }}>{d.address}, {d.postcode}</div>

                      {d.resources.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                          {d.resources.map((r, i) => (
                            <span key={i} style={{
                              padding: '2px 6px', borderRadius: 5,
                              background: r.type === 'OFFICER' ? 'rgba(47,107,255,0.12)' : 'rgba(234,179,8,0.12)',
                              border: `1px solid ${r.type === 'OFFICER' ? 'rgba(47,107,255,0.4)' : 'rgba(234,179,8,0.4)'}`,
                              fontSize: '0.64rem', fontFamily: 'var(--mono)',
                            }}>
                              {r.mode && (MODE_EMOJI[r.mode] ?? '')} {r.ref}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 5 }} onClick={e => e.stopPropagation()}>
                        {d.status === 'ACTIVE' && (
                          <button className="btn" onClick={() => handleOnScene(d.id)} style={{
                            flex: 1, fontSize: '0.70rem', padding: '5px 0',
                            background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.4)',
                            color: '#06b6d4', borderRadius: 7, cursor: 'pointer',
                          }}>On Scene</button>
                        )}
                        <button className="btn" onClick={() => handleResolve(d.id)} style={{
                          flex: 1, fontSize: '0.70rem', padding: '5px 0',
                          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)',
                          color: '#22c55e', borderRadius: 7, cursor: 'pointer',
                        }}>Resolve</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination bar */}
                <div style={{
                  flexShrink: 0, padding: '7px 14px',
                  borderTop: '1px solid var(--hair)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <button
                    onClick={() => setRightPage(p => Math.max(0, p - 1))}
                    disabled={safeRightPage === 0}
                    style={pageBtnStyle(safeRightPage === 0)}
                  >← Prev</button>
                  <span style={{ fontSize: '0.70rem', color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                    {safeRightPage + 1} / {rightTotalPages}
                    <span style={{ marginLeft: 6, fontSize: '0.64rem' }}>({active.length} total)</span>
                  </span>
                  <button
                    onClick={() => setRightPage(p => Math.min(rightTotalPages - 1, p + 1))}
                    disabled={safeRightPage >= rightTotalPages - 1}
                    style={pageBtnStyle(safeRightPage >= rightTotalPages - 1)}
                  >Next →</button>
                </div>
              </div>
            </>
          )}

          {/* When on dispatch tab and no detail panel — show incident watch as compact strip at bottom */}
          {rightTab === 'dispatch' && !detailDispatch && !selected && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <IncidentWatchPanel
                onIncidentClick={(id) => {
                  const d = active.find(a => a.incidentId === id)
                  if (d) openDispatchDetail(d)
                  else {
                    const w = waiting.find(x => x.id === id)
                    if (w) selectIncident(w)
                  }
                }}
              />
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
