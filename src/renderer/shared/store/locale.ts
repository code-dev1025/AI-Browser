import { useMemo } from 'react'
import { create } from 'zustand'
import type { Locale } from '@shared/types'
import { translate, type MessageKey, type MessageParams } from '@shared/i18n'
import { api } from '../api'

/**
 * The interface language, mirrored from main.
 *
 * Main owns it (see main/settings.ts) so its toasts and the stand-in backend's
 * answers speak the same language as the button that triggered them. Both React
 * roots — the shell and the overlay — bind to it independently.
 */
interface LocaleStore {
  locale: Locale
  /** Local mirror; called when main tells us the setting changed. */
  applyLocale: (locale: Locale) => void
  /** User-initiated change; main persists it and broadcasts back. */
  changeLocale: (locale: Locale) => void
  toggleLocale: () => void
}

export const useLocaleStore = create<LocaleStore>((set, get) => ({
  locale: 'ja',

  applyLocale: (locale) => {
    set({ locale })
    document.documentElement.lang = locale
  },

  changeLocale: (locale) => {
    void api.invoke('settings.setLocale', { locale })
  },

  toggleLocale: () => {
    get().changeLocale(get().locale === 'ja' ? 'en' : 'ja')
  }
}))

export type Translate = (key: MessageKey, params?: MessageParams) => string

/** Re-renders the calling component whenever the language changes. */
export function useT(): Translate {
  const locale = useLocaleStore((s) => s.locale)
  return useMemo<Translate>(() => (key, params) => translate(locale, key, params), [locale])
}

/** For code that runs outside React (command handlers, event callbacks). */
export function tr(key: MessageKey, params?: MessageParams): string {
  return translate(useLocaleStore.getState().locale, key, params)
}

export function useLocale(): Locale {
  return useLocaleStore((s) => s.locale)
}

/** Call once per renderer entry point. Returns an unsubscribe function. */
export function bindLocale(): () => void {
  const { applyLocale } = useLocaleStore.getState()
  void api.invoke('settings.get').then((s) => applyLocale(s.locale))
  return api.on('settings:changed', (s) => applyLocale(s.locale))
}
