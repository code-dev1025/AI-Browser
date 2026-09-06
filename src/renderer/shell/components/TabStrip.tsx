import { useState } from 'react'
import { send } from '../../shared/api'
import { Icon } from '../../shared/Icon'
import { groupColorVar, useTabs } from '../../shared/store/tabs'
import type { TabGroup, TabId, TabModel } from '@shared/types'

/**
 * Horizontal strip. Group members are contiguous (main guarantees it), so a
 * group renders as a coloured header chip followed by its tabs.
 */
export function TabStrip(): React.ReactElement {
  const tabs = useTabs((s) => s.tabs)
  const order = useTabs((s) => s.order)
  const groups = useTabs((s) => s.groups)
  const activeTabId = useTabs((s) => s.activeTabId)
  const [dragOver, setDragOver] = useState<TabId | null>(null)

  const rows: React.ReactNode[] = []
  let lastGroup: string | null = null

  for (const id of order) {
    const tab = tabs[id]
    if (!tab) continue

    if (tab.groupId !== lastGroup) {
      lastGroup = tab.groupId
      const group = groups.find((g) => g.id === tab.groupId)
      if (group) rows.push(<GroupTag key={`g-${group.id}`} group={group} />)
    }

    const group = groups.find((g) => g.id === tab.groupId)
    if (group?.collapsed) continue

    rows.push(
      <Tab
        key={id}
        tab={tab}
        active={id === activeTabId}
        color={group ? groupColorVar(group.color) : undefined}
        dragOver={dragOver === id}
        onDragOver={setDragOver}
      />
    )
  }

  return (
    <div className="tabstrip a-tabs" role="tablist">
      {rows}
      <button className="newtab" title="新しいタブ (Ctrl+T)" onClick={() => send('tab.create', {})}>
        <Icon name="plus" size={14} />
      </button>
    </div>
  )
}

function GroupTag({ group }: { group: TabGroup }): React.ReactElement {
  return (
    <button
      className="grouptag"
      style={{ ['--gc' as string]: groupColorVar(group.color) }}
      title={group.collapsed ? 'グループを展開' : 'グループを折りたたむ'}
      onClick={() => send('group.setCollapsed', { groupId: group.id, collapsed: !group.collapsed })}
    >
      <Icon name={group.collapsed ? 'chevronRight' : 'chevron'} size={11} />
      {group.name}
    </button>
  )
}

function Tab({
  tab,
  active,
  color,
  dragOver,
  onDragOver
}: {
  tab: TabModel
  active: boolean
  color: string | undefined
  dragOver: boolean
  onDragOver: (id: TabId | null) => void
}): React.ReactElement {
  const order = useTabs((s) => s.order)

  return (
    <div
      role="tab"
      aria-selected={active}
      className={`tab${dragOver ? ' dragover' : ''}`}
      data-active={active}
      data-asleep={tab.asleep}
      data-pinned={tab.pinned}
      style={color ? { borderTopColor: color } : undefined}
      title={`${tab.title}\n${tab.url}`}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/tab-id', tab.id)}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(tab.id)
      }}
      onDragLeave={() => onDragOver(null)}
      onDrop={(e) => {
        e.preventDefault()
        onDragOver(null)
        const dragged = e.dataTransfer.getData('text/tab-id')
        if (dragged && dragged !== tab.id) {
          send('tab.reorder', { tabId: dragged, toIndex: order.indexOf(tab.id) })
        }
      }}
      onMouseDown={(e) => {
        if (e.button === 1) {
          e.preventDefault()
          send('tab.close', { tabId: tab.id })
        }
      }}
      onClick={() => send('tab.activate', { tabId: tab.id })}
      onContextMenu={(e) => {
        e.preventDefault()
        send('tab.setPinned', { tabId: tab.id, pinned: !tab.pinned })
      }}
    >
      {tab.faviconUrl ? (
        <img className="fav" src={tab.faviconUrl} alt="" />
      ) : (
        <span className="fav" style={{ opacity: 0.4 }}>
          <Icon name={tab.asleep ? 'sleep' : 'panel'} size={13} />
        </span>
      )}
      {!tab.pinned && <span className="label">{tab.title || '新しいタブ'}</span>}
      {tab.audible && !tab.pinned && <span title="音声再生中">♪</span>}
      {!tab.pinned && (
        <button
          className="close"
          title="タブを閉じる (Ctrl+W)"
          onClick={(e) => {
            e.stopPropagation()
            send('tab.close', { tabId: tab.id })
          }}
        >
          <Icon name="close" size={11} />
        </button>
      )}
    </div>
  )
}
