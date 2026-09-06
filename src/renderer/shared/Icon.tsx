/** A small stroked icon set. 24×24 grid, 1.6 stroke, no external dependency. */

const PATHS = {
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  reload: 'M20 11a8 8 0 10-2.3 5.7M20 5v6h-6',
  stop: 'M6 6l12 12M18 6L6 18',
  home: 'M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  ai: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8z',
  note: 'M5 4h9l5 5v11H5zM14 4v5h5',
  history: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 4v4h4M12 7v5l3.5 2',
  workspace: 'M4 5h6v6H4zM14 5h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z',
  search: 'M11 19a8 8 0 108-8 8 8 0 00-8 8zM17 17l4 4',
  split: 'M4 5h16v14H4zM12 5v14',
  focus: 'M12 8a4 4 0 104 4 4 4 0 00-4-4zM12 3v2M12 19v2M3 12h2M19 12h2',
  pin: 'M9 3h6l-1 6 4 4H6l4-4z M12 13v8',
  sleep: 'M14 3a9 9 0 11-9 9 7 7 0 009-9z',
  menu: 'M12 6.5v.01M12 12v.01M12 17.5v.01',
  chevron: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  panel: 'M4 5h16v14H4zM9 5v14',
  compare: 'M4 6h7v12H4zM13 6h7v12h-7zM8 3v2M16 3v2',
  summarize: 'M5 6h14M5 10h14M5 14h9M5 18h6',
  check: 'M5 12l5 5L20 7',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  bookmark: 'M6 4h12v16l-6-4-6 4z',
  spinner: 'M12 3a9 9 0 019 9'
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 15 }: { name: IconName; size?: number }): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
