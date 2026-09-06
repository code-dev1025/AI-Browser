import type { BackendStatus } from '@shared/types'
import type { BackendClient } from './types'
import { MockBackend } from './mock'
import { HttpBackend } from './http'

export type { BackendClient, AskContext, StreamHandlers, SearchCorpusEntry } from './types'

let client: BackendClient = new MockBackend()
let lastError: string | null = null
let reachable = true

/**
 * Set AI_BACKEND_URL to switch the whole app onto the real API.
 *   dev:  AI_BACKEND_URL=http://localhost:8000 npm run dev
 *   prod: read from settings once the backend has an auth flow
 */
export async function initBackend(): Promise<void> {
  const url = process.env['AI_BACKEND_URL']?.trim()
  if (!url) {
    client = new MockBackend()
    reachable = true
    lastError = null
    return
  }

  const http = new HttpBackend(url)
  client = http
  reachable = await http.health()
  lastError = reachable ? null : `No response from ${url}`
}

export function backend(): BackendClient {
  return client
}

export function backendStatus(): BackendStatus {
  return { mode: client.mode, baseUrl: client.baseUrl, reachable, lastError }
}

export async function recheckBackend(): Promise<BackendStatus> {
  reachable = await client.health()
  lastError = reachable ? null : `No response from ${client.baseUrl ?? 'mock'}`
  return backendStatus()
}
