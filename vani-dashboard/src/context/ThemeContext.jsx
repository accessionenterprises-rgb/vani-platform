import { createContext, useContext, useEffect, useState } from 'react'

const ThemeCtx = createContext({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('vani_theme') || 'dark')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.add('light')
    } else {
      root.classList.remove('light')
    }
    localStorage.setItem('vani_theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export const useTheme = () => useContext(ThemeCtx)
