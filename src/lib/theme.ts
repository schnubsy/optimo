import type { SettingsData } from '../data/types'

/** Apply the theme setting to <html data-theme> and remember it for the pre-paint script in index.html. */
export function applyTheme(theme: SettingsData['theme']) {
  try {
    localStorage.setItem('optimo.theme', theme)
  } catch {
    /* ignore */
  }
  const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
  document.documentElement.dataset.theme = resolved
  // an explicit choice overrides the per-scheme theme-color metas (canvas of the chosen theme)
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    if (theme === 'system') m.setAttribute('content', m.getAttribute('media')?.includes('dark') ? '#211d1c' : '#f8f0ee')
    else m.setAttribute('content', resolved === 'light' ? '#f8f0ee' : '#211d1c')
  }
}
