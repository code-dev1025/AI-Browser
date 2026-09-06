import type { CommandName, CommandReq, CommandRes, EventName, Events } from '@shared/contract'

interface ShellApi {
  invoke<K extends CommandName>(channel: K, payload?: CommandReq<K>): Promise<CommandRes<K>>
  on<K extends EventName>(channel: K, listener: (payload: Events[K]) => void): () => void
  setShellZoom(factor: number): void
  getShellZoom(): number
  platform: string
}

declare global {
  interface Window {
    shellApi: ShellApi
  }
}

/**
 * The only way the UI talks to main. Every call is typed by shared/contract.ts,
 * so a renamed channel fails to compile instead of failing at runtime.
 */
export const api = window.shellApi

/** Fire-and-forget wrapper for commands whose failure should not break the UI. */
export function send<K extends CommandName>(channel: K, payload?: CommandReq<K>): void {
  void api.invoke(channel, payload).catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(`[ipc] ${channel} failed`, err)
  })
}
