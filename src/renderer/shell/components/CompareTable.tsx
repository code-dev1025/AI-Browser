import type { CompareResult } from '@shared/types'
import { send } from '../../shared/api'
import { hostOf } from '../../shared/format'
import { useT } from '../../shared/store/locale'

/**
 * Live views plus a generated table (blueprint L5-S4): a table alone cannot be
 * trusted, so every column header jumps to the page it came from.
 */
export function CompareTable({
  result,
  onDismiss
}: {
  result: CompareResult
  onDismiss: () => void
}): React.ReactElement {
  const t = useT()
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
        <strong style={{ fontSize: 12 }}>{t('compare.title')}</strong>
        <span style={{ flex: 1 }} />
        <button className="btn sm" onClick={onDismiss}>
          {t('common.close')}
        </button>
      </div>

      <div style={{ overflowX: 'auto', maxHeight: 320 }}>
        <table className="cmp">
          <thead>
            <tr>
              <th />
              {result.columns.map((c) => (
                <th key={c.tabId}>
                  <button
                    className="cite"
                    style={{ border: 0, padding: 0, background: 'none' }}
                    title={c.url}
                    onClick={() => send('tab.activate', { tabId: c.tabId })}
                  >
                    <b>{hostOf(c.url)}</b>
                    {c.title.slice(0, 40)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr key={row.label}>
                <td className="label">{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={i} className={row.bestIndex === i ? 'best' : undefined}>
                    {v ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.verdict && (
        <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--fg-2)' }}>{result.verdict}</div>
      )}
    </div>
  )
}
