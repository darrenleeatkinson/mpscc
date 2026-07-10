import { useState, useMemo, useEffect, useCallback } from 'react'
import { api } from '../api/client'

// ── types ─────────────────────────────────────────────────────────────────

export interface SliderState {
  nightPct:       number   // 0-50
  dayPct:         number   // 0-50
  latePct:        number   // 0-50
  // earlyPct = max(0, 100 - night - day - late)
  weekendUplift:  number   // 1.0-2.0
  quietFactor:    number   // 0.6-1.0 Mon/Tue
  targetPeak:     number   // officers on-shift at peak
  totalOfficers:  number   // eligible pool
}

interface StationRow {
  id: number; name: string; borough: string
  capacity: number; sizeBand: string
  officerCount: number
}

interface SavedSchedule { id: number; name: string; updated_at: string }

interface Props {
  sliders: SliderState
  onSliders: (s: SliderState) => void
}

// ── constants ─────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

// Which integer hours does each shift cover?
const SHIFT_HRS: Record<string, number[]> = {
  NS: [22, 23, 0, 1, 2, 3, 4, 5, 6, 7],          // 22:00–08:00
  DS: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],   // 10:00–20:00
  LS: [14, 15, 16, 17, 18, 19, 20, 21, 22, 23],   // 14:00–00:00
  ES: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],       // 06:00–16:00
}

// Mon=0 … Sun=6
const DAY_BASE_FACTOR = [0.80, 0.82, 0.92, 1.00, 1.25, 1.30, 1.05]

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ── density model ─────────────────────────────────────────────────────────

function computeGrid(s: SliderState): number[][] {
  const earlyPct = Math.max(0, 100 - s.nightPct - s.dayPct - s.latePct)
  const pcts = { NS: s.nightPct / 100, DS: s.dayPct / 100, LS: s.latePct / 100, ES: earlyPct / 100 }

  // For each day, compute officers per shift type
  return DAYS.map((_, di) => {
    const isWeekend = di >= 4            // Fri/Sat/Sun
    const isQuiet   = di < 2            // Mon/Tue
    const dayFactor = isWeekend ? s.weekendUplift
                    : isQuiet   ? s.quietFactor
                    : DAY_BASE_FACTOR[di]

    const byShift: Record<string, number> = {
      NS: s.totalOfficers * pcts.NS * dayFactor,
      DS: s.totalOfficers * pcts.DS * dayFactor,
      LS: s.totalOfficers * pcts.LS * dayFactor,
      ES: s.totalOfficers * pcts.ES * dayFactor,
    }

    // For each hour: sum contributions
    return HOURS.map(h => {
      let count = 0
      for (const [type, hrs] of Object.entries(SHIFT_HRS)) {
        if (hrs.includes(h)) count += byShift[type]
      }
      return Math.round(count)
    })
  })
}

// ── heatmap cell colour ───────────────────────────────────────────────────

function cellColor(officers: number, target: number): string {
  const ratio = officers / target
  if (ratio >= 1.05) return '#16a34a'
  if (ratio >= 0.90) return '#22c55e'
  if (ratio >= 0.75) return '#eab308'
  if (ratio >= 0.60) return '#f59e0b'
  return '#ef4444'
}

// ── SVG line chart ────────────────────────────────────────────────────────

function LineChart({ grid, target }: { grid: number[][]; target: number }) {
  const W = 560; const H = 160; const padL = 44; const padB = 24; const padT = 12; const padR = 8
  const maxV = Math.max(target * 1.4, ...grid.flat())
  const gx = (h: number) => padL + (h / 23) * (W - padL - padR)
  const gy = (v: number) => H - padB - (v / maxV) * (H - padB - padT)

  // Average across days
  const avg = HOURS.map(h => Math.round(grid.reduce((s, row) => s + row[h], 0) / 7))

  let line = ''; let area = ''
  avg.forEach((v, i) => { line += (i ? 'L' : 'M') + gx(i).toFixed(1) + ',' + gy(v).toFixed(1) + ' ' })
  area = line + 'L' + gx(23) + ',' + (H - padB) + ' L' + padL + ',' + (H - padB) + ' Z'

  const gridLines = [0, 0.25, 0.5, 0.75, 1.0].map(f => {
    const v = Math.round(maxV * f); const y = gy(v)
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(255,255,255,.05)"/>
            <text class="axl" x="${padL - 5}" y="${y + 3}" text-anchor="end">${(v / 1000).toFixed(0)}k</text>`
  }).join('')

  const xLabels = [0, 4, 8, 12, 16, 20, 23].map(h =>
    `<text class="axl" x="${gx(h).toFixed(1)}" y="${H - 6}" text-anchor="middle">${String(h).padStart(2, '0')}</text>`
  ).join('')

  const targetY = gy(target)
  const dots = avg.map((v, i) =>
    `<circle cx="${gx(i).toFixed(1)}" cy="${gy(v).toFixed(1)}" r="2" fill="var(--accent-2)"/>`
  ).join('')

  const svgStr = `
    <defs>
      <linearGradient id="lgrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgba(34,211,238,.3)"/>
        <stop offset="100%" stop-color="rgba(34,211,238,0)"/>
      </linearGradient>
    </defs>
    ${gridLines}${xLabels}
    <path d="${area}" fill="url(#lgrad)"/>
    <path d="${line}" fill="none" stroke="var(--accent-2)" stroke-width="2"/>
    ${dots}
    <line x1="${padL}" y1="${targetY}" x2="${W - padR}" y2="${targetY}" stroke="var(--p1)" stroke-width="1.5" stroke-dasharray="5 4"/>
    <text class="axl" x="${W - padR - 2}" y="${targetY - 4}" text-anchor="end" fill="var(--p1)">target ${(target / 1000).toFixed(0)}k</text>
  `

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160, display: 'block' }}
      dangerouslySetInnerHTML={{ __html: svgStr }} />
  )
}

// ── slider row ────────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, step, format, onChange, color,
}: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; onChange: (v: number) => void; color?: string
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>{label}</span>
        <span style={{ fontSize: '0.76rem', fontFamily: 'var(--mono)', color: color ?? 'var(--accent-2)', fontWeight: 600 }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: color ?? '#22d3ee', cursor: 'pointer' }}
      />
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────

export default function ShiftSchedulerTab({ sliders, onSliders }: Props) {
  const [stations,   setStations]   = useState<StationRow[]>([])
  const [schedules,  setSchedules]  = useState<SavedSchedule[]>([])
  const [schName,    setSchName]    = useState('')
  const [saving,     setSaving]     = useState(false)
  const [flash,      setFlash]      = useState<string | null>(null)

  function set<K extends keyof SliderState>(key: K, val: SliderState[K]) {
    onSliders({ ...sliders, [key]: val })
  }

  const earlyPct = Math.max(0, 100 - sliders.nightPct - sliders.dayPct - sliders.latePct)

  useEffect(() => {
    api<StationRow[]>('/api/schedules/station-summary').then(setStations).catch(() => {})
    api<SavedSchedule[]>('/api/schedules').then(setSchedules).catch(() => {})
  }, [])

  const grid = useMemo(() => computeGrid(sliders), [sliders])

  // target per-hour-cell varies by hour (peak ≈ 19:00)
  function hourTarget(h: number) {
    const peakH = 19
    const dist = Math.abs(h - peakH)
    const curve = Math.max(0.45, 1 - dist * 0.05)
    return Math.round(sliders.targetPeak * curve)
  }

  // Station allocation: proportional to capacity
  const totalCap = stations.reduce((s, st) => s + st.capacity, 0)
  function stationAlloc(st: StationRow): number {
    if (totalCap === 0) return 0
    const peakOnShift = sliders.targetPeak * 0.65 // weekday average ≈ 65 % of peak
    return Math.round((st.capacity / totalCap) * peakOnShift)
  }

  function showFlash(msg: string) { setFlash(msg); setTimeout(() => setFlash(null), 2500) }

  async function saveSchedule() {
    if (!schName.trim()) return
    setSaving(true)
    try {
      await api('/api/schedules', { method: 'POST', body: { name: schName.trim(), data: sliders } })
      const list = await api<SavedSchedule[]>('/api/schedules')
      setSchedules(list)
      showFlash(`"${schName.trim()}" saved`)
    } catch { showFlash('Save failed') }
    finally { setSaving(false) }
  }

  function loadSchedule(sch: SavedSchedule & { data?: Partial<SliderState> }) {
    if (sch.data) onSliders({ ...sliders, ...sch.data })
    setSchName(sch.name)
    showFlash(`Loaded "${sch.name}"`)
  }

  async function deleteSchedule(id: number) {
    await api(`/api/schedules/${id}`, { method: 'DELETE' }).catch(() => {})
    setSchedules(s => s.filter(x => x.id !== id))
  }

  // Shift code table summary
  const shiftSummary = useMemo(() => {
    const epct = Math.max(0, 100 - sliders.nightPct - sliders.dayPct - sliders.latePct)
    return [
      { code: 'NS', label: 'Night Shift',  hours: '22:00–08:00', pct: sliders.nightPct, col: '#6366f1' },
      { code: 'DS', label: 'Day Shift',    hours: '10:00–20:00', pct: sliders.dayPct,   col: '#eab308' },
      { code: 'LS', label: 'Late Shift',   hours: '14:00–00:00', pct: sliders.latePct,  col: '#f59e0b' },
      { code: 'ES', label: 'Early Shift',  hours: '06:00–16:00', pct: epct,             col: '#22c55e' },
    ]
  }, [sliders.nightPct, sliders.dayPct, sliders.latePct])

  const topStations = [...stations].sort((a, b) => b.capacity - a.capacity).slice(0, 10)

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '260px 1fr 260px', gap: 14, overflow: 'hidden' }}>

      {/* ── LEFT: controls ── */}
      <div className="panel" style={{ padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* Shift allocation */}
        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-faint)', marginBottom: 10 }}>SHIFT ALLOCATION</div>

        <SliderRow label="Night Shift (NS)" value={sliders.nightPct} min={0} max={50} step={1}
          format={v => `${v} %`} onChange={v => set('nightPct', v)} color="#6366f1" />
        <SliderRow label="Day Shift (DS)" value={sliders.dayPct} min={0} max={50} step={1}
          format={v => `${v} %`} onChange={v => set('dayPct', v)} color="#eab308" />
        <SliderRow label="Late Shift (LS)" value={sliders.latePct} min={0} max={50} step={1}
          format={v => `${v} %`} onChange={v => set('latePct', v)} color="#f59e0b" />

        <div style={{ marginBottom: 14, padding: '7px 10px', borderRadius: 7, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.76rem', color: 'var(--text-dim)' }}>Early Shift (ES) — derived</span>
            <span style={{ fontSize: '0.76rem', fontFamily: 'var(--mono)', color: '#22c55e', fontWeight: 600 }}>{earlyPct} %</span>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginTop: 2 }}>06:00–16:00 · 100 − NS − DS − LS</div>
        </div>

        {/* Shift codes summary */}
        <div style={{ marginBottom: 16 }}>
          {shiftSummary.map(s => (
            <div key={s.code} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <div style={{ width: 3, height: 28, borderRadius: 2, background: s.col, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, fontFamily: 'var(--mono)', color: s.col }}>{s.code}</div>
                <div style={{ fontSize: '0.64rem', color: 'var(--text-faint)' }}>{s.hours}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: s.col }}>{s.pct} %</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)' }}>{Math.round(sliders.totalOfficers * s.pct / 100).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--hair)', margin: '4px 0 14px' }} />

        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-faint)', marginBottom: 10 }}>DEMAND FACTORS</div>

        <SliderRow label="Weekend uplift (Fri–Sun)" value={sliders.weekendUplift} min={1.0} max={2.0} step={0.05}
          format={v => `×${v.toFixed(2)}`} onChange={v => set('weekendUplift', v)} color="#f97316" />
        <SliderRow label="Mon/Tue quiet factor" value={sliders.quietFactor} min={0.60} max={1.00} step={0.05}
          format={v => `×${v.toFixed(2)}`} onChange={v => set('quietFactor', v)} color="#3b82f6" />
        <SliderRow label="Target on-shift (peak)" value={sliders.targetPeak} min={2000} max={20000} step={500}
          format={v => v.toLocaleString()} onChange={v => set('targetPeak', v)} color="#22d3ee" />
        <SliderRow label="Eligible officer pool" value={sliders.totalOfficers} min={5000} max={45000} step={500}
          format={v => v.toLocaleString()} onChange={v => set('totalOfficers', v)} color="#a855f7" />

        <hr style={{ border: 'none', borderTop: '1px solid var(--hair)', margin: '4px 0 14px' }} />

        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '.08em', color: 'var(--text-faint)', marginBottom: 10 }}>NAMED SCHEDULES</div>

        <input
          type="text"
          placeholder="Schedule name…"
          value={schName}
          onChange={e => setSchName(e.target.value)}
          style={{
            width: '100%', padding: '7px 9px', borderRadius: 7, marginBottom: 6,
            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--hair)',
            color: '#e2e8f0', fontSize: '0.78rem', outline: 'none', boxSizing: 'border-box',
          }}
        />
        <button className="btn primary" disabled={!schName.trim() || saving} onClick={saveSchedule}
          style={{ width: '100%', marginBottom: 12, justifyContent: 'center', fontSize: '0.78rem' }}>
          {saving ? 'Saving…' : '💾 Save schedule'}
        </button>

        {flash && (
          <div style={{ padding: '6px 10px', borderRadius: 7, background: 'rgba(34,197,94,0.12)',
            border: '1px solid rgba(34,197,94,0.3)', fontSize: '0.74rem', color: '#bbf7d0', marginBottom: 8 }}>
            {flash}
          </div>
        )}

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {schedules.map(sch => (
            <div key={sch.id} style={{
              padding: '8px 10px', borderRadius: 8, marginBottom: 5,
              background: 'rgba(255,255,255,0.04)', border: '1px solid var(--hair)',
            }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: 3 }}>{sch.name}</div>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-faint)', marginBottom: 6 }}>
                {new Date(sch.updated_at).toLocaleDateString('en-GB')}
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <button className="btn" onClick={() => loadSchedule(sch as SafarRecord)}
                  style={{ flex: 1, fontSize: '0.70rem', padding: '3px 0' }}>Load</button>
                <button className="btn" onClick={() => deleteSchedule(sch.id)}
                  style={{ fontSize: '0.70rem', padding: '3px 7px', color: 'var(--p1)' }}>✕</button>
              </div>
            </div>
          ))}
          {schedules.length === 0 && (
            <p className="faint" style={{ fontSize: '0.74rem' }}>No saved schedules.</p>
          )}
        </div>
      </div>

      {/* ── CENTRE: heatmap + chart ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflow: 'hidden' }}>

        <div className="panel" style={{ padding: 14, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexShrink: 0 }}>
            <div className="panel-title" style={{ margin: 0 }}>Officer Density — Hours × Days</div>
            <div style={{ display: 'flex', gap: 8, fontSize: '0.68rem', color: 'var(--text-faint)' }}>
              {[['#16a34a','over'],['#eab308','tight'],['#f59e0b','short'],['#ef4444','under']].map(([c,l]) => (
                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />
                  {l}
                </span>
              ))}
            </div>
          </div>

          {/* Heatmap */}
          <div style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `34px repeat(24, 1fr)`,
              gap: 2, minWidth: 600,
            }}>
              {/* Header row */}
              <div style={{ gridColumn: '1', fontSize: '0.55rem', color: 'var(--text-faint)' }} />
              {HOURS.map(h => (
                <div key={h} style={{ fontSize: '0.55rem', color: 'var(--text-faint)', textAlign: 'center', fontFamily: 'var(--mono)', paddingBottom: 2 }}>
                  {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                </div>
              ))}

              {/* Day rows */}
              {DAYS.map((day, di) => (
                <>
                  <div key={`label-${day}`} style={{ fontSize: '0.64rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 4, fontWeight: 600 }}>
                    {day}
                  </div>
                  {HOURS.map(h => {
                    const officers = grid[di][h]
                    const target = hourTarget(h)
                    const col = cellColor(officers, target)
                    return (
                      <div
                        key={`${di}-${h}`}
                        title={`${day} ${String(h).padStart(2,'0')}:00 · ${officers.toLocaleString()} officers · target ${target.toLocaleString()}`}
                        style={{
                          aspectRatio: '1/1', borderRadius: 3, minHeight: 14,
                          background: col,
                          opacity: officers === 0 ? 0.2 : 1,
                          transition: 'background 0.4s ease',
                          cursor: 'default',
                        }}
                      />
                    )
                  })}
                </>
              ))}
            </div>
          </div>

          {/* Shift-code pattern legend */}
          <div style={{ marginTop: 10, display: 'flex', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
            {shiftSummary.map(s => (
              <div key={s.code} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 28, height: 5, borderRadius: 3, background: s.col }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', fontFamily: 'var(--mono)' }}>
                  {s.code} {s.hours}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Line chart */}
        <div className="panel" style={{ padding: 14, flexShrink: 0 }}>
          <div className="panel-title" style={{ marginBottom: 8 }}>Total on-shift per hour (weekly average)</div>
          <LineChart grid={grid} target={sliders.targetPeak} />
          <style>{`.axl{font-family:var(--mono);font-size:9px;fill:var(--text-faint)}`}</style>
        </div>
      </div>

      {/* ── RIGHT: station balance ── */}
      <div className="panel" style={{ padding: 14, overflowY: 'auto' }}>
        <div className="panel-title" style={{ marginBottom: 10 }}>
          Station Balance
          <span className="faint" style={{ float: 'right', fontWeight: 400, fontSize: '0.74rem' }}>{stations.length} stations</span>
        </div>

        {topStations.map(st => {
          const allocated = stationAlloc(st)
          const ratio = allocated / st.capacity
          const pct = Math.round(ratio * 100)
          const col = ratio >= 1.05 ? '#f97316' : ratio >= 0.85 ? '#22c55e' : '#ef4444'
          const flag = ratio >= 1.05 ? '↑ over' : ratio >= 0.85 ? '✓' : '↓ short'

          return (
            <div key={st.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{st.name}</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: col }}>{flag}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px', gap: 6, alignItems: 'center' }}>
                <div style={{ height: 14, borderRadius: 4, background: 'var(--panel-2)', border: '1px solid var(--hair)', overflow: 'hidden', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${clamp(pct, 0, 100)}%`,
                    background: col, borderRadius: 4,
                    transition: 'width 0.5s cubic-bezier(.2,.9,.3,1)',
                  }} />
                </div>
                <span style={{ fontSize: '0.66rem', color: col, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>{pct}%</span>
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-faint)', marginTop: 2 }}>
                {allocated.toLocaleString()} / {st.capacity.toLocaleString()} cap
              </div>
            </div>
          )
        })}

        {topStations.length === 0 && (
          <p className="faint" style={{ fontSize: '0.78rem' }}>Loading station data…</p>
        )}

        {/* Shift-code key */}
        <hr style={{ border: 'none', borderTop: '1px solid var(--hair)', margin: '12px 0' }} />
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '.08em', marginBottom: 8 }}>SHIFT CODES</div>
        {[
          ['NSM', 'Night Shift Monday'],
          ['DSF', 'Day Shift Friday'],
          ['LSSA', 'Late Shift Saturday'],
          ['ESSU', 'Early Shift Sunday'],
        ].map(([code, label]) => (
          <div key={code} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', color: 'var(--accent-2)', minWidth: 44 }}>{code}</span>
            <span style={{ fontSize: '0.70rem', color: 'var(--text-faint)' }}>{label}</span>
          </div>
        ))}
      </div>

    </div>
  )
}

// work around TS not knowing the shape of loaded schedule
type SafarRecord = SavedSchedule & Record<string, unknown>
