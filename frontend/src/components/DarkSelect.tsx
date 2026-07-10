import { useState, useEffect, useRef, type CSSProperties } from 'react'

// ── shared types & styles ─────────────────────────────────────────────────

export interface SelectOption { value: string; label: string }

const DROPDOWN: CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300,
  background: '#0b0f1e',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.75)',
  overflow: 'hidden',
}
const SEARCH: CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'rgba(255,255,255,0.05)',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  border: 'none', color: '#e2e8f0', fontSize: '0.8rem', outline: 'none',
  boxSizing: 'border-box',
}
const SCROLL: CSSProperties = { maxHeight: 240, overflowY: 'auto' }
const TRIGGER: CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 8,
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
  color: '#e2e8f0', fontSize: '0.82rem', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
}

function optRow(selected: boolean, hovered: boolean): CSSProperties {
  return {
    padding: '8px 12px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: '0.82rem',
    color: selected ? '#fff' : '#cbd5e1',
    background: hovered
      ? 'rgba(47,107,255,0.18)'
      : selected
        ? 'rgba(47,107,255,0.12)'
        : 'transparent',
    transition: 'background 0.08s',
  }
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, cb])
}

// ── DarkSelect (single) ───────────────────────────────────────────────────

interface DarkSelectProps {
  value: string
  onChange: (v: string) => void
  options: SelectOption[]
  placeholder?: string
  searchable?: boolean
  nullable?: boolean
  nullLabel?: string
}

export function DarkSelect({
  value, onChange, options, placeholder = '—', searchable = false, nullable = false, nullLabel = '— None —',
}: DarkSelectProps) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, () => { setOpen(false); setQuery('') })

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setOpen(false); setQuery('') } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  )
  const label = options.find(o => o.value === value)?.label ?? (value === '' ? placeholder : value)

  function pick(v: string) { onChange(v); setOpen(false); setQuery(''); setHovered(null) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={TRIGGER}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{ opacity: 0.45, fontSize: '0.65rem', flexShrink: 0 }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={DROPDOWN}>
          {searchable && (
            <input
              autoFocus
              type="text"
              placeholder="Search…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={SEARCH}
            />
          )}
          <div style={SCROLL}>
            {nullable && (
              <div
                style={optRow(value === '', hovered === '')}
                onMouseEnter={() => setHovered('')}
                onMouseLeave={() => setHovered(null)}
                onClick={() => pick('')}
              >{nullLabel}</div>
            )}
            {filtered.map(o => (
              <div
                key={o.value}
                style={optRow(o.value === value, hovered === o.value)}
                onMouseEnter={() => setHovered(o.value)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => pick(o.value)}
              >
                {o.value === value && (
                  <span style={{ color: '#60a5fa', fontSize: '0.7rem', flexShrink: 0 }}>✓</span>
                )}
                {o.label}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.78rem' }}>No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── DarkMultiSelect (multi with checkboxes) ───────────────────────────────

interface DarkMultiSelectProps {
  value: string[]
  onChange: (v: string[]) => void
  options: SelectOption[]
  placeholder?: string
}

export function DarkMultiSelect({
  value, onChange, options, placeholder = 'All',
}: DarkMultiSelectProps) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [hovered, setHovered] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, () => { setOpen(false); setQuery('') })

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setOpen(false); setQuery('') } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
  }

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase())
  )

  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find(o => o.value === value[0])?.label ?? value[0])
        : `${value.length} selected`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={TRIGGER}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        {value.length > 0 && (
          <span
            title="Clear"
            onClick={e => { e.stopPropagation(); onChange([]) }}
            style={{ opacity: 0.6, fontSize: '0.75rem', flexShrink: 0, lineHeight: 1 }}
          >✕</span>
        )}
        <span style={{ opacity: 0.45, fontSize: '0.65rem', flexShrink: 0 }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div style={DROPDOWN}>
          <input
            autoFocus
            type="text"
            placeholder="Filter…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={SEARCH}
          />
          <div style={SCROLL}>
            {filtered.map(o => {
              const checked = value.includes(o.value)
              return (
                <div
                  key={o.value}
                  style={optRow(checked, hovered === o.value)}
                  onMouseEnter={() => setHovered(o.value)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => toggle(o.value)}
                >
                  {/* checkbox */}
                  <div style={{
                    width: 15, height: 15, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${checked ? '#3b82f6' : 'rgba(255,255,255,0.25)'}`,
                    background: checked ? '#3b82f6' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}>
                    {checked && <span style={{ color: '#fff', fontSize: '0.55rem', fontWeight: 700 }}>✓</span>}
                  </div>
                  {o.label}
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.78rem' }}>No results</div>
            )}
          </div>
          {value.length > 0 && (
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              padding: '7px 12px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{value.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.74rem' }}
              >Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
