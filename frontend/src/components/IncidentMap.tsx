import { useEffect, useRef, useState } from 'react'
import {
  MapContainer, TileLayer, Marker, Popup, Circle, Polyline,
  useMap, useMapEvents,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { api } from '../api/client'

// ── types ──────────────────────────────────────────────────────────────────

export interface QueuePin    { callId: string; lat: number; lng: number; phone: string; postcode: string }
export interface ActivePin   { callId: string; lat: number; lng: number; phone: string; address: string }
export interface IncidentPin { id: number; lat: number; lng: number; reference: string; priority: number; crimeType: string; status: string }
export interface ResourcePin {
  id: string; lat: number; lng: number; mode: string
  ref: string; name: string; dispatchStatus: string; incidentId: number | null
  targetLat?: number | null; targetLng?: number | null
  dispatchCreatedAt?: string | null
  assignedAt?: string | null
  onSceneAt?: string | null
}
export interface MapBounds { latMin: number; lngMin: number; latMax: number; lngMax: number }
export interface HistoryNav {
  canBack: boolean; canFwd: boolean
  goBack: () => void; goFwd: () => void
  pos: number; total: number
}

interface Props {
  queued:              QueuePin[]
  active:              ActivePin | null
  incidents:           IncidentPin[]
  resources?:          ResourcePin[]
  routeResources?:     ResourcePin[]
  selectedPos?:        [number, number] | null
  radiusM?:            number
  selectedIncidentId?: number | null
  onBoundsChange?:     (b: MapBounds) => void
  onIncidentClick?:    (i: IncidentPin) => void
  onHistoryChange?:    (nav: HistoryNav) => void
}

// ── constants ──────────────────────────────────────────────────────────────

const PRIO: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#3b82f6', 5: '#6b7280',
}
const MODE_EMOJI: Record<string, string> = {
  CAR: '🚔', VAN: '🚐', MOTORBIKE: '🏍', SCOOTER: '🛵',
  PUSHBIKE: '🚲', FOOT: '🚶', DOG_CAR: '🐕',
}
const LONDON: [number, number] = [51.509865, -0.118092]
const POLL_MS = 5000

// Module-level registry — lets cluster iconCreateFunction look up ResourcePin by id
const RESOURCE_REGISTRY = new Map<string, ResourcePin>()

// ── helpers ────────────────────────────────────────────────────────────────

function elapsed(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 0) return '0m'
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`
}

function trafficColor(status: string): string {
  if (status === 'FREE')     return '#22c55e'
  if (status === 'ON_SCENE') return '#ef4444'
  return '#f59e0b'
}

function incidentColor(i: IncidentPin): string {
  if (i.status === 'DISPATCHED') return '#22c55e'
  if (i.status === 'ON_SCENE')   return '#06b6d4'
  if (i.status === 'RESOLVED')   return '#9ca3af'
  return PRIO[i.priority] ?? '#6b7280'
}

function dot(bg: string, size: number, glow = false) {
  const shadow = glow
    ? `box-shadow:0 0 0 5px ${bg}55,0 0 0 10px ${bg}22,0 2px 8px rgba(0,0,0,.5);`
    : `box-shadow:0 1px 4px rgba(0,0,0,.45);`
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2px solid white;${shadow}"></div>`,
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

function selectedIncidentDot(bg: string) {
  return L.divIcon({
    className: '',
    html: `<div class="sel-inc-dot" style="width:30px;height:30px;border-radius:50%;background:${bg};
      border:3px solid white;box-shadow:0 0 0 6px ${bg}55,0 0 18px ${bg}66,0 2px 10px rgba(0,0,0,.5);"></div>`,
    iconSize:    [30, 30],
    iconAnchor:  [15, 15],
    popupAnchor: [0, -20],
  })
}

// ── resource icon (traffic light + emoji + time badge) ────────────────────

function buildResourceIcon(r: ResourcePin): L.DivIcon {
  const emoji  = MODE_EMOJI[r.mode] ?? '🚔'
  const tlCol  = trafficColor(r.dispatchStatus)
  const isFree = r.dispatchStatus === 'FREE'

  let timeBadge = ''
  if (!isFree && r.dispatchCreatedAt) {
    const sinceAssigned = elapsed(r.dispatchCreatedAt)
    if (r.dispatchStatus === 'ON_SCENE' && r.onSceneAt) {
      const sinceOnScene = elapsed(r.onSceneAt)
      timeBadge = `<div style="font-size:9px;line-height:1.2;text-align:center;color:white;margin-top:1px;">
        <span style="opacity:.85;">${sinceAssigned}</span><br>
        <span style="color:#fca5a5;">${sinceOnScene}</span></div>`
    } else {
      timeBadge = `<div style="font-size:9px;color:#fef3c7;text-align:center;margin-top:1px;">${sinceAssigned}</div>`
    }
  }

  const height = isFree ? 40 : (r.dispatchStatus === 'ON_SCENE' && r.onSceneAt ? 64 : 54)

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:1px;">
      <div style="width:11px;height:11px;border-radius:50%;background:${tlCol};
                  border:1.5px solid white;
                  box-shadow:0 0 6px ${tlCol}cc,0 0 0 2px ${tlCol}44;"></div>
      <div style="background:#1e3a5f;border:2px solid white;border-radius:8px;
                  padding:2px 5px;font-size:14px;line-height:1.3;
                  box-shadow:0 1px 5px rgba(0,0,0,.6);white-space:nowrap;">${emoji}</div>
      ${timeBadge}
    </div>`

  return L.divIcon({
    className: '',
    html,
    iconSize:    [34, height],
    iconAnchor:  [17, 25],
    popupAnchor: [0, -28],
  })
}

// ── icon cache ────────────────────────────────────────────────────────────

function useCachedIcons() {
  const cache = useRef(new Map<string, { key: string; icon: L.DivIcon }>())
  return (r: ResourcePin): L.DivIcon => {
    const assignedMin = r.dispatchCreatedAt ? Math.floor((Date.now() - new Date(r.dispatchCreatedAt).getTime()) / 60000) : 0
    const onSceneMin  = r.onSceneAt        ? Math.floor((Date.now() - new Date(r.onSceneAt).getTime()) / 60000) : 0
    const key = `${r.dispatchStatus}|${r.mode}|${assignedMin}|${onSceneMin}`
    const hit = cache.current.get(r.id)
    if (hit && hit.key === key) return hit.icon
    const icon = buildResourceIcon(r)
    cache.current.set(r.id, { key, icon })
    return icon
  }
}

// ── smooth position animation ─────────────────────────────────────────────

function useAnimatedResources(resources: ResourcePin[]): ResourcePin[] {
  type Seg = { fromLat: number; fromLng: number; toLat: number; toLng: number; startMs: number }
  const segs   = useRef(new Map<string, Seg>())
  const [, bump] = useState(0)

  useEffect(() => {
    const now = Date.now()
    resources.forEach(r => {
      const s = segs.current.get(r.id)
      if (s) {
        const t      = Math.min((now - s.startMs) / POLL_MS, 1)
        const curLat = s.fromLat + (s.toLat - s.fromLat) * t
        const curLng = s.fromLng + (s.toLng - s.fromLng) * t
        segs.current.set(r.id, { fromLat: curLat, fromLng: curLng, toLat: r.lat, toLng: r.lng, startMs: now })
      } else {
        segs.current.set(r.id, { fromLat: r.lat, fromLng: r.lng, toLat: r.lat, toLng: r.lng, startMs: now })
      }
    })
    const ids = new Set(resources.map(r => r.id))
    segs.current.forEach((_, id) => { if (!ids.has(id)) segs.current.delete(id) })
  }, [resources])

  useEffect(() => {
    const id = setInterval(() => bump(n => n + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const now = Date.now()
  return resources.map(r => {
    const s = segs.current.get(r.id)
    if (!s) return r
    const t = Math.min((now - s.startMs) / POLL_MS, 1)
    return { ...r, lat: s.fromLat + (s.toLat - s.fromLat) * t, lng: s.fromLng + (s.toLng - s.fromLng) * t }
  })
}

// ── OSRM road-route fetching + route persistence ──────────────────────────

function useOsrmRoutes(resources: ResourcePin[]): Map<string, [number, number][]> {
  const [routes, setRoutes] = useState(new Map<string, [number, number][]>())
  const posCache            = useRef(new Map<string, string>())

  useEffect(() => {
    const enRoute = resources.filter(
      r => r.dispatchStatus === 'ACTIVE' && r.targetLat != null && r.targetLng != null
    )

    enRoute.forEach(r => {
      const posKey = `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`
      if (posCache.current.get(r.id) === posKey) return
      posCache.current.set(r.id, posKey)

      const url =
        `https://router.project-osrm.org/route/v1/driving/` +
        `${r.lng},${r.lat};${r.targetLng},${r.targetLat}` +
        `?geometries=geojson&overview=full`

      fetch(url)
        .then(res => res.json())
        .then(data => {
          const route = data.routes?.[0]
          const coords: [number, number][] | undefined = route?.geometry?.coordinates
          if (coords) {
            const latLngs = coords.map(([lon, lat]) => [lat, lon] as [number, number])
            setRoutes(prev => new Map(prev).set(r.id, latLngs))

            // Persist route to backend for dispatched resources
            if (r.id.startsWith('r-')) {
              const drId = r.id.slice(2)
              api(`/api/dispatch/resources/${drId}/route`, {
                method: 'POST',
                body: {
                  routeGeojson: JSON.stringify(coords),
                  distanceM:    Math.round((route.distance as number) ?? 0),
                  durationS:    Math.round((route.duration as number) ?? 0),
                },
              }).catch(() => {})
            }
          }
        })
        .catch(() => {})
    })

    const active = new Set(enRoute.map(r => r.id))
    setRoutes(prev => {
      let changed = false
      const next = new Map(prev)
      next.forEach((_, id) => { if (!active.has(id)) { next.delete(id); changed = true } })
      return changed ? next : prev
    })
  }, [resources])

  return routes
}

// ── sub-components ─────────────────────────────────────────────────────────

function FlyToActive({ pos }: { pos: [number, number] | null }) {
  const map  = useMap()
  const prev = useRef<string | null>(null)
  useEffect(() => {
    if (!pos) return
    const key = `${pos[0]},${pos[1]}`
    if (key === prev.current) return
    prev.current = key
    map.flyTo(pos, 15, { animate: true, duration: 0.8 })
  }, [map, pos])
  return null
}

function FlyToIncident({
  incidents, targetId,
}: { incidents: IncidentPin[]; targetId?: number | null }) {
  const map  = useMap()
  const prev = useRef<number | null>(null)
  useEffect(() => {
    if (targetId == null || targetId === prev.current) return
    const i = incidents.find(x => x.id === targetId)
    if (!i) return
    prev.current = targetId
    map.flyTo([i.lat, i.lng], 15, { animate: true, duration: 0.9 })
  }, [map, incidents, targetId])
  return null
}

function BoundsEmitter({ onBoundsChange }: { onBoundsChange?: (b: MapBounds) => void }) {
  const map = useMap()

  useEffect(() => {
    const b = map.getBounds()
    onBoundsChange?.({ latMin: b.getSouth(), lngMin: b.getWest(), latMax: b.getNorth(), lngMax: b.getEast() })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useMapEvents({
    moveend(e) {
      const b = e.target.getBounds()
      onBoundsChange?.({ latMin: b.getSouth(), lngMin: b.getWest(), latMax: b.getNorth(), lngMax: b.getEast() })
    },
    zoomend(e) {
      const b = e.target.getBounds()
      onBoundsChange?.({ latMin: b.getSouth(), lngMin: b.getWest(), latMax: b.getNorth(), lngMax: b.getEast() })
    },
  })
  return null
}

function HistoryController({
  onChange,
}: { onChange?: (nav: HistoryNav) => void }) {
  const map        = useMap()
  const history    = useRef<{ center: L.LatLng; zoom: number }[]>([])
  const cursor     = useRef(-1)
  const navigating = useRef(false)

  function emit() {
    onChange?.({
      canBack: cursor.current > 0,
      canFwd:  cursor.current < history.current.length - 1,
      goBack:  () => go(-1),
      goFwd:   () => go(1),
      pos:     cursor.current + 1,
      total:   history.current.length,
    })
  }

  function go(delta: number) {
    const next = cursor.current + delta
    if (next < 0 || next >= history.current.length) return
    cursor.current = next
    navigating.current = true
    const { center, zoom } = history.current[next]
    map.flyTo(center, zoom, { animate: true, duration: 0.65 })
    setTimeout(() => { navigating.current = false }, 900)
    emit()
  }

  useMapEvents({
    moveend() {
      if (navigating.current) return
      const entry = { center: map.getCenter(), zoom: map.getZoom() }
      // Truncate forward history on new user-initiated movement
      history.current = history.current.slice(0, cursor.current + 1)
      history.current.push(entry)
      if (history.current.length > 10) history.current.shift()
      cursor.current = history.current.length - 1
      emit()
    },
  })

  return null
}

// ── cluster icon ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildClusterIcon(cluster: any): L.DivIcon {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markers: any[] = cluster.getAllChildMarkers()
  const pins = markers
    .map((m: any) => RESOURCE_REGISTRY.get(m.options.title as string))
    .filter(Boolean) as ResourcePin[]

  const counts = { free: 0, enRoute: 0, onScene: 0 }
  const modes  = new Set<string>()
  pins.forEach(p => {
    modes.add(p.mode)
    if (p.dispatchStatus === 'FREE')     counts.free++
    else if (p.dispatchStatus === 'ACTIVE')   counts.enRoute++
    else if (p.dispatchStatus === 'ON_SCENE') counts.onScene++
  })

  const n     = markers.length
  const bgCol = counts.onScene > 0 ? 'rgba(239,68,68,.92)' : counts.enRoute > 0 ? 'rgba(245,158,11,.92)' : 'rgba(34,197,94,.85)'
  const emojis = [...modes].slice(0, 4).map(m => MODE_EMOJI[m] ?? '🚔').join('')

  const dots = [
    counts.free    > 0 ? `<span style="color:#22c55e">●${counts.free}</span>` : '',
    counts.enRoute > 0 ? `<span style="color:#fef3c7">●${counts.enRoute}</span>` : '',
    counts.onScene > 0 ? `<span style="color:#fca5a5">●${counts.onScene}</span>` : '',
  ].filter(Boolean).join(' ')

  return L.divIcon({
    className: '',
    html: `<div style="background:${bgCol};border:2px solid white;border-radius:12px;
               padding:4px 7px;display:flex;flex-direction:column;align-items:center;
               box-shadow:0 2px 8px rgba(0,0,0,.5);min-width:46px;gap:1px;">
      <div style="font-size:13px;font-weight:700;color:white;line-height:1;">${n}</div>
      <div style="font-size:11px;line-height:1;">${emojis}</div>
      <div style="font-size:8px;display:flex;gap:3px;">${dots}</div>
    </div>`,
    iconSize:    [58, 56],
    iconAnchor:  [29, 28],
  })
}

// ── main component ─────────────────────────────────────────────────────────

export default function IncidentMap({
  queued, active, incidents,
  resources = [], routeResources, selectedPos, radiusM = 1000,
  selectedIncidentId, onBoundsChange, onIncidentClick, onHistoryChange,
}: Props) {
  const animated   = useAnimatedResources(resources)
  const osrmRoutes = useOsrmRoutes(resources)
  const getIcon    = useCachedIcons()

  // Update module-level registry for cluster icon function
  RESOURCE_REGISTRY.clear()
  animated.forEach(r => RESOURCE_REGISTRY.set(r.id, r))

  const routePins  = routeResources ?? []
  const activePos: [number, number] | null = active ? [active.lat, active.lng] : null

  // Separate selected incident from the cluster group so it renders highlighted
  const selectedInc    = selectedIncidentId != null ? incidents.find(i => i.id === selectedIncidentId) ?? null : null
  const clusterIncs    = selectedInc ? incidents.filter(i => i.id !== selectedIncidentId) : incidents
  const clusterQueued  = queued

  return (
    <>
      <style>{`
        @keyframes selIncPulse {
          0%,100% { box-shadow:0 0 0 6px rgba(47,107,255,.55),0 0 18px rgba(47,107,255,.45),0 2px 10px rgba(0,0,0,.5); }
          50%      { box-shadow:0 0 0 12px rgba(47,107,255,.3),0 0 28px rgba(47,107,255,.25),0 2px 10px rgba(0,0,0,.5); }
        }
        .sel-inc-dot { animation: selIncPulse 2s ease-in-out infinite; }
      `}</style>

      <MapContainer
        center={LONDON}
        zoom={11}
        style={{ height: '100%', width: '100%', minHeight: 300 }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FlyToActive pos={activePos} />
        <FlyToIncident incidents={incidents} targetId={selectedIncidentId} />
        <BoundsEmitter onBoundsChange={onBoundsChange} />
        <HistoryController onChange={onHistoryChange} />

        {/* Search-radius circle */}
        {selectedPos && (
          <Circle
            center={selectedPos}
            radius={radiusM}
            pathOptions={{ color: '#2f6bff', weight: 2, dashArray: '6 4', fillColor: '#2f6bff', fillOpacity: 0.06 }}
          />
        )}

        {/* Routes for resources going to the selected incident */}
        {routePins.map(r => {
          const roadRoute = osrmRoutes.get(r.id)
          const incPos: [number, number] | null = selectedPos ?? (r.targetLat != null && r.targetLng != null ? [r.targetLat, r.targetLng] : null)
          if (!incPos) return null
          return roadRoute ? (
            <Polyline key={`rt-${r.id}`} positions={roadRoute}
              pathOptions={{ color: '#22c55e', weight: 3, opacity: 0.75 }} />
          ) : (
            <Polyline key={`rt-${r.id}`} positions={[[r.lat, r.lng], incPos]}
              pathOptions={{ color: '#22c55e', weight: 2, dashArray: '8 5', opacity: 0.6 }} />
          )
        })}

        {/* Background OSRM routes for other en-route resources */}
        {animated
          .filter(r => r.dispatchStatus === 'ACTIVE' && !routePins.find(rp => rp.id === r.id))
          .map(r => {
            const road = osrmRoutes.get(r.id)
            if (!road) return null
            return (
              <Polyline key={`bgroute-${r.id}`} positions={road}
                pathOptions={{ color: '#f59e0b', weight: 2, opacity: 0.4, dashArray: '6 4' }} />
            )
          })}

        {/* Resource markers — clustered */}
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={buildClusterIcon}
          maxClusterRadius={60}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
        >
          {animated.map(r => {
            const icon   = getIcon(r)
            const tlText = r.dispatchStatus === 'FREE' ? '🟢 Available'
              : r.dispatchStatus === 'ON_SCENE' ? '🔴 On scene' : '🟡 En route'
            return (
              <Marker key={`res-${r.id}`} position={[r.lat, r.lng]} icon={icon} title={r.id}>
                <Popup>
                  <strong>{r.ref}</strong> — {r.name}<br />
                  <small>{r.mode} · {tlText}</small>
                  {r.dispatchCreatedAt && (
                    <><br /><small>Assigned {elapsed(r.dispatchCreatedAt)} ago</small></>
                  )}
                  {r.onSceneAt && (
                    <><br /><small style={{ color: '#ef4444' }}>On scene {elapsed(r.onSceneAt)}</small></>
                  )}
                </Popup>
              </Marker>
            )
          })}
        </MarkerClusterGroup>

        {/* Queued calls + unselected incidents — shared cluster */}
        <MarkerClusterGroup
          chunkedLoading
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          iconCreateFunction={(cluster: any) => {
            const n = cluster.getChildCount()
            return L.divIcon({
              className: '',
              html: `<div style="width:38px;height:38px;border-radius:50%;background:rgba(249,115,22,.88);border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.45);">${n}</div>`,
              iconSize:   [38, 38],
              iconAnchor: [19, 19],
            })
          }}
        >
          {clusterQueued.map(q => (
            <Marker key={`q-${q.callId}`} position={[q.lat, q.lng]} icon={dot('#f97316', 20)}>
              <Popup>
                <strong>Queued call</strong><br />
                {q.phone.slice(-8)}<br />
                <small style={{ color: '#888' }}>{q.postcode}</small>
              </Popup>
            </Marker>
          ))}

          {clusterIncs.map(i => (
            <Marker
              key={`i-${i.id}`}
              position={[i.lat, i.lng]}
              icon={dot(incidentColor(i), 22)}
              eventHandlers={{ click: () => onIncidentClick?.(i) }}
            >
              <Popup>
                <strong style={{ fontFamily: 'monospace' }}>{i.reference}</strong><br />
                {i.crimeType?.replace(/_/g, ' ')}<br />
                <small>P{i.priority} · {i.status}</small>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>

        {/* Selected incident — highlighted outside cluster, always visible */}
        {selectedInc && (
          <Marker
            position={[selectedInc.lat, selectedInc.lng]}
            icon={selectedIncidentDot(incidentColor(selectedInc))}
            zIndexOffset={1000}
            eventHandlers={{ click: () => onIncidentClick?.(selectedInc) }}
          >
            <Popup>
              <strong style={{ fontFamily: 'monospace' }}>{selectedInc.reference}</strong><br />
              {selectedInc.crimeType?.replace(/_/g, ' ')}<br />
              <small>P{selectedInc.priority} · {selectedInc.status}</small>
            </Popup>
          </Marker>
        )}

        {/* Active call — always on top */}
        {active && (
          <Marker position={[active.lat, active.lng]} icon={dot('#2f6bff', 28, true)}>
            <Popup>
              <strong>Active call</strong><br />
              {active.phone}<br />
              <small style={{ color: '#888' }}>{active.address}</small>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </>
  )
}
