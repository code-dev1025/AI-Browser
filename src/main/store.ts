/**
 * Local persistence, deliberately minimal.
 *
 * Everything here is a placeholder for the backend: workspaces, history and
 * notes will move behind the API once it exists (see INTEGRATION.md). The file
 * format is intentionally the same JSON shape the API is expected to return,
 * so the swap is a change of transport, not of types.
 */

import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export class JsonStore<T> {
  private readonly file: string
  private data: T
  private timer: NodeJS.Timeout | null = null

  constructor(name: string, fallback: T) {
    const dir = join(app.getPath('userData'), 'data')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.file = join(dir, `${name}.json`)
    this.data = fallback

    if (existsSync(this.file)) {
      try {
        this.data = JSON.parse(readFileSync(this.file, 'utf8')) as T
      } catch {
        // A corrupt file must not stop the browser from starting.
        this.data = fallback
      }
    }
  }

  get(): T {
    return this.data
  }

  set(next: T): void {
    this.data = next
    this.scheduleWrite()
  }

  update(fn: (current: T) => T): T {
    this.data = fn(this.data)
    this.scheduleWrite()
    return this.data
  }

  /** Debounced so a burst of history writes costs one flush. */
  private scheduleWrite(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flush(), 400)
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    try {
      writeFileSync(this.file, JSON.stringify(this.data, null, 2), 'utf8')
    } catch {
      /* disk full / permissions — losing a debounced write is survivable */
    }
  }
}

export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}
