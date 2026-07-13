import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResourcePin } from './IncidentMap'
import { api } from '../api/client'

// ── exported types ─────────────────────────────────────────────────────────

export interface ActiveDispatch {
  id: number; incidentId: number; incidentRef: string; priority: number
  status: string; address: string; postcode: string
  latitude: number; longitude: number; crimeType: string
  createdAt: string; onSceneAt: string | null
  resources: {
    drId?: number; resourceId?: number
    type: string; ref: string; name: string; mode?: string
  }[]
}

interface NearbyOfficer {
  id: number; collarNumber: string; name: string; rank: string
  mode: string; firearms: boolean; stationName: string; distanceM: number
}

interface NearbyVehicle {
  id: number; identifier: string; type: string; seats: number
  stationName: string; distanceM: number
}

interface IncidentNote {
  id: number; author: string; noteText: string; noteType: string; createdAt: string
}

interface Props {
  dispatch:      ActiveDispatch
  resourcePins?: ResourcePin[]
  onClose:       () => void
  onOnScene:     (id: number) => void
  onResolve:     (id: number) => void
  onRefresh:     () => void
}

// ── constants ──────────────────────────────────────────────────────────────

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

// ── helpers ────────────────────────────────────────────────────────────────

function fmt(t: string | null | undefined) { return (t ?? '').replace(/_/g, ' ') }

function elapsedLong(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m ${sec}s`
  return `${m}m ${sec}s`
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function etaMin(lat: number, lng: number, tLat: number, tLng: number, mode: string): number {
  const d = haversineM(lat, lng, tLat, tLng)
  return Math.max(1, Math.ceil(d / (SPEED_MS[mode] ?? 1.4) / 60))
}

function noteIcon(type: string) {
  if (type === 'VOICE') return '🎤'
  if (type === 'PHOTO') return '📷'
  return '📝'
}

// ── component ─────────────────────────────────────────────────────────────

export default function IncidentDetailPanel({
  dispatch, resourcePins = [], onClose, onOnScene, onResolve, onRefresh,
}: Props) {
  const [, tick]          = useState(0)
  const [notes, setNotes] = useState<IncidentNote[]>([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteMode, setNoteMode]   = useState<'text' | 'voice'>('text')
  const [noteText, setNoteText]   = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Resource management state
  const [showAddResource, setShowAddResource] = useState(false)
  const [addResType, setAddResType]           = useState<'officer' | 'vehicle'>('officer')
  const [nearbyOfficers, setNearbyOfficers]   = useState<NearbyOfficer[]>([])
  const [nearbyVehicles, setNearbyVehicles]   = useState<NearbyVehicle[]>([])
  const [loadingNearby, setLoadingNearby]     = useState(false)
  const [removingDr, setRemovingDr]           = useState<number | null>(null)
  const [addingRes, setAddingRes]             = useState<number | null>(null)

  // Voice recording state
  const [isRecording, setIsRecording]         = useState(false)
  const [liveTranscript, setLiveTranscript]   = useState('')
  const [recSecs, setRecSecs]                 = useState(0)
  const recognitionRef    = useRef<unknown>(null)
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null)
  const audioChunksRef    = useRef<Blob[]>([])
  const recTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const liveTranscriptRef = useRef('')  // stable ref for async stopRecording

  // Photo state
  const photoInputRef   = useRef<HTMLInputElement>(null)
  const [pendingPhoto, setPendingPhoto] = useState<{ url: string; name: string } | null>(null)

  // Local audio blobs for in-session playback (not persisted across refresh)
  const localAudiosRef = useRef(new Map<number, string>())

  // 1-second tick for live elapsed timers
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  // Keep liveTranscriptRef in sync
  useEffect(() => { liveTranscriptRef.current = liveTranscript }, [liveTranscript])

  // Fetch notes on mount and when incidentId changes
  const fetchNotes = useCallback(() => {
    api<IncidentNote[]>(`/api/dispatch/incidents/${dispatch.incidentId}/notes`)
      .then(n => { setNotes(n); setLoadingNotes(false) })
      .catch(() => setLoadingNotes(false))
  }, [dispatch.incidentId])

  useEffect(() => {
    setLoadingNotes(true)
    fetchNotes()
  }, [fetchNotes])

  // ── voice recording ────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecAPI = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
      if (SpeechRecAPI) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rec = new SpeechRecAPI() as any
        rec.continuous = true
        rec.interimResults = true
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rec.onresult = (e: any) => {
          let text = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            text += e.results[i][0].transcript
          }
          setLiveTranscript(text)
        }
        rec.onerror = () => {}
        rec.start()
        recognitionRef.current = rec
      }

      const mr = new MediaRecorder(stream)
      audioChunksRef.current = []
      mr.ondataavailable = e => audioChunksRef.current.push(e.data)
      mr.start(100)
      mediaRecorderRef.current = mr

      setIsRecording(true)
      setRecSecs(0)
      recTimerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000)
    } catch {
      // Mic permission denied — silently skip
    }
  }

  function stopRecording(): Promise<{ text: string; audioUrl: string | null }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (recognitionRef.current as any)?.stop?.()
    if (recTimerRef.current) clearInterval(recTimerRef.current)

    return new Promise(resolve => {
      const finalText = liveTranscriptRef.current
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
          const url = URL.createObjectURL(blob)
          mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())
          resolve({ text: finalText, audioUrl: url })
        }
        mediaRecorderRef.current.stop()
      } else {
        resolve({ text: finalText, audioUrl: null })
      }
    })
  }

  async function handleStopAndSave() {
    const { text, audioUrl } = await stopRecording()
    setIsRecording(false)
    setLiveTranscript('')

    if (!text.trim()) {
      setShowNoteInput(false)
      return
    }

    setSavingNote(true)
    try {
      const saved = await api<IncidentNote>(`/api/dispatch/incidents/${dispatch.incidentId}/notes`, {
        method: 'POST',
        body: { author: 'Dispatcher', noteText: text.trim(), noteType: 'VOICE' },
      })
      if (audioUrl) localAudiosRef.current.set(saved.id, audioUrl)
      setNotes(prev => [...prev, saved])
      setNoteText('')
      setShowNoteInput(false)
      onRefresh()
    } catch {
      setNoteText(text)
      setNoteMode('text')
    } finally {
      setSavingNote(false)
    }
  }

  // ── text / photo save ──────────────────────────────────────────────────────

  async function handleSaveNote() {
    const body = pendingPhoto
      ? `[📷 Photo: ${pendingPhoto.name}]\n${noteText}`.trim()
      : noteText.trim()
    if (!body) return

    setSavingNote(true)
    try {
      const saved = await api<IncidentNote>(`/api/dispatch/incidents/${dispatch.incidentId}/notes`, {
        method: 'POST',
        body: { author: 'Dispatcher', noteText: body, noteType: pendingPhoto ? 'PHOTO' : 'TEXT' },
      })
      setNotes(prev => [...prev, saved])
      setNoteText('')
      setPendingPhoto(null)
      setShowNoteInput(false)
      onRefresh()
    } catch {
      // keep the form for retry
    } finally {
      setSavingNote(false)
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPendingPhoto({ url, name: file.name })
    setNoteMode('text')
    setShowNoteInput(true)
  }

  // ── resource management ────────────────────────────────────────────────────

  async function fetchNearby() {
    setLoadingNearby(true)
    try {
      const data = await api<{ officers: NearbyOfficer[]; vehicles: NearbyVehicle[] }>(
        `/api/dispatch/incidents/${dispatch.incidentId}/resources?radius=3000`
      )
      setNearbyOfficers(data.officers ?? [])
      setNearbyVehicles(data.vehicles ?? [])
    } catch {
      // ignore
    } finally {
      setLoadingNearby(false)
    }
  }

  async function handleRemoveResource(drId: number) {
    setRemovingDr(drId)
    try {
      await api(`/api/dispatch/${dispatch.id}/resources/${drId}`, { method: 'DELETE' })
      onRefresh()
    } catch {
      // ignore
    } finally {
      setRemovingDr(null)
    }
  }

  async function handleAddResource(resourceId: number, type: 'officer' | 'vehicle') {
    setAddingRes(resourceId)
    try {
      const body = type === 'officer'
        ? { officerIds: [resourceId], vehicleIds: [] }
        : { officerIds: [], vehicleIds: [resourceId] }
      await api(`/api/dispatch/${dispatch.id}/add-resources`, { method: 'POST', body })
      setShowAddResource(false)
      onRefresh()
    } catch {
      // ignore
    } finally {
      setAddingRes(null)
    }
  }

  // ── derived ────────────────────────────────────────────────────────────────

  const prioColor = PRIO_COLORS[dispatch.priority] ?? '#6b7280'

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      animation: 'idpFadeIn 0.18s ease',
    }}>
      <style>{`
        @keyframes idpFadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        @keyframes recPulse   { 0%,100% { opacity:1; } 50% { opacity:.35; } }
      `}</style>

      {/* ── Header ── */}
      <div style={{
        padding: '11px 14px', borderBottom: '1px solid var(--hair)', flexShrink: 0,
        background: `linear-gradient(135deg,${prioColor}20,${prioColor}06)`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              background: prioColor + '33', border: `1px solid ${prioColor}`,
              color: prioColor, borderRadius: 6, padding: '2px 8px', fontSize: '0.71rem', fontWeight: 700,
            }}>P{dispatch.priority}</span>
            <span style={{
              background: dispatch.status === 'ON_SCENE' ? 'rgba(6,182,212,.15)' : 'rgba(34,197,94,.12)',
              border: `1px solid ${dispatch.status === 'ON_SCENE' ? 'rgba(6,182,212,.5)' : 'rgba(34,197,94,.4)'}`,
              color: dispatch.status === 'ON_SCENE' ? '#06b6d4' : '#22c55e',
              borderRadius: 6, padding: '2px 8px', fontSize: '0.68rem', fontWeight: 700,
            }}>{dispatch.status === 'ON_SCENE' ? '🔴 ON SCENE' : '🟡 EN ROUTE'}</span>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
            borderRadius: 6, color: 'var(--text-faint)', fontSize: '0.88rem',
            width: 24, height: 24, cursor: 'pointer', lineHeight: 1, padding: 0,
          }}>✕</button>
        </div>
        <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: 2 }}>
          {dispatch.incidentRef}
        </div>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: 2 }}>{fmt(dispatch.crimeType)}</div>
        <div className="faint" style={{ fontSize: '0.71rem' }}>📍 {dispatch.address}, {dispatch.postcode}</div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: 11 }}>

        {/* Elapsed timers */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hair)',
          borderRadius: 10, padding: '9px 12px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        }}>
          <div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginBottom: 2, letterSpacing: '.06em' }}>DISPATCHED</div>
            <div className="mono" style={{ fontSize: '0.97rem', fontWeight: 700, color: '#22c55e' }}>
              {elapsedLong(dispatch.createdAt)}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: 2 }}>
              {fmtTime(dispatch.createdAt)}
            </div>
          </div>
          {dispatch.onSceneAt ? (
            <div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginBottom: 2, letterSpacing: '.06em' }}>ON SCENE</div>
              <div className="mono" style={{ fontSize: '0.97rem', fontWeight: 700, color: '#06b6d4' }}>
                {elapsedLong(dispatch.onSceneAt)}
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: 2 }}>
                {fmtTime(dispatch.onSceneAt)}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.2rem', marginBottom: 2 }}>🟡</div>
                <div style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 600 }}>En Route</div>
              </div>
            </div>
          )}
        </div>

        {/* Assigned resources */}
        <div>
          <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6, letterSpacing: '.06em' }}>
            ASSIGNED RESOURCES ({dispatch.resources.length})
          </div>
          {dispatch.resources.length === 0 && (
            <p className="faint" style={{ fontSize: '0.76rem' }}>No resources assigned.</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dispatch.resources.map((r, i) => {
              const pin = resourcePins.find(p => p.ref === r.ref)
              const status = pin?.dispatchStatus ?? 'ACTIVE'
              const tlCol = status === 'ON_SCENE' ? '#ef4444' : status === 'FREE' ? '#22c55e' : '#f59e0b'

              let etaLabel = ''
              if (pin && status === 'ACTIVE') {
                const eta = etaMin(pin.lat, pin.lng, dispatch.latitude, dispatch.longitude, r.mode ?? 'FOOT')
                etaLabel = `~${eta} min`
              }

              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hair)',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: tlCol, boxShadow: `0 0 5px ${tlCol}99`,
                  }} />
                  <span style={{ fontSize: '0.95rem', lineHeight: 1 }}>{MODE_EMOJI[r.mode ?? 'FOOT'] ?? '🚶'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.77rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>
                    <div className="faint mono" style={{ fontSize: '0.65rem' }}>{r.ref}</div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {status === 'ACTIVE' && etaLabel && (
                      <div style={{ fontSize: '0.67rem', color: '#22c55e', fontWeight: 600 }}>ETA {etaLabel}</div>
                    )}
                    {status === 'ON_SCENE' && dispatch.onSceneAt && (
                      <div style={{ fontSize: '0.65rem', color: '#06b6d4' }}>{elapsedLong(dispatch.onSceneAt)}</div>
                    )}
                    <div style={{ fontSize: '0.63rem', color: tlCol }}>
                      {status === 'ON_SCENE' ? 'On scene' : status === 'FREE' ? 'Free' : 'En route'}
                    </div>
                  </div>
                  {r.drId != null && (
                    <button type="button"
                      onClick={() => handleRemoveResource(r.drId!)}
                      disabled={removingDr === r.drId}
                      title="Remove resource"
                      style={{
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#fca5a5', borderRadius: 5, width: 20, height: 20,
                        cursor: 'pointer', fontSize: '0.7rem', padding: 0, lineHeight: 1,
                        opacity: removingDr === r.drId ? 0.5 : 1, flexShrink: 0,
                      }}>{removingDr === r.drId ? '…' : '×'}</button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add resource */}
          <div style={{ marginTop: 7 }}>
            <button type="button"
              onClick={() => {
                const opening = !showAddResource
                setShowAddResource(opening)
                if (opening) fetchNearby()
              }}
              style={{
                background: showAddResource ? 'rgba(47,107,255,0.18)' : 'rgba(47,107,255,0.08)',
                border: '1px solid rgba(47,107,255,0.4)',
                color: '#a5b4fc', borderRadius: 7, padding: '4px 10px',
                cursor: 'pointer', fontSize: '0.66rem', fontWeight: 600, width: '100%',
              }}>+ Add Resource</button>

            {showAddResource && (
              <div style={{
                marginTop: 6, padding: '10px 12px', borderRadius: 10,
                background: 'rgba(47,107,255,0.05)', border: '1px solid rgba(47,107,255,0.22)',
              }}>
                <div style={{ display: 'flex', gap: 4, marginBottom: 7, alignItems: 'center' }}>
                  {(['officer', 'vehicle'] as const).map(t => (
                    <button key={t} type="button"
                      onClick={() => setAddResType(t)}
                      style={{
                        background: addResType === t ? 'rgba(47,107,255,0.22)' : 'transparent',
                        border: '1px solid rgba(47,107,255,0.35)',
                        color: '#a5b4fc', borderRadius: 6, padding: '3px 9px',
                        cursor: 'pointer', fontSize: '0.65rem', fontWeight: 600, textTransform: 'capitalize',
                      }}>{t === 'officer' ? 'Officers' : 'Vehicles'}</button>
                  ))}
                  {loadingNearby && (
                    <span className="faint" style={{ fontSize: '0.63rem', marginLeft: 4 }}>Loading…</span>
                  )}
                </div>

                <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {addResType === 'officer' && nearbyOfficers.map(o => {
                    const assigned = dispatch.resources.some(r => r.resourceId === o.id && r.type === 'OFFICER')
                    return (
                      <div key={o.id} style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 7,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hair)',
                        opacity: assigned ? 0.45 : 1,
                      }}>
                        <span style={{ fontSize: '0.82rem' }}>{MODE_EMOJI[o.mode] ?? '🚶'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {o.rank} {o.name}
                          </div>
                          <div className="faint mono" style={{ fontSize: '0.62rem' }}>
                            {o.collarNumber} · {o.stationName} · {Math.round(o.distanceM)}m
                          </div>
                        </div>
                        <button type="button"
                          disabled={assigned || addingRes === o.id}
                          onClick={() => handleAddResource(o.id, 'officer')}
                          style={{
                            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
                            color: '#86efac', borderRadius: 5, padding: '3px 8px',
                            cursor: assigned ? 'not-allowed' : 'pointer', fontSize: '0.65rem', fontWeight: 600,
                            opacity: assigned || addingRes === o.id ? 0.45 : 1, flexShrink: 0,
                          }}>{assigned ? 'Assigned' : addingRes === o.id ? '…' : 'Add'}</button>
                      </div>
                    )
                  })}
                  {addResType === 'officer' && !loadingNearby && nearbyOfficers.length === 0 && (
                    <p className="faint" style={{ fontSize: '0.73rem', margin: 0 }}>No nearby officers available.</p>
                  )}

                  {addResType === 'vehicle' && nearbyVehicles.map(v => {
                    const assigned = dispatch.resources.some(r => r.resourceId === v.id && r.type === 'VEHICLE')
                    return (
                      <div key={v.id} style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '5px 8px', borderRadius: 7,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hair)',
                        opacity: assigned ? 0.45 : 1,
                      }}>
                        <span style={{ fontSize: '0.82rem' }}>🚔</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.74rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {v.identifier} – {fmt(v.type)}
                          </div>
                          <div className="faint mono" style={{ fontSize: '0.62rem' }}>
                            {v.seats} seats · {v.stationName} · {Math.round(v.distanceM)}m
                          </div>
                        </div>
                        <button type="button"
                          disabled={assigned || addingRes === v.id}
                          onClick={() => handleAddResource(v.id, 'vehicle')}
                          style={{
                            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)',
                            color: '#86efac', borderRadius: 5, padding: '3px 8px',
                            cursor: assigned ? 'not-allowed' : 'pointer', fontSize: '0.65rem', fontWeight: 600,
                            opacity: assigned || addingRes === v.id ? 0.45 : 1, flexShrink: 0,
                          }}>{assigned ? 'Assigned' : addingRes === v.id ? '…' : 'Add'}</button>
                      </div>
                    )
                  })}
                  {addResType === 'vehicle' && !loadingNearby && nearbyVehicles.length === 0 && (
                    <p className="faint" style={{ fontSize: '0.73rem', margin: 0 }}>No nearby vehicles available.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Case notes */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-dim)', letterSpacing: '.06em' }}>
              CASE NOTES ({notes.length})
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button"
                onClick={() => { setNoteMode('text'); setShowNoteInput(s => !s); setLiveTranscript('') }}
                style={{
                  background: showNoteInput && noteMode === 'text' ? 'rgba(47,107,255,0.2)' : 'rgba(47,107,255,0.1)',
                  border: '1px solid rgba(47,107,255,0.4)',
                  color: '#a5b4fc', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: '0.66rem',
                }}>📝 Note</button>
              <button type="button"
                onClick={() => photoInputRef.current?.click()}
                style={{
                  background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.35)',
                  color: '#fde68a', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: '0.66rem',
                }}>📷 Photo</button>
              <button type="button"
                onClick={() => {
                  if (isRecording) {
                    handleStopAndSave()
                  } else {
                    setNoteMode('voice')
                    setShowNoteInput(true)
                    startRecording()
                  }
                }}
                style={{
                  background: isRecording ? 'rgba(239,68,68,0.18)' : 'rgba(34,197,94,0.08)',
                  border: `1px solid ${isRecording ? 'rgba(239,68,68,0.55)' : 'rgba(34,197,94,0.35)'}`,
                  color: isRecording ? '#fca5a5' : '#86efac',
                  borderRadius: 6, padding: '3px 8px', cursor: 'pointer', fontSize: '0.66rem',
                  animation: isRecording ? 'recPulse 1.2s ease infinite' : 'none',
                }}>{isRecording ? '⏹ Stop' : '🎤 Voice'}</button>
            </div>
          </div>

          <input
            ref={photoInputRef} type="file" accept="image/*" capture="environment"
            style={{ display: 'none' }} onChange={handlePhotoSelect}
          />

          {/* Notes list */}
          <div style={{ maxHeight: 190, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {loadingNotes && <p className="faint" style={{ fontSize: '0.74rem' }}>Loading…</p>}
            {!loadingNotes && notes.length === 0 && (
              <p className="faint" style={{ fontSize: '0.74rem' }}>No notes yet.</p>
            )}
            {notes.map(note => (
              <div key={note.id} style={{
                padding: '7px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hair)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.67rem', fontWeight: 600, color: 'var(--text-dim)' }}>
                    {noteIcon(note.noteType)} {note.author}
                  </span>
                  <span className="faint" style={{ fontSize: '0.63rem' }}>
                    {new Date(note.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', lineHeight: 1.45, wordBreak: 'break-word' }}>{note.noteText}</div>
                {localAudiosRef.current.has(note.id) && (
                  <audio controls style={{ marginTop: 6, width: '100%', height: 28 }}
                    src={localAudiosRef.current.get(note.id)} />
                )}
              </div>
            ))}
          </div>

          {/* Note input */}
          {showNoteInput && (
            <div style={{
              marginTop: 8, padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(47,107,255,0.3)',
            }}>
              {noteMode === 'voice' && isRecording ? (
                // Recording UI
                <div style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 7 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#ef4444',
                      animation: 'recPulse 0.8s ease infinite',
                    }} />
                    <span style={{ fontSize: '0.74rem', color: '#fca5a5', fontWeight: 600 }}>RECORDING</span>
                    <span className="mono" style={{ fontSize: '0.71rem', color: 'var(--text-dim)' }}>
                      {String(Math.floor(recSecs / 60)).padStart(2, '0')}:{String(recSecs % 60).padStart(2, '0')}
                    </span>
                  </div>
                  {liveTranscript && (
                    <div style={{
                      fontSize: '0.74rem', color: 'var(--text-dim)', fontStyle: 'italic',
                      background: 'rgba(0,0,0,.22)', borderRadius: 6, padding: '6px 8px',
                      marginBottom: 9, minHeight: 32, lineHeight: 1.45,
                    }}>"{liveTranscript}"</div>
                  )}
                  {!liveTranscript && (
                    <div style={{ fontSize: '0.71rem', color: 'var(--text-faint)', marginBottom: 9 }}>
                      Listening… speak clearly
                    </div>
                  )}
                  <button type="button" onClick={handleStopAndSave} style={{
                    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
                    color: '#fca5a5', borderRadius: 8, padding: '7px 20px',
                    cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600,
                  }}>Stop & Save</button>
                </div>
              ) : (
                // Text / photo input UI
                <>
                  {pendingPhoto && (
                    <div style={{ marginBottom: 8 }}>
                      <img
                        src={pendingPhoto.url} alt="capture"
                        style={{ maxWidth: '100%', maxHeight: 90, borderRadius: 6, display: 'block', marginBottom: 4 }}
                      />
                      <div className="faint" style={{ fontSize: '0.65rem' }}>📷 {pendingPhoto.name}</div>
                    </div>
                  )}
                  <textarea
                    rows={3}
                    placeholder={pendingPhoto ? 'Caption (optional)…' : 'Type note…'}
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNote() }}
                    style={{
                      width: '100%', boxSizing: 'border-box', resize: 'vertical',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
                      borderRadius: 8, color: 'inherit', fontSize: '0.79rem', padding: '7px 10px',
                      outline: 'none', fontFamily: 'inherit', marginBottom: 7,
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" onClick={handleSaveNote}
                      disabled={savingNote || (!noteText.trim() && !pendingPhoto)}
                      style={{
                        flex: 1,
                        background: 'rgba(47,107,255,0.14)', border: '1px solid rgba(47,107,255,0.5)',
                        color: '#a5b4fc', borderRadius: 8, padding: '7px 0',
                        cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                        opacity: savingNote || (!noteText.trim() && !pendingPhoto) ? 0.5 : 1,
                      }}>{savingNote ? 'Saving…' : 'Save Note'}</button>
                    <button type="button" onClick={() => { setShowNoteInput(false); setNoteText(''); setPendingPhoto(null) }}
                      style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
                        color: 'var(--text-faint)', borderRadius: 8, padding: '7px 12px',
                        cursor: 'pointer', fontSize: '0.74rem',
                      }}>Cancel</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div style={{
        padding: '10px 14px', borderTop: '1px solid var(--hair)',
        background: 'rgba(0,0,0,.18)', flexShrink: 0,
      }}>
        <div style={{ fontSize: '0.63rem', color: 'var(--text-faint)', marginBottom: 6, letterSpacing: '.06em' }}>ACTIONS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {dispatch.status === 'ACTIVE' && (
            <button type="button" onClick={() => onOnScene(dispatch.id)} style={{
              background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.5)',
              color: '#06b6d4', borderRadius: 8, padding: '9px 0', cursor: 'pointer',
              fontSize: '0.77rem', fontWeight: 700, width: '100%',
            }}>🔵 Confirm On Scene</button>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            <button type="button" onClick={() => onResolve(dispatch.id)} style={{
              background: 'rgba(34,197,94,0.11)', border: '1px solid rgba(34,197,94,0.4)',
              color: '#22c55e', borderRadius: 8, padding: '8px 0', cursor: 'pointer',
              fontSize: '0.74rem', fontWeight: 600,
            }}>✓ Resolve</button>
            <button type="button" onClick={onClose} style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--hair)',
              color: 'var(--text-dim)', borderRadius: 8, padding: '8px 0', cursor: 'pointer',
              fontSize: '0.74rem',
            }}>⟲ Reassign</button>
          </div>
          <button type="button" onClick={() => onResolve(dispatch.id)} style={{
            background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.28)',
            color: '#fca5a5', borderRadius: 8, padding: '7px 0', cursor: 'pointer',
            fontSize: '0.71rem', width: '100%',
          }}>✕ Cancel Call</button>
        </div>
      </div>
    </div>
  )
}
