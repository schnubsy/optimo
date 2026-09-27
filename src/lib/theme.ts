import type { SettingsData } from '../data/types'

/** Apply the theme setting to <html data-theme> and remember it for the pre-paint script in index.html. */
export function applyTheme(theme: SettingsData['theme']) {
  try {
    localStorage.setItem('optimo.theme', theme)
  } catch {
    /* ignore */
  }
  const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#E9EBEC' : '#212427')
}
