import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, Settings } from '../../shared/types'
import { AuthScreen } from './AuthScreen'
import { Journal } from './Journal'

type Phase = 'loading' | 'locked' | 'open'

export function App() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [hasVault, setHasVault] = useState(false)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  useEffect(() => { void window.api.getSettings().then(setSettings) }, [])
  useEffect(() => {
    const r = document.documentElement
    r.dataset.theme = settings.theme
    r.dataset.font = settings.font
    r.style.fontSize = `${settings.fontSize}px`
  }, [settings])

  const refresh = useCallback(async () => {
    const s = await window.api.status()
    setHasVault(s.hasVault)
    setPhase(s.unlocked ? 'open' : 'locked')
  }, [])

  useEffect(() => {
    void refresh()
    return window.api.onLocked(() => void refresh())
  }, [refresh])

  if (phase === 'loading') return null
  if (phase === 'locked') return <AuthScreen hasVault={hasVault} onDone={() => void refresh()} />
  return (
    <Journal onLock={() => void window.api.lock()} settings={settings}
      onSettings={(s) => { setSettings(s); void window.api.setSettings(s).then(setSettings) }} />
  )
}
