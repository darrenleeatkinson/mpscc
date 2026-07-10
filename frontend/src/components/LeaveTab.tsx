import { useState, useEffect } from 'react'
import { api } from '../api/client'

interface LeaveRequest {
  id: number
  officer_id: number
  collar_number: string
  forename: string
  surname: string
  rank: string
  station_name: string
  start_date: string
  end_date: string
  days: number
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requested_at: string
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PENDING:  { bg: 'rgba(234,179,8,0.12)',  color: '#eab308' },
  APPROVED: { bg: 'rgba(34,197,94,0.12)',  color: '#22c55e' },
  REJECTED: { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444' },
}

export default function LeaveTab() {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [filter,   setFilter]   = useState<'' | 'PENDING' | 'APPROVED' | 'REJECTED'>('')
  const [deciding, setDeciding] = useState<number | null>(null)

  function load() {
    const path = filter ? `/api/schedules/leave?status=${filter}` : '/api/schedules/leave'
    api<LeaveRequest[]>(path).then(setRequests).catch(() => {})
  }
  useEffect(() => { load() }, [filter])

  async function decide(id: number, status: 'APPROVED' | 'REJECTED') {
    setDeciding(id)
    await api(`/api/schedules/leave/${id}/decide`, { method: 'POST', body: { status } }).catch(() => {})
    setDeciding(null)
    load()
  }

  const pending   = requests.filter(r => r.status === 'PENDING').length
  const approved  = requests.filter(r => r.status === 'APPROVED').length

  return (
    <div className="panel" style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
      {/* Summary */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div className="panel-title" style={{ margin: 0 }}>Leave Requests</div>
          <div className="faint" style={{ fontSize: '0.74rem', marginTop: 2 }}>
            Officers entitled to 25 days/year · {pending} pending · {approved} approved this period
          </div>
        </div>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 5 }}>
          {(['', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '4px 11px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: '0.74rem', fontWeight: 600,
                background: filter === f ? '#2f6bff' : 'rgba(255,255,255,0.07)',
                color: filter === f ? '#fff' : 'var(--text-dim)',
              }}
            >{f || 'All'}</button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="faint" style={{ fontSize: '0.84rem' }}>No leave requests{filter ? ` with status ${filter}` : ''}.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.80rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--hair)' }}>
              {['Officer', 'Rank', 'Station', 'Dates', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-faint)', fontWeight: 600, fontSize: '0.70rem', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.map(r => {
              const st = STATUS_STYLE[r.status] ?? STATUS_STYLE.PENDING
              const start = new Date(r.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
              const end   = new Date(r.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
              return (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--hair)', transition: 'background 0.1s' }}>
                  <td style={{ padding: '9px 10px', fontWeight: 600 }}>{r.forename} {r.surname}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: '0.72rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.07)' }}>{r.rank}</span>
                  </td>
                  <td style={{ padding: '9px 10px', color: 'var(--text-dim)', fontSize: '0.76rem' }}>{r.station_name ?? '—'}</td>
                  <td style={{ padding: '9px 10px', fontFamily: 'var(--mono)', fontSize: '0.74rem', whiteSpace: 'nowrap' }}>{start} – {end}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700 }}>{r.days}</td>
                  <td style={{ padding: '9px 10px', color: 'var(--text-dim)', fontSize: '0.74rem', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.reason || '—'}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700, background: st.bg, color: st.color }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                    {r.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button
                          disabled={deciding === r.id}
                          onClick={() => decide(r.id, 'APPROVED')}
                          style={{
                            padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontSize: '0.70rem', fontWeight: 700,
                          }}>✓ Approve</button>
                        <button
                          disabled={deciding === r.id}
                          onClick={() => decide(r.id, 'REJECTED')}
                          style={{
                            padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                            background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: '0.70rem', fontWeight: 700,
                          }}>✕ Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
