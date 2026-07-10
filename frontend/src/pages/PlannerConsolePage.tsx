import { useState, useEffect, useCallback } from 'react'
import TopBar from '../components/TopBar'
import { api } from '../api/client'

// ── types ─────────────────────────────────────────────────────────────────

interface OfficerSummary {
  id: number
  collarNumber: string
  forename: string
  surname: string
  rank: string
  homeStationId: number
  defaultMode: string
  firearms: boolean
  status: string
}

interface OfficerDetail extends OfficerSummary {
  skills: { code: string; name: string; category: string }[]
}

interface PageResult<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
}

interface OfficerCounts {
  total: number
  firearms: number
  pc: number
  dc: number
}

interface Station {
  id: number
  name: string
  borough: string
}

interface Skill {
  id: number
  code: string
  name: string
  category: string
}

// ── constants ──────────────────────────────────────────────────────────────

const RANKS = ['PC', 'PS', 'DC', 'DS', 'DI', 'INSP', 'CI', 'SUPT', 'DCI']
const STATUSES = ['ON_DUTY', 'OFF_DUTY', 'ON_SCENE', 'AVAILABLE', 'UNAVAILABLE']
const MODES = ['FOOT', 'CAR', 'VAN', 'MOTORBIKE', 'SCOOTER', 'PUSHBIKE', 'DOG_CAR']

const CATEGORY_COLORS: Record<string, string> = {
  TACTICAL:      '#ef4444',
  DRIVING:       '#f97316',
  INVESTIGATIVE: '#3b82f6',
  SPECIALIST:    '#8b5cf6',
}

function fmt(s: string) { return s?.replace(/_/g, ' ') ?? '' }

// ── component ─────────────────────────────────────────────────────────────

export default function PlannerConsolePage() {
  const [officerPage,  setOfficerPage]  = useState<PageResult<OfficerSummary> | null>(null)
  const [selected,     setSelected]     = useState<OfficerDetail | null>(null)
  const [counts,       setCounts]       = useState<OfficerCounts | null>(null)
  const [allSkills,    setAllSkills]    = useState<Skill[]>([])
  const [stations,     setStations]     = useState<Station[]>([])

  // filter state
  const [search,     setSearch]     = useState('')
  const [rankFilter, setRankFilter] = useState('')
  const [firearms,   setFirearms]   = useState<'' | 'true' | 'false'>('')
  const [page,       setPage]       = useState(0)

  // edit state
  const [saving,      setSaving]      = useState(false)
  const [addingSkill, setAddingSkill] = useState(false)
  const [skillToAdd,  setSkillToAdd]  = useState('')
  const [flash,       setFlash]       = useState<{ msg: string; ok: boolean } | null>(null)
  const [editFields,  setEditFields]  = useState<{
    rank: string; status: string; defaultMode: string; firearms: boolean; homeStationId: number
  } | null>(null)

  // ── data loading ──────────────────────────────────────────────────────────

  const loadPage = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), size: '25' })
    if (rankFilter) params.set('rank', rankFilter)
    if (firearms)   params.set('firearms', firearms)
    api<PageResult<OfficerSummary>>(`/api/officers?${params}`)
      .then(setOfficerPage)
      .catch(() => {})
  }, [page, rankFilter, firearms])

  useEffect(() => { loadPage() }, [loadPage])

  useEffect(() => {
    api<OfficerCounts>('/api/officers/count').then(setCounts).catch(() => {})
    api<Skill[]>('/api/skills').then(setAllSkills).catch(() => {})
    api<Station[]>('/api/stations').then(setStations).catch(() => {})
  }, [])

  // ── officer selection ─────────────────────────────────────────────────────

  async function selectOfficer(o: OfficerSummary) {
    const detail = await api<OfficerDetail>(`/api/officers/${o.id}`).catch(() => null)
    if (!detail) return
    setSelected(detail)
    setEditFields({
      rank:          detail.rank,
      status:        detail.status,
      defaultMode:   detail.defaultMode,
      firearms:      detail.firearms,
      homeStationId: detail.homeStationId,
    })
    setSkillToAdd('')
    setAddingSkill(false)
  }

  // ── mutations ─────────────────────────────────────────────────────────────

  function showFlash(msg: string, ok = true) {
    setFlash({ msg, ok })
    setTimeout(() => setFlash(null), 3000)
  }

  async function saveOfficer() {
    if (!selected || !editFields) return
    setSaving(true)
    try {
      const updated = await api<OfficerDetail>(`/api/officers/${selected.id}`, {
        method: 'PATCH',
        body: editFields,
      })
      setSelected(updated)
      loadPage()
      showFlash('Officer saved.')
    } catch { showFlash('Save failed.', false) }
    finally { setSaving(false) }
  }

  async function addSkill() {
    if (!selected || !skillToAdd) return
    setSaving(true)
    try {
      const updated = await api<OfficerDetail>(
        `/api/officers/${selected.id}/skills/${skillToAdd}`, { method: 'POST' }
      )
      setSelected(updated)
      setEditFields(f => f ? { ...f, firearms: updated.firearms } : f)
      setSkillToAdd('')
      setAddingSkill(false)
      loadPage()
      showFlash('Skill added.')
    } catch { showFlash('Add skill failed.', false) }
    finally { setSaving(false) }
  }

  async function removeSkill(code: string) {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await api<OfficerDetail>(
        `/api/officers/${selected.id}/skills/${code}`, { method: 'DELETE' }
      )
      setSelected(updated)
      setEditFields(f => f ? { ...f, firearms: updated.firearms } : f)
      loadPage()
      showFlash('Skill removed.')
    } catch { showFlash('Remove skill failed.', false) }
    finally { setSaving(false) }
  }

  // ── filtered list ──────────────────────────────────────────────────────────

  const officers = officerPage?.content ?? []
  const filtered = search
    ? officers.filter(o => {
        const q = search.toLowerCase()
        return `${o.forename} ${o.surname}`.toLowerCase().includes(q)
            || o.collarNumber.toLowerCase().includes(q)
            || o.rank.toLowerCase().includes(q)
      })
    : officers

  const availableSkillsToAdd = allSkills.filter(
    s => !selected?.skills.some(sk => sk.code === s.code)
  )

  const stationName = (id: number) =>
    stations.find(s => s.id === id)?.name ?? `Station ${id}`

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar tag="PLANNER" />

      {flash && (
        <div style={{
          position: 'fixed', top: 70, right: 24, zIndex: 1000,
          background: flash.ok
            ? 'linear-gradient(135deg,rgba(34,197,94,.18),rgba(34,197,94,.08))'
            : 'linear-gradient(135deg,rgba(239,68,68,.18),rgba(239,68,68,.08))',
          border: `1px solid ${flash.ok ? 'rgba(34,197,94,.45)' : 'rgba(239,68,68,.45)'}`,
          borderRadius: 12, padding: '12px 18px',
          color: flash.ok ? '#bbf7d0' : '#fca5a5',
          fontWeight: 600, fontSize: '0.88rem',
        }}>{flash.msg}</div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 14, gap: 14, overflow: 'hidden', maxHeight: 'calc(100vh - 57px)' }}>

        {/* ── STATS ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, flexShrink: 0 }}>
          {[
            { label: 'Total Officers',     value: counts?.total?.toLocaleString()    ?? '—' },
            { label: 'Firearms Qualified', value: counts?.firearms?.toLocaleString() ?? '—', accent: '#ef4444' },
            { label: 'Constables (PC)',    value: counts?.pc?.toLocaleString()        ?? '—' },
            { label: 'Detectives (DC)',    value: counts?.dc?.toLocaleString()        ?? '—', accent: '#3b82f6' },
          ].map(({ label, value, accent }) => (
            <div key={label} className="panel" style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: '1.7rem', fontWeight: 700, color: accent ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── MAIN AREA ── */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr', gap: 14, overflow: 'hidden' }}>

          {/* ── LEFT: officer list ── */}
          <div className="panel" style={{ display: 'flex', flexDirection: 'column', padding: 14, overflow: 'hidden' }}>
            <div className="panel-title" style={{ marginBottom: 10 }}>
              Resources
              <span className="faint" style={{ float: 'right', fontWeight: 400 }}>
                {officerPage?.totalElements?.toLocaleString() ?? '—'} officers
              </span>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              <input
                type="search"
                placeholder="Search name, collar, rank…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '7px 10px', borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
                  color: 'inherit', fontSize: '0.82rem', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={rankFilter}
                  onChange={e => { setRankFilter(e.target.value); setPage(0) }}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
                    color: 'inherit', fontSize: '0.78rem', outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">All ranks</option>
                  {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                  value={firearms}
                  onChange={e => { setFirearms(e.target.value as '' | 'true' | 'false'); setPage(0) }}
                  style={{
                    flex: 1, padding: '6px 8px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
                    color: 'inherit', fontSize: '0.78rem', outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">All</option>
                  <option value="true">Firearms</option>
                  <option value="false">Non-firearms</option>
                </select>
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filtered.length === 0 && (
                <p className="faint" style={{ fontSize: '0.82rem' }}>No officers found.</p>
              )}
              {filtered.map(o => (
                <div
                  key={o.id}
                  onClick={() => selectOfficer(o)}
                  style={{
                    padding: '9px 11px', borderRadius: 9, marginBottom: 4, cursor: 'pointer',
                    background: selected?.id === o.id
                      ? 'rgba(47,107,255,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected?.id === o.id ? 'rgba(47,107,255,0.5)' : 'var(--hair)'}`,
                    transition: 'all 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{
                      fontSize: '0.67rem', fontWeight: 700, padding: '1px 6px', borderRadius: 5,
                      background: 'rgba(255,255,255,0.08)', color: 'var(--text-dim)',
                      fontFamily: 'var(--mono)',
                    }}>{o.rank}</span>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      {o.forename} {o.surname}
                    </span>
                    {o.firearms && (
                      <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#ef4444', fontWeight: 700 }}>ARV</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    <span className="mono faint" style={{ fontSize: '0.68rem' }}>{o.collarNumber}</span>
                    <span style={{
                      fontSize: '0.66rem', fontWeight: 600,
                      color: o.status === 'ON_DUTY' || o.status === 'AVAILABLE' ? '#22c55e'
                           : o.status === 'ON_SCENE' ? '#06b6d4'
                           : 'var(--text-faint)',
                    }}>{fmt(o.status)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {officerPage && officerPage.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexShrink: 0 }}>
                <button
                  className="btn"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  style={{ fontSize: '0.76rem', padding: '5px 12px' }}
                >← Prev</button>
                <span className="faint" style={{ fontSize: '0.74rem' }}>
                  {page + 1} / {officerPage.totalPages}
                </span>
                <button
                  className="btn"
                  disabled={page >= officerPage.totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  style={{ fontSize: '0.76rem', padding: '5px 12px' }}
                >Next →</button>
              </div>
            )}
          </div>

          {/* ── RIGHT: officer detail + skill editor ── */}
          <div className="panel" style={{ padding: 20, overflowY: 'auto' }}>
            {!selected ? (
              <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-faint)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗓️</div>
                <div style={{ fontSize: '0.9rem' }}>Select an officer to view and edit their profile.</div>
              </div>
            ) : editFields && (
              <>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                      {selected.forename} {selected.surname}
                    </h2>
                    <div className="mono faint" style={{ fontSize: '0.78rem', marginTop: 3 }}>
                      {selected.collarNumber} · {selected.rank}
                    </div>
                    {selected.homeStationId > 0 && (
                      <div className="faint" style={{ fontSize: '0.74rem', marginTop: 2 }}>
                        {stationName(selected.homeStationId)}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn"
                    onClick={() => { setSelected(null); setEditFields(null) }}
                    style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                  >✕ Close</button>
                </div>

                {/* Edit fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Rank</label>
                    <select
                      value={editFields.rank}
                      onChange={e => setEditFields(f => f ? { ...f, rank: e.target.value } : f)}
                      style={selectStyle}
                    >
                      {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Status</label>
                    <select
                      value={editFields.status}
                      onChange={e => setEditFields(f => f ? { ...f, status: e.target.value } : f)}
                      style={selectStyle}
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{fmt(s)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Default Mode</label>
                    <select
                      value={editFields.defaultMode}
                      onChange={e => setEditFields(f => f ? { ...f, defaultMode: e.target.value } : f)}
                      style={selectStyle}
                    >
                      {MODES.map(m => <option key={m} value={m}>{fmt(m)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>Home Station</label>
                    <select
                      value={editFields.homeStationId}
                      onChange={e => setEditFields(f => f ? { ...f, homeStationId: Number(e.target.value) } : f)}
                      style={selectStyle}
                    >
                      <option value={0}>— None —</option>
                      {stations.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
                    <input
                      type="checkbox"
                      id="firearms-check"
                      checked={editFields.firearms}
                      onChange={e => setEditFields(f => f ? { ...f, firearms: e.target.checked } : f)}
                      style={{ width: 16, height: 16, accentColor: '#ef4444', cursor: 'pointer' }}
                    />
                    <label htmlFor="firearms-check" style={{ fontSize: '0.82rem', cursor: 'pointer' }}>
                      Firearms Authorised (ARV)
                    </label>
                  </div>
                </div>

                <button
                  className="btn primary"
                  disabled={saving}
                  onClick={saveOfficer}
                  style={{ marginBottom: 24 }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>

                <hr style={{ border: 'none', borderTop: '1px solid var(--hair)', marginBottom: 20 }} />

                {/* Skills */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div className="panel-title" style={{ margin: 0 }}>Skills & Qualifications</div>
                  {!addingSkill && availableSkillsToAdd.length > 0 && (
                    <button
                      className="btn"
                      onClick={() => setAddingSkill(true)}
                      style={{ fontSize: '0.76rem', padding: '5px 12px' }}
                    >+ Add skill</button>
                  )}
                </div>

                {/* Add skill row */}
                {addingSkill && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                    <select
                      value={skillToAdd}
                      onChange={e => setSkillToAdd(e.target.value)}
                      style={{ ...selectStyle, flex: 1 }}
                    >
                      <option value="">— Select skill —</option>
                      {availableSkillsToAdd.map(s => (
                        <option key={s.code} value={s.code}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      className="btn primary"
                      disabled={!skillToAdd || saving}
                      onClick={addSkill}
                      style={{ fontSize: '0.78rem', padding: '6px 14px', whiteSpace: 'nowrap' }}
                    >Add</button>
                    <button
                      className="btn"
                      onClick={() => { setAddingSkill(false); setSkillToAdd('') }}
                      style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                    >Cancel</button>
                  </div>
                )}

                {/* Current skills */}
                {selected.skills.length === 0 ? (
                  <p className="faint" style={{ fontSize: '0.82rem' }}>No skills recorded.</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {selected.skills.map(sk => (
                      <div key={sk.code} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px 6px 12px', borderRadius: 20,
                        background: (CATEGORY_COLORS[sk.category] ?? '#6b7280') + '18',
                        border: `1px solid ${(CATEGORY_COLORS[sk.category] ?? '#6b7280')}55`,
                      }}>
                        <span style={{
                          fontSize: '0.78rem', fontWeight: 600,
                          color: CATEGORY_COLORS[sk.category] ?? '#6b7280',
                        }}>{sk.name}</span>
                        <span style={{
                          fontSize: '0.62rem', color: 'var(--text-faint)',
                          fontFamily: 'var(--mono)',
                        }}>{sk.category}</span>
                        <button
                          onClick={() => removeSkill(sk.code)}
                          disabled={saving}
                          title={`Remove ${sk.name}`}
                          style={{
                            marginLeft: 2, background: 'none', border: 'none',
                            cursor: 'pointer', color: 'var(--text-faint)',
                            fontSize: '0.9rem', lineHeight: 1, padding: '0 2px',
                            display: 'flex', alignItems: 'center',
                          }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
  color: 'inherit', fontSize: '0.82rem', outline: 'none', cursor: 'pointer',
}
