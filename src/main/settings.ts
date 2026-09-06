/**
 * Application settings, owned by main.
 *
 * The locale lives here rather than in the renderer because main writes
 * user-visible text too — toasts, and the stand-in backend's answers. One
 * owner means the notification and the button that caused it can never end up
 * in different languages.
 */

import { app } from 'electron'
import type { AppSettings, Locale } from '@shared/types'
import { localeFromSystem, translate, type MessageKey, type MessageParams } from '@shared/i18n'
import { JsonStore } from './store'

let store: JsonStore<AppSettings> | null = null

/** Call once, after app.whenReady(). */
export function initSettings(): AppSettings {
  store = new JsonStore<AppSettings>('settings', { locale: localeFromSystem(app.getLocale()) })
  return store.get()
}

export function settings(): AppSettings {
  return store?.get() ?? { locale: 'ja' }
}

export function locale(): Locale {
  return settings().locale
}

export function setLocale(next: Locale): AppSettings {
  store?.set({ ...settings(), locale: next })
  return settings()
}

/** Translate in the current interface language. */
export function tm(key: MessageKey, params?: MessageParams): string {
  return translate(locale(), key, params)
}
