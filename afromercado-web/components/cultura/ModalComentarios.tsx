'use client'

import React, { useEffect, useState, useRef } from 'react'
import {
  listarComentariosPublicacion,
  crearComentarioPublicacion,
  ComentarioPublicacionCultural,
} from '@/lib/api/cultura'
import { useAuth } from '@/context/AuthContext'

interface ModalComentariosProps {
  publicacionId: number
  totalComentariosInit?: number
  onClose: () => void
  onComentarioAgregado?: () => void
}

export default function ModalComentarios({ publicacionId, onClose, totalComentariosInit, onComentarioAgregado }: ModalComentariosProps) {
  const { usuario } = useAuth()
  const [comentarios, setComentarios] = useState<ComentarioPublicacionCultural[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let montado = true
    const cargar = async () => {
      try {
        const res = await listarComentariosPublicacion(publicacionId, { limit: 50 })
        if (montado) {
          setComentarios(res.items || [])
          setCargando(false)
        }
      } catch {
        if (montado) {
          setError('No se pudieron cargar los comentarios.')
          setCargando(false)
        }
      }
    }
    cargar()
    return () => { montado = false }
  }, [publicacionId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim() || !usuario) return

    setEnviando(true)
    try {
      const nuevo = await crearComentarioPublicacion(publicacionId, texto.trim())
      setComentarios(prev => [nuevo, ...prev])
      setTexto('')
      if (onComentarioAgregado) onComentarioAgregado()
      if (listRef.current) {
        listRef.current.scrollTo({ top: 0, behavior: 'smooth' })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al publicar comentario')
    } finally {
      setEnviando(false)
    }
  }

  // Prevenir que clics dentro del modal se propaguen y pausen/despausen el video
  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="flex h-[75vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:h-[600px] sm:max-w-md sm:rounded-2xl"
        onClick={stopPropagation}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            Comentarios <span className="text-gray-500 text-sm font-normal">({totalComentariosInit ?? comentarios.length})</span>
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Lista */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {cargando ? (
            <div className="flex h-full items-center justify-center text-gray-500">Cargando...</div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : comentarios.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <p>No hay comentarios aún.</p>
              <p className="text-sm">Sé el primero en comentar.</p>
            </div>
          ) : (
            comentarios.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B4332] text-white text-xs font-bold uppercase">
                  {c.usuario?.nombre ? c.usuario.nombre.charAt(0) : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">{c.usuario?.nombre || 'Usuario'}</span>
                  <span className="text-sm text-gray-700 break-words break-all sm:break-normal">{c.texto}</span>
                  <span className="text-xs text-gray-400 mt-1">
                    {new Date(c.createdAt).toLocaleDateString('es-CO', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Formulario */}
        <div className="border-t p-3 bg-gray-50">
          {usuario ? (
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Añade un comentario..."
                className="flex-1 rounded-full border-gray-300 bg-white px-4 py-2 text-sm focus:border-[#1B4332] focus:outline-none focus:ring-1 focus:ring-[#1B4332]"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                maxLength={1000}
                disabled={enviando}
              />
              <button
                type="submit"
                disabled={!texto.trim() || enviando}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1B4332] text-white disabled:bg-gray-300 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          ) : (
            <div className="text-center text-sm text-gray-600 py-1">
              <a href="/ingresar" className="font-semibold text-[#1B4332] hover:underline">Inicia sesión</a> para comentar.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
