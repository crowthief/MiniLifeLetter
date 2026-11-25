import { useEffect, useState } from 'react'
import type { Entry } from '../../shared/types'

export function Trash({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<Entry[]>([])

  useEffect(() => {
    void window.api.listTrash().then((r) => r.ok && setItems(r.value))
  }, [])

  async function act(id: string, kind: 'restore' | 'delete') {
    if (kind === 'delete' && !window.confirm('این خاطره برای همیشه پاک شود؟ قابل بازگشت نیست.')) return
    const r = kind === 'restore' ? await window.api.restoreEntry(id) : await window.api.deleteForever(id)
    if (r.ok) setItems((xs) => xs.filter((x) => x.id !== id))
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2>سطل زباله</h2>
        <p className="sub">خاطرات حذف‌شده بعد از ۳۰ روز خودکار پاک می‌شوند.</p>
        <ul>
          {items.map((e) => (
            <li key={e.id}>
              <span>{e.title || 'بدون عنوان'}</span>
              <span>
                <button className="link" onClick={() => void act(e.id, 'restore')}>بازیابی</button>
                <button className="danger" onClick={() => void act(e.id, 'delete')}>حذف نهایی</button>
              </span>
            </li>
          ))}
          {items.length === 0 && <li className="none">سطل زباله خالی است.</li>}
        </ul>
        <button onClick={onClose}>بستن</button>
      </div>
    </div>
  )
}
