'use client'

import React, { useEffect, useState, useRef } from 'react'
import {
  listarComentariosPublicacion,
  crearComentarioPublicacion,
  toggleFijarComentario,
  ComentarioPublicacionCultural,
} from '@/lib/api/cultura'
import { useAuth } from '@/context/AuthContext'

interface ModalComentariosProps {
  publicacionId: number
  totalComentariosInit?: number
  /** Solo quien publicó puede fijar comentarios en su propia publicación. */
  esPropiaPublicacion?: boolean
  inline?: boolean
  onClose?: () => void
  onComentarioAgregado?: () => void
}

function fechaComentario(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface FilaComentarioProps {
  comentario: ComentarioPublicacionCultural
  esRespuesta?: boolean
  puedeFijar: boolean
  fijando: boolean
  onResponder: () => void
  onFijar: () => void
}

function FilaComentario({ comentario: c, esRespuesta, puedeFijar, fijando, onResponder, onFijar }: FilaComentarioProps) {
  return (
    <div className={`flex gap-3 ${esRespuesta ? 'ml-11' : ''}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B4332] text-white text-xs font-bold uppercase">
        {c.usuario?.nombre ? c.usuario.nombre.charAt(0) : '?'}
      </div>
      <div className="flex flex-1 flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-900">{c.usuario?.nombre || 'Usuario'}</span>
          {c.fijado && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-[#2D6A4F]">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M16 3l5 5-5.5 1.5L12 14l-2-2 4.5-4.5L13 6l3-3z" /><path d="M10 14L3 21l6-3 2-2-1-2z" /></svg>
              Fijado
            </span>
          )}
        </div>
        <span className="text-sm text-gray-700 break-words break-all sm:break-normal">{c.texto}</span>
        <div className="mt-1 flex items-center gap-3">
          <span className="text-xs text-gray-400">{fechaComentario(c.createdAt)}</span>
          {!esRespuesta && (
            <button type="button" onClick={onResponder} className="text-xs font-semibold text-gray-500 hover:text-[#1B4332]">
              Responder
            </button>
          )}
          {!esRespuesta && puedeFijar && (
            <button type="button" onClick={onFijar} disabled={fijando} className="text-xs font-semibold text-gray-500 hover:text-[#1B4332] disabled:opacity-50">
              {c.fijado ? 'Desfijar' : 'Fijar'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ModalComentarios({ publicacionId, onClose, totalComentariosInit, esPropiaPublicacion, inline = false, onComentarioAgregado }: ModalComentariosProps) {
  const { usuario } = useAuth()
  const [comentarios, setComentarios] = useState<ComentarioPublicacionCultural[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [respondiendoA, setRespondiendoA] = useState<{ id: number; nombre: string } | null>(null)
  const [fijandoId, setFijandoId] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const totalConRespuestas = comentarios.reduce((acc, c) => acc + 1 + (c.respuestas?.length || 0), 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim() || enviando) return

    setEnviando(true)
    try {
      const nuevo = await crearComentarioPublicacion(publicacionId, texto, respondiendoA?.id)
      
      setComentarios((prev) => {
        if (respondiendoA) {
          return prev.map(c => {
            if (c.id === respondiendoA.id) {
              return { ...c, respuestas: [...(c.respuestas || []), nuevo] }
            }
            return c
          })
        } else {
          const fijados = prev.filter(c => c.fijado)
          const normales = prev.filter(c => !c.fijado)
          return [...fijados, nuevo, ...normales]
        }
      })
      
      setTexto('')
      setRespondiendoA(null)
      if (onComentarioAgregado) onComentarioAgregado()
      
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = respondiendoA ? listRef.current.scrollHeight : 0
        }
      }, 100)
    } catch {
      alert('Error al enviar el comentario.')
    } finally {
      setEnviando(false)
    }
  }

  const iniciarRespuesta = (c: ComentarioPublicacionCultural) => {
    setRespondiendoA({ id: c.id, nombre: c.usuario?.nombre || 'Usuario' })
    inputRef.current?.focus()
  }

  async function manejarFijar(c: ComentarioPublicacionCultural) {
    if (fijandoId) return
    setFijandoId(c.id)
    const anterior = c.fijado
    setComentarios((prev) => prev.map((x) => {
      if (x.id === c.id) return { ...x, fijado: !anterior }
      if (!anterior && x.fijado) return { ...x, fijado: false }
      return x
    }))
    try {
      await toggleFijarComentario(publicacionId, c.id)
    } catch {
      setComentarios((prev) => prev.map((x) => (x.id === c.id ? { ...x, fijado: anterior } : x)))
    } finally {
      setFijandoId(null)
    }
  }

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation()

  const contenidoInner = (
    <div
      className={inline ? "flex h-full w-full flex-col bg-white" : "flex h-[75vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:h-[600px] sm:max-w-md sm:rounded-2xl"}
      onClick={inline ? undefined : stopPropagation}
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
          Comentarios <span className="text-gray-500 text-sm font-normal">({totalComentariosInit ?? totalConRespuestas})</span>
        </h3>
        {!inline && onClose && (
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        )}
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
              <div key={c.id} className="flex flex-col gap-3">
                <FilaComentario
                  comentario={c}
                  puedeFijar={!!esPropiaPublicacion}
                  fijando={fijandoId === c.id}
                  onResponder={() => iniciarRespuesta(c)}
                  onFijar={() => manejarFijar(c)}
                />
                {c.respuestas && c.respuestas.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {c.respuestas.map((r) => (
                      <FilaComentario
                        key={r.id}
                        comentario={r}
                        esRespuesta
                        puedeFijar={false}
                        fijando={false}
                        onResponder={() => {}}
                        onFijar={() => {}}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Formulario */}
        <div className="border-t p-3 bg-gray-50">
          {usuario ? (
            <>
              {respondiendoA && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-[#EAF3DE]/70 px-3 py-1.5 text-xs text-[#1B4332]">
                  <span>Respondiendo a <strong>{respondiendoA.nombre}</strong></span>
                  <button type="button" onClick={() => setRespondiendoA(null)} className="font-bold hover:opacity-70">×</button>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={respondiendoA ? `Responder a ${respondiendoA.nombre}...` : 'Añade un comentario...'}
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
            </>
          ) : (
            <div className="text-center text-sm text-gray-600 py-1">
              <a href="/ingresar" className="font-semibold text-[#1B4332] hover:underline">Inicia sesión</a> para comentar.
            </div>
          )}
        </div>
      </div>
  )

  if (inline) return contenidoInner

  return (
    <div
      className="fixed inset-0 z-[110] flex flex-col justify-end bg-black/60 sm:items-center sm:justify-center"
      onClick={onClose}
    >
      {contenidoInner}
    </div>
  )
}
