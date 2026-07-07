import { useEffect, useRef, useState } from 'react'

export default function MultiSelect({ label, options, selected, onChange, allLabel = 'All', searchable = false, maxSelected = null }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function toggle(value) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      if (maxSelected && selected.length >= maxSelected) return
      onChange([...selected, value])
    }
  }

  const summary = selected.length === 0 ? allLabel : selected.length === 1 ? options.find((o) => o.value === selected[0])?.label ?? selected[0] : `${selected.length} selected`

  return (
    <div className="multiselect" ref={ref}>
      <button type="button" className="multiselect-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="multiselect-label">{label}</span>
        <span className="multiselect-summary">{summary}</span>
        <span className="multiselect-caret">▾</span>
      </button>
      {open && (
        <div className="multiselect-pop" role="listbox">
          {searchable && (
            <input
              className="multiselect-search"
              placeholder={`Search ${label.toLowerCase()}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          )}
          <div className="multiselect-actions">
            <button type="button" onClick={() => onChange([])}>
              {allLabel}
            </button>
            <button type="button" onClick={() => onChange(options.map((o) => o.value))}>
              Select all
            </button>
          </div>
          <div className="multiselect-list">
            {filtered.map((o) => (
              <label key={o.value} className="multiselect-item">
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                <span>{o.label}</span>
              </label>
            ))}
            {filtered.length === 0 && <div className="multiselect-empty">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}
