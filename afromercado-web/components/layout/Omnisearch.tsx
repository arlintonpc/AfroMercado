'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2 } from 'lucide-react'
import { sugerenciasBusqueda, type Sugerencia } from '@/lib/api/busqueda'
import { useDebounce } from '@/hooks/useDebounce'

export default function Omnisearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Sugerencia[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      setIsLoading(true)
      sugerenciasBusqueda(debouncedQuery)
        .then((data) => {
          setResults(data)
          setIsOpen(true)
        })
        .catch(() => setResults([]))
        .finally(() => setIsLoading(false))
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [debouncedQuery])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (sug: Sugerencia) => {
    setIsOpen(false)
    setQuery('')
    
    switch (sug.tipo) {
      case 'PRODUCTO':
        router.push(`/producto/${sug.id}`)
        break
      case 'HOTEL':
        router.push(`/hoteles/${sug.id}`)
        break
      case 'TOUR':
        router.push(`/tours/${sug.id}`)
        break
      case 'TRANSPORTE':
        router.push(`/transportes/${sug.id}`)
        break
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim().length > 0) {
      setIsOpen(false)
      router.push(`/buscar?q=${encodeURIComponent(query)}`)
    }
  }

  const iconoPorTipo = (tipo: string) => {
    switch (tipo) {
      case 'PRODUCTO': return '🛍️'
      case 'HOTEL': return '🏨'
      case 'TOUR': return '🌴'
      case 'TRANSPORTE': return '🚗'
      default: return '📍'
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full max-w-md mx-auto hidden md:block z-50">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <Search className="absolute left-3 w-4 h-4 text-[#1A1A1A]/40" />
        <input
          type="text"
          placeholder="Busca productos, hoteles, tours..."
          className="w-full pl-10 pr-4 py-2 rounded-full border border-[#1A1A1A]/10 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/50 focus:bg-white transition-all text-sm text-[#1A1A1A]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true) }}
        />
        {isLoading && (
          <div className="absolute right-3">
            <Loader2 className="w-4 h-4 text-[#2D6A4F] animate-spin" />
          </div>
        )}
      </form>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-[#1A1A1A]/10 overflow-hidden animate-in fade-in slide-in-from-top-2">
          <ul className="py-2">
            {results.map((sug) => (
              <li key={`${sug.tipo}-${sug.id}`}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-[#F7F5F2] transition-colors focus:bg-[#F7F5F2] focus:outline-none"
                  onClick={() => handleSelect(sug)}
                >
                  <span className="text-xl">{iconoPorTipo(sug.tipo)}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-[#1A1A1A] line-clamp-1">
                      {sug.texto}
                    </span>
                    <span className="text-xs text-[#1A1A1A]/50 capitalize">
                      {sug.tipo.toLowerCase()}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
