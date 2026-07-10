import { useState, useEffect, useCallback } from 'react'
import TopBar from '../components/TopBar'
import { DarkSelect, DarkMultiSelect } from '../components/DarkSelect'
import type { SelectOption } from '../components/DarkSelect'
import ShiftSchedulerTab from '../components/ShiftSchedulerTab'
import type { SliderState } from '../components/ShiftSchedulerTab'
import StationMapTab from '../components/StationMapTab'
import LeaveTab from '../components/LeaveTab'
import { api } from '../api/client'

// ── types ─────────────────────────────────────────────────────────────────

interface OfficerSummary {
  id: number; collarNumber: string; forename: string; surname: string
  rank: string; homeStationId: number; defaultMode: string; firearms: boolean; status: string
}
interface OfficerDetail extends OfficerSummary {
  skills: { code: string; name: string; category: string }[]
}
interface PageResult<T> { content: T[]; totalElements: number; totalPages: number; number: number }
interface OfficerCounts { total: number; firearms: number; pc: number; dc: number }
interface Station { id: number; name: string; borough: string }
interface Skill { id: number; code: string; name: string; category: string }

type Tab = 'resources' | 'scheduler' | 'map' | 'leave'

const RANK_OPTS: SelectOption[]   = ['PC','PS','DC','DS','DI','INSP','CI','SUPT','DCI'].map(r => ({ value: r, label: r }))
const STATUS_OPTS: SelectOption[] = ['ON_DUTY','OFF_DUTY','ON_SCENE','AVAILABLE','UNAVAILABLE'].map(s => ({ value: s, label: s.replace(/_/g,' ') }))
const MODE_OPTS: SelectOption[]   = ['FOOT','CAR','VAN','MOTORBIKE','SCOOTER','PUSHBIKE','DOG_CAR'].map(m => ({ value: m, label: m.replace(/_/g,' ') }))
const FA_OPTS: SelectOption[]     = [{ value: 'true', label: 'Firearms only' }, { value: 'false', label: 'Non-firearms' }]

const CATEGORY_COLORS: Record<string, string> = {
  TACTICAL: '#ef4444', DRIVING: '#f97316', INVESTIGATIVE: '#3b82f6', SPECIALIST: '#8b5cf6',
}

// ── default slider state (shared with Scheduler + Map tabs) ───────────────

const DEFAULT_SLIDERS: SliderState = {
  nightPct:      25,
  dayPct:        35,
  latePct:       25,
  weekendUplift: 1.30,
  quietFactor:   0.80,
  targetPeak:    12000,
  totalOfficers: 40000,
}

// ── component ─────────────────────────────────────────────────────────────

export default function PlannerConsolePage() {
  const [activeTab,   setActiveTab]   = useState<Tab>('resources')
  const [sliders,     setSliders]     = useState<SliderState>(DEFAULT_SLIDERS)

  // resources tab state
  const [officerPage, setOfficerPage] = useState<PageResult<OfficerSummary> | null>(null)
  const [selected,    setSelected]    = useState<OfficerDetail | null>(null)
  const [counts,      setCounts]      = useState<OfficerCounts | null>(null)
  const [allSkills,   setAllSkills]   = useState<Skill[]>([])
  const [stations,    setStations]    = useState<Station[]>([])

  const [search,      setSearch]      = useState('')
  const [rankFilters, setRankFilters] = useState<string[]>([])
  const [faFilter,    setFaFilter]    = useState('')
  const [page,        setPage]        = useState(0)

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
    rankFilters.forEach(r => params.append('rank', r))
    if (faFilter) params.set('firearms', faFilter)
    api<PageResult<OfficerSummary>>(`/api/officers?${params}`).then(setOfficerPage).catch(() => {})
  }, [page, rankFilters, faFilter])

  useEffect(() => { loadPage() }, [loadPage])

  useEffect(() => {
    api<OfficerCounts>('/api/officers/count').then(d => {
      setCounts(d)
      setSliders(s => ({ ...s, totalOfficers: d.total || s.totalOfficers }))
    }).catch(() => {})
    api<Skill[]>('/api/skills').then(setAllSkills).catch(() => {})
    api<Station[]>('/api/stations').then(setStations).catch(() => {})
  }, [])

  // ── officer selection ─────────────────────────────────────────────────────

  async function selectOfficer(o: OfficerSummary) {
    const detail = await api<OfficerDetail>(`/api/officers/${o.id}`).catch(() => null)
    if (!detail) return
    setSelected(detail)
    setEditFields({ rank: detail.rank, status: detail.status, defaultMode: detail.defaultMode, firearms: detail.firearms, homeStationId: detail.homeStationId })
    setSkillToAdd(''); setAddingSkill(false)
  }

  function showFlash(msg: string, ok = true) {
    setFlash({ msg, ok })
    setTimeout(() => setFlash(null), 3000)
  }

  async function saveOfficer() {
    if (!selected || !editFields) return
    setSaving(true)
    try {
      const updated = await api<OfficerDetail>(`/api/officers/${selected.id}`, { method: 'PATCH', body: editFields })
      setSelected(updated); loadPage(); showFlash('Officer saved.')
    } catch { showFlash('Save failed.', false) }
    finally { setSaving(false) }
  }

  async function addSkill() {
    if (!selected || !skillToAdd) return
    setSaving(true)
    try {
      const updated = await api<OfficerDetail>(`/api/officers/${selected.id}/skills/${skillToAdd}`, { method: 'POST' })
      setSelected(updated); setEditFields(f => f ? { ...f, firearms: updated.firearms } : f)
      setSkillToAdd(''); setAddingSkill(false); loadPage(); showFlash('Skill added.')
    } catch { showFlash('Add skill failed.', false) }
    finally { setSaving(false) }
  }

  async function removeSkill(code: string) {
    if (!selected) return
    setSaving(true)
    try {
      const updated = await api<OfficerDetail>(`/api/officers/${selected.id}/skills/${code}`, { method: 'DELETE' })
      setSelected(updated); setEditFields(f => f ? { ...f, firearms: updated.firearms } : f)
      loadPage(); showFlash('Skill removed.')
    } catch { showFlash('Remove skill failed.', false) }
    finally { setSaving(false) }
  }

  const officers = officerPage?.content ?? []
  const filtered = search
    ? officers.filter(o => {
        const q = search.toLowerCase()
        return `${o.forename} ${o.surname}`.toLowerCase().includes(q)
            || o.collarNumber.toLowerCase().includes(q)
            || o.rank.toLowerCase().includes(q)
      })
    : officers

  const availableSkillsToAdd = allSkills.filter(s => !selected?.skills.some(sk => sk.code === s.code))
  const skillOpts: SelectOption[] = availableSkillsToAdd.map(s => ({ value: s.code, label: s.name }))
  const stationOpts: SelectOption[] = stations.map(s => ({ value: String(s.id), label: s.name }))
  const stationName = (id: number) => stations.find(s => s.id === id)?.name ?? `Station ${id}`

  // ── render ────────────────────────────────────────────────────────────────

  const TABS: { key: Tab; label: string }[] = [
    { key: 'resources', label: 'Resources' },
    { key: 'scheduler', label: 'Shift Scheduler' },
    { key: 'map',       label: 'Station Map' },
    { key: 'leave',     label: 'Leave' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar tag="PLANNER" />

      {flash && (
        <div style={{
          position: 'fixed', top: 70, right: 24, zIndex: 1000,
          background: flash.ok ? 'linear-gradient(135deg,rgba(34,197,94,.18),rgba(34,197,94,.08))' : 'linear-gradient(135deg,rgba(239,68,68,.18),rgba(239,68,68,.08))',
          border: `1px solid ${flash.ok ? 'rgba(34,197,94,.45)' : 'rgba(239,68,68,.45)'}`,
          borderRadius: 12, padding: '12px 18px',
          color: flash.ok ? '#bbf7d0' : '#fca5a5', fontWeight: 600, fontSize: '0.88rem',
        }}>{flash.msg}</div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 14, gap: 12, overflow: 'hidden', maxHeight: 'calc(100vh - 57px)' }}>

        {/* ── STATS ROW ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, flexShrink: 0 }}>
          {[
            { label: 'Total Officers',     value: counts?.total?.toLocaleString()    ?? '—' },
            { label: 'Firearms Qualified', value: counts?.firearms?.toLocaleString() ?? '—', accent: '#ef4444' },
            { label: 'Constables (PC)',    value: counts?.pc?.toLocaleString()        ?? '—' },
            { label: 'Detectives (DC)',    value: counts?.dc?.toLocaleString()        ?? '—', accent: '#3b82f6' },
          ].map(({ label, value, accent }) => (
            <div key={label} className="panel" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: accent ?? 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── TAB BAR ── */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: 600,
                background: activeTab === t.key ? '#2f6bff' : 'rgba(255,255,255,0.06)',
                color: activeTab === t.key ? '#fff' : 'var(--text-dim)',
                transition: 'all 0.15s',
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* ── TAB CONTENT ── */}
        {activeTab === 'scheduler' && (
          <ShiftSchedulerTab sliders={sliders} onSliders={setSliders} />
        )}

        {activeTab === 'map' && (
          <StationMapTab sliders={sliders} />
        )}

        {activeTab === 'leave' && (
          <LeaveTab />
        )}

        {activeTab === 'resources' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr', gap: 14, overflow: 'hidden' }}>

            {/* ── LEFT: officer list ── */}
            <div className="panel" style={{ display: 'flex', flexDirection: 'column', padding: 14, overflow: 'hidden' }}>
              <div className="panel-title" style={{ marginBottom: 10 }}>
                Resources
                <span className="faint" style={{ float: 'right', fontWeight: 400 }}>
                  {officerPage?.totalElements?.toLocaleString() ?? '—'} officers
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                <input
                  type="search"
                  placeholder="Search name, collar, rank…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    padding: '7px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#e2e8f0', fontSize: '0.82rem', outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <div style={{ flex: 1 }}>
                    <DarkMultiSelect value={rankFilters} onChange={v => { setRankFilters(v); setPage(0) }} options={RANK_OPTS} placeholder="All ranks" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <DarkSelect value={faFilter} onChange={v => { setFaFilter(v); setPage(0) }} options={FA_OPTS} placeholder="All" nullable nullLabel="All officers" />
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto' }}>
                {filtered.length === 0 && <p className="faint" style={{ fontSize: '0.82rem' }}>No officers found.</p>}
                {filtered.map(o => (
                  <div key={o.id} onClick={() => selectOfficer(o)} style={{
                    padding: '9px 11px', borderRadius: 9, marginBottom: 4, cursor: 'pointer',
                    background: selected?.id === o.id ? 'rgba(47,107,255,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selected?.id === o.id ? 'rgba(47,107,255,0.5)' : 'var(--hair)'}`,
                    transition: 'all 0.12s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ fontSize: '0.67rem', fontWeight: 700, padding: '1px 6px', borderRadius: 5, background: 'rgba(255,255,255,0.08)', color: 'var(--text-dim)', fontFamily: 'var(--mono)' }}>{o.rank}</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{o.forename} {o.surname}</span>
                      {o.firearms && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#ef4444', fontWeight: 700 }}>ARV</span>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                      <span className="mono faint" style={{ fontSize: '0.68rem' }}>{o.collarNumber}</span>
                      <span style={{ fontSize: '0.66rem', fontWeight: 600, color: o.status === 'ON_DUTY' || o.status === 'AVAILABLE' ? '#22c55e' : o.status === 'ON_SCENE' ? '#06b6d4' : 'var(--text-faint)' }}>
                        {o.status.replace(/_/g,' ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {officerPage && officerPage.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexShrink: 0 }}>
                  <button className="btn" disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ fontSize: '0.76rem', padding: '5px 12px' }}>← Prev</button>
                  <span className="faint" style={{ fontSize: '0.74rem' }}>{page + 1} / {officerPage.totalPages}</span>
                  <button className="btn" disabled={page >= officerPage.totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ fontSize: '0.76rem', padding: '5px 12px' }}>Next →</button>
                </div>
              )}
            </div>

            {/* ── RIGHT: officer detail ── */}
            <div className="panel" style={{ padding: 20, overflowY: 'auto' }}>
              {!selected ? (
                <div style={{ textAlign: 'center', paddingTop: 60, color: 'var(--text-faint)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 12 }}>🗓️</div>
                  <div style={{ fontSize: '0.9rem' }}>Select an officer to view and edit their profile.</div>
                </div>
              ) : editFields && (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div>
                      <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{selected.forename} {selected.surname}</h2>
                      <div className="mono faint" style={{ fontSize: '0.78rem', marginTop: 3 }}>{selected.collarNumber} · {selected.rank}</div>
                      {selected.homeStationId > 0 && <div className="faint" style={{ fontSize: '0.74rem', marginTop: 2 }}>{stationName(selected.homeStationId)}</div>}
                    </div>
                    <button className="btn" onClick={() => { setSelected(null); setEditFields(null) }} style={{ fontSize: '0.78rem', padding: '5px 12px' }}>✕ Close</button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                    <div>
                      <label style={lbl}>Rank</label>
                      <DarkSelect value={editFields.rank} onChange={v => setEditFields(f => f ? { ...f, rank: v } : f)} options={RANK_OPTS} />
                    </div>
                    <div>
                      <label style={lbl}>Status</label>
                      <DarkSelect value={editFields.status} onChange={v => setEditFields(f => f ? { ...f, status: v } : f)} options={STATUS_OPTS} />
                    </div>
                    <div>
                      <label style={lbl}>Default Mode</label>
                      <DarkSelect value={editFields.defaultMode} onChange={v => setEditFields(f => f ? { ...f, defaultMode: v } : f)} options={MODE_OPTS} />
                    </div>
                    <div style={{ gridColumn: '1 / 3' }}>
                      <label style={lbl}>Home Station</label>
                      <DarkSelect value={editFields.homeStationId > 0 ? String(editFields.homeStationId) : ''} onChange={v => setEditFields(f => f ? { ...f, homeStationId: v ? Number(v) : 0 } : f)} options={stationOpts} searchable nullable nullLabel="— None —" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
                      <input type="checkbox" id="fc" checked={editFields.firearms} onChange={e => setEditFields(f => f ? { ...f, firearms: e.target.checked } : f)} style={{ width: 16, height: 16, accentColor: '#ef4444', cursor: 'pointer' }} />
                      <label htmlFor="fc" style={{ fontSize: '0.82rem', cursor: 'pointer' }}>Firearms Authorised (ARV)</label>
                    </div>
                  </div>

                  <button className="btn primary" disabled={saving} onClick={saveOfficer} style={{ marginBottom: 24 }}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>

                  <hr style={{ border: 'none', borderTop: '1px solid var(--hair)', marginBottom: 20 }} />

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div className="panel-title" style={{ margin: 0 }}>Skills &amp; Qualifications</div>
                    {!addingSkill && skillOpts.length > 0 && (
                      <button className="btn" onClick={() => setAddingSkill(true)} style={{ fontSize: '0.76rem', padding: '5px 12px' }}>+ Add skill</button>
                    )}
                  </div>

                  {addingSkill && (
                    <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <DarkSelect value={skillToAdd} onChange={setSkillToAdd} options={skillOpts} placeholder="— Select skill —" searchable nullable nullLabel="— Select skill —" />
                      </div>
                      <button className="btn primary" disabled={!skillToAdd || saving} onClick={addSkill} style={{ fontSize: '0.78rem', padding: '7px 14px', whiteSpace: 'nowrap' }}>Add</button>
                      <button className="btn" onClick={() => { setAddingSkill(false); setSkillToAdd('') }} style={{ fontSize: '0.78rem', padding: '7px 10px' }}>Cancel</button>
                    </div>
                  )}

                  {selected.skills.length === 0 ? (
                    <p className="faint" style={{ fontSize: '0.82rem' }}>No skills recorded.</p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {selected.skills.map(sk => {
                        const col = CATEGORY_COLORS[sk.category] ?? '#6b7280'
                        return (
                          <div key={sk.code} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 6px 12px', borderRadius: 20, background: col + '18', border: `1px solid ${col}55` }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: col }}>{sk.name}</span>
                            <span className="mono faint" style={{ fontSize: '0.62rem' }}>{sk.category}</span>
                            <button onClick={() => removeSkill(sk.code)} disabled={saving} title={`Remove ${sk.name}`}
                              style={{ marginLeft: 2, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '0.9rem', lineHeight: 1, padding: '0 2px', display: 'flex', alignItems: 'center' }}>✕</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

const lbl: React.CSSProperties = { fontSize: '0.72rem', color: 'var(--text-dim)', display: 'block', marginBottom: 4 }
