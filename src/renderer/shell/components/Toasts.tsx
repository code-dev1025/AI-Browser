import { useUi } from '../../shared/store/ui'

export function Toasts(): React.ReactElement {
  const toasts = useUi((s) => s.toasts)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
