'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import { useAuth } from '@/context/AuthContext'
import { useNotificaciones } from '@/context/NotificacionContext'
import {
  listarConversaciones,
  obtenerMensajes,
  enviarMensaje,
  type ConversacionChat,
  type MensajeChat,
} from '@/lib/api/chat'

function fechaRelativa(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `${mins} min`
  const horas = Math.floor(mins / 60)
  if (horas < 24) return `${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'Ayer'
  if (dias < 7) return `${dias} días`
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

function horaCorta(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function PaginaChatInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { usuario, autenticado, cargando: cargandoAuth } = useAuth()
  const { notificaciones } = useNotificaciones()

  const [conversaciones, setConversaciones] = useState<ConversacionChat[]>([])
  const [activa, setActiva] = useState<ConversacionChat | null>(null)
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [cargandoMsgs, setCargandoMsgs] = useState(false)
  const [vistaMovil, setVistaMovil] = useState<'lista' | 'chat'>('lista')

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const cargarConversaciones = useCallback(async () => {
    try {
      const data = await listarConversaciones()
      setConversaciones(data)
    } catch { /* silencioso */ }
  }, [])

  const cargarMensajes = useCallback(async (convId: number) => {
    setCargandoMsgs(true)
    try {
      const data = await obtenerMensajes(convId)
      setMensajes(data)
    } catch { /* silencioso */ }
    finally { setCargandoMsgs(false) }
  }, [])

  useEffect(() => {
    if (!cargandoAuth && !autenticado) {
      router.replace('/ingresar')
    }
  }, [autenticado, cargandoAuth, router])

  useEffect(() => {
    if (!autenticado) return
    cargarConversaciones()
  }, [autenticado, cargarConversaciones])

  // Abrir conversación desde query param ?c=
  useEffect(() => {
    const cId = params.get('c')
    if (!cId || conversaciones.length === 0) return
    const conv = conversaciones.find((c) => c.id === Number(cId))
    if (conv && (!activa || activa.id !== conv.id)) {
      seleccionarConversacion(conv)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, conversaciones])

  // SSE: escuchar mensajes nuevos
  useEffect(() => {
    const nuevas = notificaciones.filter((n) => n.tipo === 'MENSAJE_NUEVO')
    if (nuevas.length === 0) return
    const ultima = nuevas[0]
    const datos = ultima.datos as { conversacionId?: number } | null
    if (!datos?.conversacionId) return

    cargarConversaciones()

    if (activa && datos.conversacionId === activa.id) {
      cargarMensajes(activa.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificaciones])

  // Polling cada 5s cuando hay conversación activa
  useEffect(() => {
    if (!activa) return
    const intervalo = setInterval(() => {
      cargarMensajes(activa.id)
    }, 5000)
    return () => clearInterval(intervalo)
  }, [activa, cargarMensajes])

  // Scroll al fondo al recibir nuevos mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  function seleccionarConversacion(conv: ConversacionChat) {
    setActiva(conv)
    setMensajes([])
    cargarMensajes(conv.id)
    setVistaMovil('chat')
    inputRef.current?.focus()
  }

  async function handleEnviar() {
    if (!activa || !texto.trim() || enviando) return
    const contenido = texto.trim()
    setTexto('')
    setEnviando(true)
    try {
      const nuevo = await enviarMensaje(activa.id, contenido)
      setMensajes((prev) => [...prev, nuevo])
      await cargarConversaciones()
    } catch { /* silencioso */ }
    finally { setEnviando(false) }
  }

  function nombreOtro(conv: ConversacionChat): string {
    if (!usuario) return ''
    return usuario.rol === 'COMERCIANTE' ? conv.comprador.nombre : conv.comercio.nombre
  }

  if (cargandoAuth) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  if (!autenticado) return null

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F0]">
      <Header />

      <main className="flex-1 w-full max-w-5xl mx-auto px-0 md:px-6 py-0 md:py-6 flex" style={{ height: 'calc(100vh - 64px)' }}>
        <div className="flex w-full h-full bg-white md:rounded-2xl md:border md:border-[#1A1A1A]/8 md:shadow-sm overflow-hidden">

          {/* Lista de conversaciones */}
          <aside className={`w-full md:w-72 flex-shrink-0 border-r border-[#1A1A1A]/8 flex flex-col ${vistaMovil === 'chat' ? 'hidden md:flex' : 'flex'}`}>
            <div className="px-4 py-4 border-b border-[#1A1A1A]/8">
              <h1 className="text-base font-semibold text-[#1A1A1A]">Mensajes</h1>
            </div>

            <div className="flex-1 overflow-y-auto">
              {conversaciones.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-2">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1.2" strokeOpacity="0.2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <p className="text-sm text-[#1A1A1A]/40">No tienes conversaciones aún</p>
                </div>
              ) : (
                conversaciones.map((conv) => {
                  const esActiva = activa?.id === conv.id
                  const ultimoMsg = conv.mensajes[0]
                  const noLeidos = conv._count.mensajes
                  const otro = nombreOtro(conv)

                  return (
                    <button
                      key={conv.id}
                      onClick={() => seleccionarConversacion(conv)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 border-b border-[#1A1A1A]/5 transition-colors ${esActiva ? 'bg-[#2D6A4F]/8' : 'hover:bg-[#F8F5F0]'}`}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#52B788]/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-[#2D6A4F] uppercase">
                          {otro.charAt(0)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-sm truncate ${noLeidos > 0 ? 'font-semibold text-[#1A1A1A]' : 'font-medium text-[#1A1A1A]/80'}`}>
                            {otro}
                          </span>
                          <span className="text-xs text-[#1A1A1A]/40 flex-shrink-0">
                            {ultimoMsg ? fechaRelativa(ultimoMsg.createdAt) : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 mt-0.5">
                          <p className="text-xs text-[#1A1A1A]/50 truncate">
                            {ultimoMsg ? ultimoMsg.contenido : 'Sin mensajes'}
                          </p>
                          {noLeidos > 0 && (
                            <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-[#2D6A4F] text-white text-[10px] font-bold flex items-center justify-center px-1">
                              {noLeidos > 99 ? '99+' : noLeidos}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </aside>

          {/* Área de mensajes */}
          <section className={`flex-1 flex flex-col min-w-0 ${vistaMovil === 'lista' ? 'hidden md:flex' : 'flex'}`}>
            {!activa ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="1" strokeOpacity="0.15">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <p className="text-sm text-[#1A1A1A]/40">Selecciona una conversación para comenzar</p>
              </div>
            ) : (
              <>
                {/* Cabecera del chat */}
                <div className="px-4 py-3 border-b border-[#1A1A1A]/8 flex items-center gap-3">
                  <button
                    onClick={() => setVistaMovil('lista')}
                    className="md:hidden p-1 -ml-1 rounded-lg text-[#1A1A1A]/50 hover:text-[#1A1A1A]"
                    aria-label="Volver"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div className="w-8 h-8 rounded-full bg-[#52B788]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-[#2D6A4F] uppercase">
                      {nombreOtro(activa).charAt(0)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-[#1A1A1A]">{nombreOtro(activa)}</span>
                </div>

                {/* Burbuja de mensajes */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
                  {cargandoMsgs && mensajes.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="w-6 h-6 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : mensajes.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-[#1A1A1A]/40">Sé el primero en escribir</p>
                    </div>
                  ) : (
                    mensajes.map((m) => {
                      const esMio = m.autorId === Number(usuario?.id)
                      return (
                        <div key={m.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[75%] px-3 py-2 text-sm leading-relaxed shadow-sm ${esMio
                            ? 'bg-[#2D6A4F] text-white rounded-2xl rounded-br-sm'
                            : 'bg-white text-[#1A1A1A] rounded-2xl rounded-bl-sm border border-[#1A1A1A]/8'
                          }`}>
                            <p>{m.contenido}</p>
                            <p className={`text-[10px] mt-0.5 text-right ${esMio ? 'text-white/60' : 'text-[#1A1A1A]/35'}`}>
                              {horaCorta(m.createdAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input de envío */}
                <div className="px-4 py-3 border-t border-[#1A1A1A]/8 flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEnviar() } }}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 h-10 px-4 rounded-xl border border-[#1A1A1A]/15 bg-white focus:outline-none focus:ring-2 focus:ring-[#2D6A4F]/30 text-sm"
                  />
                  <button
                    onClick={handleEnviar}
                    disabled={enviando || !texto.trim()}
                    className="bg-[#2D6A4F] hover:bg-[#245a42] text-white rounded-xl px-4 h-10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    {enviando ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    )}
                    <span className="text-sm font-medium hidden sm:inline">Enviar</span>
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default function PaginaChat() {
  return (
    <Suspense>
      <PaginaChatInner />
    </Suspense>
  )
}
