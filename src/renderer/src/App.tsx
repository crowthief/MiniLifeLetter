import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_SETTINGS, Settings, Status } from '../../shared/types'
import { AuthScreen } from './AuthScreen'
import { Journal } from './Journal'

export function App() {
  const [status, setStatus] = useState<Status | null>(null)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  useEffect(() => {
    const r = document.documentElement
    r.dataset.theme = settings.theme
    r.dataset.font = settings.font
    r.style.fontSize = `${settings.fontSize}px`
  }, [settings])

  // Every account has its own settings, so they are reloaded whenever the login state changes.
  const refresh = useCallback(async () => {
    const s = await window.api.status()
    setSettings(await window.api.getSettings())
    setStatus(s)
  }, [])

  useEffect(() => {
    void refresh()
    return window.api.onLocked(() => void refresh())
  }, [refresh])

  if (!status) return null
  if (!status.unlocked) return <AuthScreen status={status} onDone={() => void refresh()} />
  return (
    <Journal account={status.accounts.find((a) => a.id === status.activeId) ?? null}
      onLock={() => void window.api.lock()} settings={settings}
      onSettings={(s) => { setSettings(s); void window.api.setSettings(s).then(setSettings) }} />
  )
}
