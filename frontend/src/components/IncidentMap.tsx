import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface QueuePin    { callId: string; lat: number; lng: number; phone: string; postcode: string }
export interface ActivePin   { callId: string; lat: number; lng: number; phone: string; address: string }
export interface IncidentPin { id: number; lat: number; lng: number; reference: string; priority: number; crimeType: string; status: string }
export interface ResourcePin {
  id: string; lat: number; lng: number; mode: string
  ref: string; name: string; dispatchStatus: string; incidentId: number
}

interface Props {
  queued:         QueuePin[]
  active:         ActivePin | null
  incidents:      IncidentPin[]
  resources?:     ResourcePin[]
  routeResources?: ResourcePin[]
  selectedPos?:   [number, number] | null
  radiusM?:       number
}

const PRIO: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#3b82f6', 5: '#6b7280',
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

const MODE_EMOJI: Record<string, string> = {
  CAR: '🚔', VAN: '🚐', MOTORBIKE: '🏍', SCOOTER: '🛵',
  PUSHBIKE: '🚲', FOOT: '🚶', DOG_CAR: '🐕',
}

function modeIcon(mode: string, status: string) {
  const emoji = MODE_EMOJI[mode] ?? '🚔'
  const bg    = status === 'ON_SCENE' ? '#0d9488' : '#1e3a5f'
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};border:2px solid white;border-radius:7px;padding:2px 5px;font-size:14px;line-height:1.3;box-shadow:0 1px 5px rgba(0,0,0,.55);white-space:nowrap;">${emoji}</div>`,
    iconSize:    [30, 26],
    iconAnchor:  [15, 13],
    popupAnchor: [0, -18],
  })
}

const LONDON: [number, number] = [51.509865, -0.118092]

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

export default function IncidentMap({
  queued, active, incidents,
  resources = [], routeResources, selectedPos, radiusM = 1000,
}: Props) {
  const routePins = routeResources ?? resources
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

      {/* Radius circle around selected incident */}
      {selectedPos && (
        <Circle
          center={selectedPos}
          radius={radiusM}
          pathOptions={{ color: '#2f6bff', weight: 2, dashArray: '6 4', fillColor: '#2f6bff', fillOpacity: 0.06 }}
        />
      )}

      {/* Route lines from selected-incident resources only */}
      {selectedPos && routePins.map(r => (
        <Polyline
          key={`route-${r.id}`}
          positions={[[r.lat, r.lng], selectedPos]}
          pathOptions={{ color: '#22c55e', weight: 2, dashArray: '8 5', opacity: 0.7 }}
        />
      ))}

      {/* Resource markers (live positions) */}
      {resources.map(r => (
        <Marker key={`res-${r.id}`} position={[r.lat, r.lng]} icon={modeIcon(r.mode, r.dispatchStatus)}>
          <Popup>
            <strong>{r.ref}</strong><br />
            {r.name}<br />
            <small>{r.mode} · {r.dispatchStatus === 'ON_SCENE' ? '🟢 On scene' : '🔵 En route'}</small>
          </Popup>
        </Marker>
      ))}

      {/* Queued calls and incidents share a cluster group */}
      <MarkerClusterGroup
        chunkedLoading
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        iconCreateFunction={(cluster: any) => {
          const n = cluster.getChildCount()
          return L.divIcon({
            className: '',
            html: `<div style="width:38px;height:38px;border-radius:50%;background:rgba(249,115,22,0.88);border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.45);">${n}</div>`,
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

      {/* Active call outside cluster so it's always visible */}
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
