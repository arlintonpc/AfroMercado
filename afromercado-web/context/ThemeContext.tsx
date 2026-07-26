'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')

  useEffect(() => {
    const stored = localStorage.getItem('teravia_theme') as Theme | null
    if (stored === 'dark' || stored === 'light') {
      setThemeState(stored)
      if (stored === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        setThemeState('dark')
        document.documentElement.classList.add('dark')
      }
    }
  }, [])

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme)
    localStorage.setItem('teravia_theme', newTheme)
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  function toggleTheme() {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    // Retornar fallback seguro para SSR
    return {
      theme: 'light' as Theme,
      toggleTheme: () => {},
      setTheme: () => {},
    }
  }
  return context
}
