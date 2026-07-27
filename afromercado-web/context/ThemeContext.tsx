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

  function aplicarTemaDOM(nuevoTema: Theme) {
    if (nuevoTema === 'dark') {
      document.documentElement.classList.add('dark')
      document.body.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark')
    }
  }

  // Modo oscuro deshabilitado temporalmente: la cobertura de clases `dark:`
  // no llega a secciones clave (carruseles del home, resultados de búsqueda),
  // así que activarlo por preferencia del sistema operativo dejaría la
  // interfaz a medias sin que el usuario haya tocado nada. Forzamos claro
  // hasta completar esa cobertura; no se lee ni la preferencia del SO ni lo
  // guardado en localStorage de sesiones previas.
  useEffect(() => {
    aplicarTemaDOM('light')
  }, [])

  function setTheme(newTheme: Theme) {
    setThemeState(newTheme)
    localStorage.setItem('teravia_theme', newTheme)
    aplicarTemaDOM(newTheme)
  }

  function toggleTheme() {
    const siguienteTema = theme === 'light' ? 'dark' : 'light'
    setTheme(siguienteTema)
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
    return {
      theme: 'light' as Theme,
      toggleTheme: () => {},
      setTheme: () => {},
    }
  }
  return context
}
