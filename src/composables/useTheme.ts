import { ref, watch } from 'vue'

const STORAGE_KEY = 'lt-theme'

function getInitialTheme(): 'light' | 'dark' {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark') return 'dark'
  return 'light'
}

function applyTheme(t: 'light' | 'dark') {
  document.documentElement.dataset.theme = t
  localStorage.setItem(STORAGE_KEY, t)
}

export function useTheme() {
  const theme = ref<'light' | 'dark'>(getInitialTheme())

  applyTheme(theme.value)

  function toggleTheme() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
    applyTheme(theme.value)
  }

  function setTheme(t: 'light' | 'dark') {
    theme.value = t
    applyTheme(t)
  }

  return { theme, toggleTheme, setTheme }
}
