/**
 * The WIDE preload — for our own React UI only.
 *
 * It is still sandboxed and context-isolated; what makes it "wide" is that it
 * exposes the whole command surface. It must never be attached to a view that
 * renders web content (see preload/content.ts for that).
 */

import { contextBridge, ipcRenderer, webFrame } from 'electron'
import type { CommandName, CommandReq, CommandRes, EventName, Events } from '@shared/contract'

const api = {
  /** Request/response. Every channel is typed by the contract. */
  invoke<K extends CommandName>(channel: K, payload?: CommandReq<K>): Promise<CommandRes<K>> {
    return ipcRenderer.invoke(channel, payload) as Promise<CommandRes<K>>
  },

  /** Subscribe to a main → renderer event. Returns an unsubscribe function. */
  on<K extends EventName>(channel: K, listener: (payload: Events[K]) => void): () => void {
    const wrapped = (_e: unknown, payload: Events[K]): void => listener(payload)
    ipcRenderer.on(channel, wrapped as never)
    return () => ipcRenderer.removeListener(channel, wrapped as never)
  },

  /** Chrome zoom, kept separate from page zoom on purpose (blueprint L7). */
  setShellZoom(factor: number): void {
    webFrame.setZoomFactor(Math.max(0.7, Math.min(1.6, factor)))
  },

  getShellZoom(): number {
    return webFrame.getZoomFactor()
  },

  platform: process.platform
}

export type ShellApi = typeof api

contextBridge.exposeInMainWorld('shellApi', api)
