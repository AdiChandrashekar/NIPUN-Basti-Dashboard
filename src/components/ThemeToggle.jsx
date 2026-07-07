import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [mode, setMode] = useState(() => localStorage.getItem('theme') || 'system')

  useEffect(() => {
    const root = document.documentElement
    if (mode === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', mode)
    }
    localStorage.setItem('theme', mode)
  }, [mode])

  const next = { system: 'light', light: 'dark', dark: 'system' }
  const labels = { system: 'Auto', light: 'Light', dark: 'Dark' }

  return (
    <button className="theme-toggle" onClick={() => setMode(next[mode])} title="Toggle color theme">
      {labels[mode]}
    </button>
  )
}
