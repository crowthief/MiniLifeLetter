import type { ReactNode } from 'react'

// Small stroke icons. `currentColor` makes them follow the theme.
const svg = (d: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

export const IconPlus = () => svg(<path d="M12 5v14M5 12h14" />)
export const IconChart = () => svg(<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />)
export const IconGear = () => svg(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" /></>)
export const IconTrash = () => svg(<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />)
export const IconLock = () => svg(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>)
export const IconFocus = () => svg(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />)
export const IconExitFocus = () => svg(<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />)

type BtnProps = { icon: ReactNode; label: string; onClick: () => void; active?: boolean }

/** Icon button with an accessible name and a tooltip. */
export function IconBtn({ icon, label, onClick, active }: BtnProps) {
  return (
    <button className={`icon-btn${active ? ' on' : ''}`} onClick={onClick} title={label} aria-label={label}>
      {icon}
    </button>
  )
}
