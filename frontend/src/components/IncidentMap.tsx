import { useEffect, useRef, useState } from 'react'
import {
  MapContainer, TileLayer, Marker, Popup, Circle, Polyline,
  useMap, useMapEvents,
} from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

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

interface Props {
  queued:           QueuePin[]
  active:           ActivePin | null
  incidents:        IncidentPin[]
  resources?:       ResourcePin[]
  routeResources?:  ResourcePin[]
  selectedPos?:     [number, number] | null
  radiusM?:         number
  onBoundsChange?:  (b: MapBounds) => void
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
  return '#f59e0b' // ACTIVE / en-route
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
        <span style="opacity:.85;">${sinceAssigned}</span>
        <br><span style="color:#fca5a5;">${sinceOnScene}</span>
      </div>`
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

// ── icon cache — only rebuild when status/mode/minute changes ─────────────

function useCachedIcons() {
  const cache = useRef(new Map<string, { key: string; icon: L.DivIcon }>())
  return (r: ResourcePin): L.DivIcon => {
    const assignedMin  = r.dispatchCreatedAt ? Math.floor((Date.now() - new Date(r.dispatchCreatedAt).getTime()) / 60000) : 0
    const onSceneMin   = r.onSceneAt        ? Math.floor((Date.now() - new Date(r.onSceneAt).getTime()) / 60000) : 0
    const key = `${r.dispatchStatus}|${r.mode}|${assignedMin}|${onSceneMin}`
    const hit = cache.current.get(r.id)
    if (hit && hit.key === key) return hit.icon
    const icon = buildResourceIcon(r)
    cache.current.set(r.id, { key, icon })
    return icon
  }
}

// ── smooth position animation between polls ───────────────────────────────

function useAnimatedResources(resources: ResourcePin[]): ResourcePin[] {
  type Seg = { fromLat: number; fromLng: number; toLat: number; toLng: number; startMs: number }
  const segs   = useRef(new Map<string, Seg>())
  const [, bump] = useState(0)

  // When raw poll data changes, advance animation targets
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

  // Tick at 10fps to advance animation
  useEffect(() => {
    const id = setInterval(() => bump(n => n + 1), 100)
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

// ── OSRM road-route fetching ───────────────────────────────────────────────

function useOsrmRoutes(resources: ResourcePin[]): Map<string, [number, number][]> {
  const [routes, setRoutes]   = useState(new Map<string, [number, number][]>())
  const posCache              = useRef(new Map<string, string>())

  useEffect(() => {
    const enRoute = resources.filter(
      r => r.dispatchStatus === 'ACTIVE' && r.targetLat != null && r.targetLng != null
    )

    enRoute.forEach(r => {
      // Re-fetch only when position changes by ~110m (3rd decimal place)
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
          const coords: [number, number][] | undefined = data.routes?.[0]?.geometry?.coordinates
          if (coords) {
            setRoutes(prev => new Map(prev).set(r.id,
              coords.map(([lon, lat]) => [lat, lon] as [number, number])
            ))
          }
        })
        .catch(() => {})
    })

    // Drop routes for resources no longer en route
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

function BoundsEmitter({ onBoundsChange }: { onBoundsChange?: (b: MapBounds) => void }) {
  const map = useMap()

  // Emit initial bounds
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

// ── resource cluster icon ──────────────────────────────────────────────────

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

  const n      = markers.length
  const bgCol  = counts.onScene > 0 ? 'rgba(239,68,68,.92)' : counts.enRoute > 0 ? 'rgba(245,158,11,.92)' : 'rgba(34,197,94,.85)'
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

// ── main component ──────────────────────────────────────────────────────────

export default function IncidentMap({
  queued, active, incidents,
  resources = [], routeResources, selectedPos, radiusM = 1000,
  onBoundsChange,
}: Props) {
  const animated     = useAnimatedResources(resources)
  const osrmRoutes   = useOsrmRoutes(resources)  // uses raw positions for route fetch
  const getIcon      = useCachedIcons()

  // Update module-level registry for cluster icon function
  RESOURCE_REGISTRY.clear()
  animated.forEach(r => RESOURCE_REGISTRY.set(r.id, r))

  const routePins    = routeResources ?? []
  const activePos: [number, number] | null = active ? [active.lat, active.lng] : null

  return (
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
      <BoundsEmitter onBoundsChange={onBoundsChange} />

      {/* Search-radius circle around selected incident */}
      {selectedPos && (
        <Circle
          center={selectedPos}
          radius={radiusM}
          pathOptions={{ color: '#2f6bff', weight: 2, dashArray: '6 4', fillColor: '#2f6bff', fillOpacity: 0.06 }}
        />
      )}

      {/* Route lines for resources going to the selected incident */}
      {routePins.map(r => {
        const roadRoute = osrmRoutes.get(r.id)
        const incPos: [number, number] | null = selectedPos ?? (r.targetLat != null && r.targetLng != null ? [r.targetLat, r.targetLng] : null)
        if (!incPos) return null
        return roadRoute ? (
          <Polyline
            key={`rt-${r.id}`}
            positions={roadRoute}
            pathOptions={{ color: '#22c55e', weight: 3, opacity: 0.75 }}
          />
        ) : (
          <Polyline
            key={`rt-${r.id}`}
            positions={[[r.lat, r.lng], incPos]}
            pathOptions={{ color: '#22c55e', weight: 2, dashArray: '8 5', opacity: 0.6 }}
          />
        )
      })}

      {/* OSRM routes for all other en-route resources (not in routePins) */}
      {animated
        .filter(r => r.dispatchStatus === 'ACTIVE' && !routePins.find(rp => rp.id === r.id))
        .map(r => {
          const road = osrmRoutes.get(r.id)
          if (!road) return null
          return (
            <Polyline
              key={`bgroute-${r.id}`}
              positions={road}
              pathOptions={{ color: '#f59e0b', weight: 2, opacity: 0.45, dashArray: '6 4' }}
            />
          )
        })}

      {/* Resource markers — clustered with custom icon */}
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
            : r.dispatchStatus === 'ON_SCENE' ? '🔴 On scene'
            : '🟡 En route'

          return (
            <Marker
              key={`res-${r.id}`}
              position={[r.lat, r.lng]}
              icon={icon}
              title={r.id}
            >
              <Popup>
                <strong>{r.ref}</strong> — {r.name}<br />
                <small>{r.mode} · {tlText}</small>
                {r.dispatchCreatedAt && (
                  <>
                    <br />
                    <small>Assigned {elapsed(r.dispatchCreatedAt)} ago</small>
                  </>
                )}
                {r.onSceneAt && (
                  <>
                    <br />
                    <small style={{ color: '#ef4444' }}>On scene {elapsed(r.onSceneAt)}</small>
                  </>
                )}
              </Popup>
            </Marker>
          )
        })}
      </MarkerClusterGroup>

      {/* Queued calls and incidents share a separate cluster group */}
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
        {queued.map(q => (
          <Marker key={`q-${q.callId}`} position={[q.lat, q.lng]} icon={dot('#f97316', 20)}>
            <Popup>
              <strong>Queued call</strong><br />
              {q.phone.slice(-8)}<br />
              <small style={{ color: '#888' }}>{q.postcode}</small>
            </Popup>
          </Marker>
        ))}

        {incidents.map(i => (
          <Marker key={`i-${i.id}`} position={[i.lat, i.lng]} icon={dot(incidentColor(i), 22)}>
            <Popup>
              <strong style={{ fontFamily: 'monospace' }}>{i.reference}</strong><br />
              {i.crimeType?.replace(/_/g, ' ')}<br />
              <small>P{i.priority} · {i.status}</small>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>

      {/* Active call — outside cluster, always visible */}
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
  )
}
