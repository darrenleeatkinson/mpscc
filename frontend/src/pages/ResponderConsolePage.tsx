import { useState, useEffect } from 'react'
import TopBar from '../components/TopBar'
import IncidentMap from '../components/IncidentMap'
import IncidentWatchPanel from '../components/IncidentWatchPanel'
import type { QueuePin, ActivePin, IncidentPin } from '../components/IncidentMap'
import { api, ApiError } from '../api/client'

interface QueueStatus {
  queued: number
  snapshot: CallSnapshot[]
}
interface CallSnapshot {
  callId: string
  phone: string
  postcode: string
  tsn: number
  latitude: number
  longitude: number
}
interface ActiveCall {
  callId: string
  phone: string
  postcode: string
  address: string
  latitude: number
  longitude: number
  accuracyMeters: number
}
interface Assessment {
  crimeType: string
  description: string
  injuries: boolean
  weapons: boolean
  suspectsOnScene: boolean
  peopleAtRisk: number
  suggestedPriority: number
}
interface AnswerResponse {
  call: ActiveCall
  assessment: Assessment
}
interface IncidentForm {
  callerName: string
  address: string
  postcode: string
  injuries: boolean
  weapons: boolean
  suspectsOnScene: boolean
  peopleAtRisk: number
  priority: number
}
interface CreatedIncident {
  id: number
  reference: string
  priority: number
  status: string
}
interface CreateIncidentReq {
  callId: string
  callerPhone: string
  callerName: string
  address: string
  postcode: string
  latitude: number
  longitude: number
  crimeType: string
  crimeDescription: string
  injuries: boolean
  weapons: boolean
  suspectsOnScene: boolean
  peopleAtRisk: number
  priority: number
}
interface IncidentRecentItem {
  id: number
  reference: string
  priority: number
  status: string
  crimeType: string
  createdAt: string
  latitude: number | null
  longitude: number | null
}

const PRIORITY_COLORS: Record<number, string> = {
  1: '#ef4444',
  2: '#f59e0b',
  3: '#eab308',
  4: '#3b82f6',
  5: '#6b7280',
}

const DEFAULT_FORM: IncidentForm = {
  callerName: '',
  address: '',
  postcode: '',
  injuries: false,
  weapons: false,
  suspectsOnScene: false,
  peopleAtRisk: 0,
  priority: 3,
}

type BoolKey = 'injuries' | 'weapons' | 'suspectsOnScene'

const TOGGLE_FIELDS: { key: BoolKey; label: string }[] = [
  { key: 'injuries',        label: 'Injuries?' },
  { key: 'weapons',         label: 'Weapon?' },
  { key: 'suspectsOnScene', label: 'Suspects on scene?' },
]

function formatCrimeType(t: string): string {
  return t.replace(/_/g, ' ')
}

export default function ResponderConsolePage() {
  const [queue,      setQueue]      = useState<QueueStatus>({ queued: 0, snapshot: [] })
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [incidents,  setIncidents]  = useState<IncidentRecentItem[]>([])
  const [form,       setForm]       = useState<IncidentForm>(DEFAULT_FORM)
  const [answering,  setAnswering]  = useState(false)
  const [creating,   setCreating]   = useState(false)
  const [created,    setCreated]    = useState<CreatedIncident | null>(null)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const [showWatch,  setShowWatch]  = useState(true)

  // Queue poll: 5 s
  useEffect(() => {
    const poll = () =>
      api<QueueStatus>('/api/intake/queue').then(setQueue).catch(() => {})
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  // Incidents poll: 10 s
  useEffect(() => {
    const poll = () =>
      api<IncidentRecentItem[]>('/api/incidents/recent').then(setIncidents).catch(() => {})
    poll()
    const id = setInterval(poll, 10_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!activeCall) return
    setForm(f => ({ ...f, address: activeCall.address, postcode: activeCall.postcode }))
  }, [activeCall])

  useEffect(() => {
    if (!assessment) return
    setForm(f => ({
      ...f,
      injuries:        assessment.injuries,
      weapons:         assessment.weapons,
      suspectsOnScene: assessment.suspectsOnScene,
      peopleAtRisk:    assessment.peopleAtRisk,
      priority:        assessment.suggestedPriority,
    }))
  }, [assessment])

  useEffect(() => {
    if (!created) return
    const id = setTimeout(() => setCreated(null), 6000)
    return () => clearTimeout(id)
  }, [created])

  async function handleAnswer() {
    setAnswering(true)
    setErrorMsg(null)
    try {
      const res = await api<AnswerResponse>('/api/intake/answer', { method: 'POST' })
      setActiveCall(res.call)
      setAssessment(res.assessment)
    } catch (e) {
      setErrorMsg(
        e instanceof ApiError && e.status === 409
          ? 'No calls in queue right now.'
          : 'Failed to connect — please try again.',
      )
    } finally {
      setAnswering(false)
    }
  }

  async function handleCreate() {
    if (!activeCall || !assessment) return
    setCreating(true)
    setErrorMsg(null)
    try {
      const req: CreateIncidentReq = {
        callId:           activeCall.callId,
        callerPhone:      activeCall.phone,
        callerName:       form.callerName,
        address:          form.address,
        postcode:         form.postcode,
        latitude:         activeCall.latitude,
        longitude:        activeCall.longitude,
        crimeType:        assessment.crimeType,
        crimeDescription: assessment.description,
        injuries:         form.injuries,
        weapons:          form.weapons,
        suspectsOnScene:  form.suspectsOnScene,
        peopleAtRisk:     form.peopleAtRisk,
        priority:         form.priority,
      }
      const inc = await api<CreatedIncident>('/api/incidents', { method: 'POST', body: req })
      setCreated(inc)
      setActiveCall(null)
      setAssessment(null)
      setForm(DEFAULT_FORM)
    } catch {
      setErrorMsg('Failed to create incident — please try again.')
    } finally {
      setCreating(false)
    }
  }

  // Map pin data
  const queuePins: QueuePin[] = queue.snapshot.map(c => ({
    callId: c.callId, lat: c.latitude, lng: c.longitude,
    phone: c.phone, postcode: c.postcode,
  }))

  const activePin: ActivePin | null = activeCall ? {
    callId: activeCall.callId,
    lat:    activeCall.latitude,
    lng:    activeCall.longitude,
    phone:  activeCall.phone,
    address: activeCall.address,
  } : null

  const incidentPins: IncidentPin[] = incidents
    .filter(i => i.latitude != null && i.longitude != null)
    .map(i => ({
      id:        i.id,
      lat:       i.latitude!,
      lng:       i.longitude!,
      reference: i.reference,
      priority:  i.priority,
      crimeType: i.crimeType,
      status:    i.status,
    }))

  const queueFill  = Math.min((queue.queued / 60) * 100, 100)
  const queueColor = queue.queued > 40 ? 'var(--p1)' : queue.queued > 20 ? 'var(--p2)' : '#22c55e'
  const prioColor  = assessment
    ? (PRIORITY_COLORS[assessment.suggestedPriority] ?? 'var(--text)')
    : 'var(--text)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar tag="RESPONDER" />

      {/* Auto-system active banner */}
      <div style={{
        background: 'rgba(139,92,246,0.08)', borderBottom: '1px solid rgba(139,92,246,0.2)',
        padding: '5px 16px', display: 'flex', alignItems: 'center', gap: 8,
        fontSize: '0.72rem', color: '#a78bfa',
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#a78bfa',
          boxShadow: '0 0 5px #a78bfa', animation: 'pulse 2s infinite', flexShrink: 0 }} />
        <span>CAD Auto-Confirmer active — processing calls from queue automatically</span>
        <button
          onClick={() => setShowWatch(v => !v)}
          style={{
            marginLeft: 'auto', background: showWatch ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${showWatch ? 'rgba(139,92,246,0.5)' : 'var(--hair)'}`,
            borderRadius: 6, padding: '2px 10px', cursor: 'pointer',
            color: showWatch ? '#a78bfa' : 'var(--text-faint)', fontSize: '0.70rem', fontWeight: 600,
          }}
        >
          {showWatch ? 'Hide' : 'Show'} Incident Watch
        </button>
      </div>

      {created && (
        <div
          className="fade-in"
          style={{
            position: 'fixed', top: 70, right: 24, zIndex: 1000,
            background: 'linear-gradient(135deg,rgba(34,197,94,.18),rgba(34,197,94,.08))',
            border: '1px solid rgba(34,197,94,.45)',
            borderRadius: 12, padding: '14px 20px',
            color: '#bbf7d0', fontWeight: 600, fontSize: '0.9rem',
          }}
        >
          ✓ Incident created —{' '}
          <span className="mono" style={{ color: '#4ade80' }}>{created.reference}</span>
          {' '}
          <span style={{ color: 'var(--text-faint)' }}>P{created.priority}</span>
        </div>
      )}

      <main
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: showWatch
            ? '250px 1fr 360px 280px'
            : '250px 1fr 360px',
          gap: 12,
          padding: 12,
          maxHeight: 'calc(100vh - 87px)',
          overflow: 'hidden',
        }}
      >
        {/* ── LEFT: Queue ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <div className="panel" style={{ padding: 16 }}>
            <div className="panel-title">Intake Queue</div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span className="tnum" style={{ fontSize: '2.2rem', fontWeight: 700, lineHeight: 1 }}>
                  {queue.queued}
                </span>
                <span className="faint" style={{ fontSize: '0.75rem' }}>waiting</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${queueFill}%`, height: '100%',
                    background: queueColor,
                    transition: 'width 0.6s ease, background 0.6s ease',
                  }}
                />
              </div>
            </div>

            <button
              className="btn primary"
              style={{ width: '100%', marginBottom: errorMsg ? 10 : 0 }}
              disabled={answering || activeCall !== null}
              onClick={handleAnswer}
            >
              {answering ? 'Connecting…' : activeCall ? '● On call' : '☎ Answer Next'}
            </button>

            {errorMsg && (
              <div className="error-banner fade-in" style={{ marginTop: 10, fontSize: '0.8rem' }}>
                {errorMsg}
              </div>
            )}

            {queue.snapshot.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="panel-title">Next in queue</div>
                {queue.snapshot.map((c) => (
                  <div
                    key={c.callId}
                    style={{
                      padding: '7px 10px', borderRadius: 8, marginBottom: 4,
                      background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hair)',
                    }}
                  >
                    <div className="mono" style={{ fontSize: '0.8rem' }}>{c.phone.slice(-8)}</div>
                    <div className="faint" style={{ fontSize: '0.74rem' }}>{c.postcode}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Map legend */}
          <div className="panel" style={{ padding: 12 }}>
            <div className="panel-title" style={{ marginBottom: 8 }}>Map legend</div>
            {[
              { color: '#2f6bff', label: 'Active call' },
              { color: '#f97316', label: 'Queued calls' },
              { color: '#ef4444', label: 'P1 incident' },
              { color: '#f59e0b', label: 'P2 incident' },
              { color: '#eab308', label: 'P3 incident' },
              { color: '#3b82f6', label: 'P4 incident' },
              { color: '#6b7280', label: 'P5 incident' },
            ].map(({ color, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, border: '1.5px solid white', flexShrink: 0 }} />
                <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── MIDDLE: Incident Map ── */}
        <div className="panel" style={{ overflow: 'hidden', padding: 0, position: 'relative' }}>
          <IncidentMap queued={queuePins} active={activePin} incidents={incidentPins} />
        </div>

        {/* ── RIGHT: Active Call + Assessment + Create ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>

          {/* Active Call */}
          <div className="panel" style={{ padding: 16 }}>
            <div className="panel-title">Active Call</div>

            {!activeCall ? (
              <p className="faint" style={{ fontSize: '0.84rem', margin: '10px 0 0' }}>
                Press <strong>Answer Next</strong> to take the next call from the queue.
              </p>
            ) : (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    background: 'rgba(47,107,255,0.08)',
                    border: '1px solid rgba(47,107,255,0.3)',
                    borderRadius: 8, padding: '10px 14px',
                  }}
                >
                  <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                    {activeCall.phone}
                  </div>
                  <div className="faint" style={{ fontSize: '0.72rem', marginTop: 3 }}>
                    ±{activeCall.accuracyMeters}m · {activeCall.latitude.toFixed(4)}, {activeCall.longitude.toFixed(4)}
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="callerName">Caller name</label>
                  <input
                    id="callerName"
                    className="input"
                    placeholder="Unknown"
                    autoFocus
                    value={form.callerName}
                    onChange={(e) => setForm(f => ({ ...f, callerName: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="address">Address</label>
                  <input
                    id="address"
                    className="input"
                    value={form.address}
                    onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="postcode">Postcode</label>
                  <input
                    id="postcode"
                    className="input"
                    value={form.postcode}
                    style={{ textTransform: 'uppercase' }}
                    onChange={(e) => setForm(f => ({ ...f, postcode: e.target.value.toUpperCase() }))}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Assessment */}
          <div className="panel" style={{ padding: 16, flex: 1 }}>
            <div className="panel-title">Live Assessment</div>

            {!assessment ? (
              <p className="faint" style={{ fontSize: '0.85rem', marginTop: 10 }}>
                Assessment appears once a call is answered.
              </p>
            ) : (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '0.04em', color: prioColor }}>
                  {formatCrimeType(assessment.crimeType)}
                </div>

                <p className="dim" style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.6 }}>
                  {assessment.description}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {TOGGLE_FIELDS.map(({ key, label }) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>{label}</span>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
                        style={{
                          padding: '3px 14px', borderRadius: 999,
                          border: '1px solid',
                          borderColor: form[key] ? '#ef4444' : 'var(--hair)',
                          cursor: 'pointer', fontWeight: 600, fontSize: '0.72rem',
                          background: form[key] ? 'rgba(239,68,68,0.2)' : 'var(--panel)',
                          color: form[key] ? '#fca5a5' : 'var(--text-faint)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {form[key] ? 'YES' : 'NO'}
                      </button>
                    </div>
                  ))}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>People at risk</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={form.peopleAtRisk}
                      onChange={(e) =>
                        setForm(f => ({ ...f, peopleAtRisk: Math.max(0, parseInt(e.target.value) || 0) }))
                      }
                      style={{
                        width: 64, padding: '4px 8px', borderRadius: 8,
                        border: '1px solid var(--hair)', background: 'var(--panel-2)',
                        color: 'var(--text)', fontFamily: 'var(--mono)', textAlign: 'center',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="panel-title" style={{ marginBottom: 8 }}>Priority</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, priority: p }))}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 8,
                          border: `2px solid ${form.priority === p ? PRIORITY_COLORS[p] : 'var(--hair)'}`,
                          background: form.priority === p ? `${PRIORITY_COLORS[p]}22` : 'transparent',
                          color: form.priority === p ? PRIORITY_COLORS[p] : 'var(--text-faint)',
                          fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        P{p}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            className="btn primary big"
            style={{ width: '100%' }}
            disabled={!activeCall || !assessment || creating}
            onClick={handleCreate}
          >
            {creating ? 'Creating…' : '+ Create Incident'}
          </button>
        </div>

        {/* ── WATCH: Incident Watch Panel ── */}
        {showWatch && (
          <div style={{ overflow: 'hidden' }}>
            <IncidentWatchPanel />
          </div>
        )}
      </main>
    </div>
  )
}
