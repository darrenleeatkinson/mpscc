import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Circle, Tooltip, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api/client'
import type { SliderState } from './ShiftSchedulerTab'

// ── types ─────────────────────────────────────────────────────────────────

interface Station {
  id: number; name: string; borough: string
  capacity: number; sizeBand: string
  latitude: number; longitude: number
  officerCount: number
}

interface StationOverride { [stationId: number]: number }   // delta officers

interface Props { sliders: SliderState }

const LONDON: [number, number] = [51.509865, -0.118092]

// Mode colours for breakdown display
const MODE_COL: Record<string, string> = {
  CAR: '#eab308', FOOT: '#22c55e', BIKE: '#f97316',
  DOG: '#a855f7', HORSE: '#06b6d4',
}
const MODE_EMOJI: Record<string, string> = {
  CAR: '🚔', FOOT: '🚶', BIKE: '🏍', DOG: '🐕', HORSE: '🐎',
}

// Day factors (Mon=0…Sun=6) — same as scheduler
const DAY_BASE = [0.80, 0.82, 0.92, 1.00, 1.25, 1.30, 1.05]

// ── helpers ───────────────────────────────────────────────────────────────

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000, toR = Math.PI / 180
  const dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fillColor(ratio: number): string {
  if (ratio >= 1.05) return '#f97316'
  if (ratio >= 0.90) return '#22c55e'
  if (ratio >= 0.75) return '#eab308'
  return '#ef4444'
}

function modeBreakdown(officers: number): Record<string, number> {
  const car   = Math.round(officers * 0.50)
  const foot  = Math.round(officers * 0.30)
  const bike  = Math.round(officers * 0.12)
  const dog   = Math.round(officers * 0.05)
  const horse = officers - car - foot - bike - dog
  return { CAR: car, FOOT: foot, BIKE: bike, DOG: dog, HORSE: Math.max(0, horse) }
}

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── click-to-deselect handler ─────────────────────────────────────────────

function MapClickHandler({ onMapClick }: { onMapClick: () => void }) {
  useMapEvents({ click: onMapClick })
  return null
}

// ── main component ────────────────────────────────────────────────────────

export default function StationMapTab({ sliders }: Props) {
  const [stations,   setStations]   = useState<Station[]>([])
  const [overrides,  setOverrides]  = useState<StationOverride>({})
  const [selected,   setSelected]   = useState<Station | null>(null)
  const [delta,      setDelta]      = useState(0)         // slider for the selected station
  const [mode,       setMode]       = useState<'ALL' | 'CAR' | 'FOOT' | 'BIKE' | 'DOG' | 'HORSE'>('ALL')

  useEffect(() => {
    api<Station[]>('/api/schedules/station-summary').then(setStations).catch(() => {})
  }, [])

  // Compute on-shift count per station based on sliders + overrides
  const totalCap = useMemo(() => stations.reduce((s, st) => s + st.capacity, 0), [stations])

  const allocated = useMemo((): Record<number, number> => {
    if (totalCap === 0) return {}
    const earlyPct = Math.max(0, 100 - sliders.nightPct - sliders.dayPct - sliders.latePct)
    const shiftPct = (sliders.nightPct + sliders.dayPct + sliders.latePct + earlyPct) / 100
    // Average on-shift (weekday-normalised)
    const avgFactor = (DAY_BASE.reduce((s, f) => s + f, 0) / 7 +
      sliders.weekendUplift * 3 / 7 - sliders.weekendUplift / 7) / 2 + 0.7
    const avgOnShift = sliders.totalOfficers * shiftPct * avgFactor * 0.5

    const result: Record<number, number> = {}
    for (const st of stations) {
      const base = Math.round((st.capacity / totalCap) * avgOnShift)
      result[st.id] = Math.max(0, base + (overrides[st.id] ?? 0))
    }
    return result
  }, [stations, totalCap, sliders, overrides])

  // Apply override: pull N officers from nearest stations
  function applyOverride(station: Station, n: number) {
    if (n === 0) {
      setOverrides(o => { const c = { ...o }; delete c[station.id]; return c })
      return
    }
    // Sort other stations by distance
    const others = stations
      .filter(s => s.id !== station.id)
      .map(s => ({ ...s, distM: haversineM(station.latitude, station.longitude, s.latitude, s.longitude) }))
      .sort((a, b) => a.distM - b.distM)

    const newOv = { ...overrides, [station.id]: n }
    // Spread the reduction across nearest 5 stations
    let remaining = Math.abs(n)
    for (const o of others.slice(0, 5)) {
      const take = Math.round(remaining / Math.max(1, others.slice(0, 5).indexOf(o) + 1))
      const actual = Math.min(take, remaining)
      newOv[o.id] = (newOv[o.id] ?? 0) - (n > 0 ? actual : -actual)
      remaining -= actual
      if (remaining <= 0) break
    }
    setOverrides(newOv)
  }

  function selectStation(st: Station) {
    setSelected(st)
    setDelta(overrides[st.id] ?? 0)
  }

  function handleApply() {
    if (!selected) return
    applyOverride(selected, delta)
  }

  const modeMultiplier: Record<string, number> = {
    ALL: 1, CAR: 0.50, FOOT: 0.30, BIKE: 0.12, DOG: 0.05, HORSE: 0.03,
  }

  const nearestToSelected = selected
    ? stations
        .filter(s => s.id !== selected.id)
        .sort((a, b) =>
          haversineM(selected.latitude, selected.longitude, a.latitude, a.longitude) -
          haversineM(selected.latitude, selected.longitude, b.latitude, b.longitude)
        )
        .slice(0, 3)
    : []

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', gap: 14, overflow: 'hidden' }}>

      {/* Map */}
      <div className="panel" style={{ flex: 1, overflow: 'hidden', padding: 0, position: 'relative' }}>

        {/* Mode selector overlay */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 500,
          display: 'flex', gap: 4,
        }}>
          {(['ALL', 'CAR', 'FOOT', 'BIKE', 'DOG', 'HORSE'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: '4px 9px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                background: mode === m ? '#2f6bff' : 'rgba(10,14,26,0.85)',
                color: mode === m ? '#fff' : '#94a3b8',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              {m === 'ALL' ? 'All' : `${MODE_EMOJI[m]} ${m}`}
            </button>
          ))}
        </div>

        <MapContainer
          center={LONDON}
          zoom={11}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="© CartoDB"
          />
          <MapClickHandler onMapClick={() => setSelected(null)} />

          {stations.map(st => {
            const officers = allocated[st.id] ?? 0
            const shown = Math.round(officers * modeMultiplier[mode])
            const ratio = officers / st.capacity
            const col = fillColor(ratio)
            const radius = Math.max(60, Math.sqrt(shown) * 12)

            return (
              <Circle
                key={st.id}
                center={[st.latitude, st.longitude]}
                radius={radius}
                pathOptions={{
                  color: selected?.id === st.id ? '#fff' : col,
                  fillColor: col,
                  fillOpacity: 0.55,
                  weight: selected?.id === st.id ? 2.5 : 1,
                }}
                eventHandlers={{ click: (e) => { L.DomEvent.stopPropagation(e); selectStation(st) } }}
              >
                <Tooltip direction="top" offset={[0, -radius / 2]} opacity={0.92}>
                  <div style={{ background: '#0b0f1e', color: '#e2e8f0', padding: '6px 10px', borderRadius: 8, minWidth: 140 }}>
                    <div style={{ fontWeight: 700, marginBottom: 3 }}>{st.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: 2 }}>{st.borough}</div>
                    <div style={{ fontSize: '0.8rem' }}>
                      <span style={{ color: col, fontWeight: 700 }}>{shown.toLocaleString()}</span>
                      <span style={{ color: '#64748b' }}> / {st.capacity.toLocaleString()} cap</span>
                    </div>
                    {mode !== 'ALL' && (
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                        mode: {MODE_EMOJI[mode]} {mode}
                      </div>
                    )}
                  </div>
                </Tooltip>
              </Circle>
            )
          })}
        </MapContainer>
      </div>

      {/* ── Station detail side panel ── */}
      {selected && (
        <div className="panel" style={{ width: 280, padding: 16, overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{selected.name}</div>
              <div className="faint" style={{ fontSize: '0.74rem' }}>{selected.borough}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-faint)', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>

          {/* Fill ratio */}
          {(() => {
            const officers = allocated[selected.id] ?? 0
            const ratio = officers / selected.capacity
            const pct = Math.round(ratio * 100)
            const col = fillColor(ratio)
            return (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span className="faint" style={{ fontSize: '0.74rem' }}>Capacity</span>
                    <span style={{ fontSize: '0.74rem', fontFamily: 'var(--mono)' }}>{selected.capacity.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span className="faint" style={{ fontSize: '0.74rem' }}>On shift (est.)</span>
                    <span style={{ fontSize: '0.74rem', fontFamily: 'var(--mono)', color: col, fontWeight: 700 }}>{officers.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'var(--panel-2)', border: '1px solid var(--hair)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: col, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.68rem', color: col, marginTop: 3, fontWeight: 700 }}>{pct}%</div>
                </div>

                {/* Mode breakdown */}
                <div style={{ marginBottom: 16 }}>
                  <div className="panel-title" style={{ margin: '0 0 8px', fontSize: '0.72rem' }}>Officer breakdown</div>
                  {Object.entries(modeBreakdown(officers)).map(([m, n]) => (
                    <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontSize: '0.9rem', minWidth: 20 }}>{MODE_EMOJI[m]}</span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', flex: 1 }}>{m}</span>
                      <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--panel-2)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.round((n / Math.max(officers, 1)) * 100)}%`, height: '100%', background: MODE_COL[m] ?? '#888' }} />
                      </div>
                      <span style={{ fontSize: '0.72rem', color: MODE_COL[m], fontFamily: 'var(--mono)', minWidth: 28, textAlign: 'right', fontWeight: 600 }}>{n}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}

          {/* Adjustment slider */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Adjust staffing</label>
              <span style={{ fontSize: '0.72rem', color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : 'var(--text-faint)', fontFamily: 'var(--mono)', fontWeight: 700 }}>
                {delta > 0 ? '+' : ''}{delta}
              </span>
            </div>
            <input
              type="range" min={-100} max={150} step={1} value={delta}
              onChange={e => setDelta(Number(e.target.value))}
              style={{ width: '100%', accentColor: delta > 0 ? '#22c55e' : '#ef4444' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: 2 }}>
              <span>−100</span><span>0</span><span>+150</span>
            </div>
          </div>

          {delta !== 0 && (
            <div style={{ marginBottom: 12, padding: '6px 9px', borderRadius: 7, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', fontSize: '0.72rem', color: '#fbbf24' }}>
              Draws from {nearestToSelected.length} nearest stations:<br />
              {nearestToSelected.map(s => s.name).join(', ')}
            </div>
          )}

          <button
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={handleApply}
          >Apply adjustment</button>

          {(overrides[selected.id] ?? 0) !== 0 && (
            <button
              className="btn"
              style={{ width: '100%', marginTop: 6, justifyContent: 'center', fontSize: '0.76rem' }}
              onClick={() => { setOverrides(o => { const c = { ...o }; delete c[selected.id]; return c }); setDelta(0) }}
            >Reset to model</button>
          )}

          {/* Nearest stations */}
          <hr style={{ border: 'none', borderTop: '1px solid var(--hair)', margin: '16px 0 10px' }} />
          <div className="panel-title" style={{ margin: '0 0 8px', fontSize: '0.72rem' }}>Nearest stations</div>
          {nearestToSelected.map(st => {
            const off = allocated[st.id] ?? 0
            const col = fillColor(off / st.capacity)
            return (
              <div key={st.id} onClick={() => selectStation(st)} style={{
                padding: '6px 9px', borderRadius: 7, marginBottom: 4, cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hair)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.74rem' }}>{st.name}</span>
                  <span style={{ fontSize: '0.70rem', color: col, fontWeight: 700 }}>{off.toLocaleString()}</span>
                </div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-faint)' }}>{st.borough} · {st.capacity} cap</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
