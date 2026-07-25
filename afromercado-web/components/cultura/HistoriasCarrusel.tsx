'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { listarHistorias, type GrupoHistoria } from '@/lib/api/cultura'
import { normalizarUrlMedia } from '@/lib/api/client'
import ModalCrearHistoria from './ModalCrearHistoria'
import VisorHistoriasModal from './VisorHistoriasModal'

export default function HistoriasCarrusel() {
  const { usuario } = useAuth()
  const [grupos, setGrupos] = useState<GrupoHistoria[]>([])
  const [cargando, setCargando] = useState(true)
  const [modalCrearAbierto, setModalCrearAbierto] = useState(false)
  const [grupoVisorIndex, setGrupoVisorIndex] = useState<number | null>(null)

  function cargarHistorias() {
    setCargando(true)
    listarHistorias()
      .then(setGrupos)
      .catch(() => setGrupos([]))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    cargarHistorias()
  }, [])

  const avatarUsuario = normalizarUrlMedia(usuario?.avatarUrl)

  return (
    <>
      <section aria-label="Historias" className="rounded-3xl bg-white border border-[#1A1A1A]/6 p-3 sm:p-4 shadow-sm">
        <div className="flex gap-3 overflow-x-auto px-1 pb-1 scrollbar-none select-none">
          {usuario?.rol === 'COMERCIANTE' && (
            <button
              type="button"
              onClick={() => setModalCrearAbierto(true)}
              className="group relative h-44 w-28 flex-shrink-0 overflow-hidden rounded-2xl border border-[#D4A017]/30 bg-[#F8F5F0] text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-[#D4A017]/10"
            >
              <div className="h-[124px] overflow-hidden bg-[#1B4332] relative">
                {avatarUsuario ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatarUsuario} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                ) : <div className="h-full w-full bg-gradient-to-br from-[#2D6A4F] to-[#1B4332]" />}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
              </div>
              <span className="absolute left-1/2 top-[104px] grid h-9 w-9 -translate-x-1/2 place-items-center rounded-full border-[3px] border-white bg-gradient-to-tr from-[#2D6A4F] via-[#D4A017] to-[#F4C842] text-xl font-bold text-white shadow-md transition-transform duration-300 group-hover:scale-110">+</span>
              <span className="block px-2 pt-3.5 text-center text-[11px] font-bold leading-tight text-[#1A1A1A]">Crear historia</span>
            </button>
          )}

          {cargando
            ? Array.from({ length: 5 }).map((_, indice) => <div key={indice} className="h-44 w-28 flex-shrink-0 animate-pulse rounded-2xl bg-[#1B4332]/10" />)
            : grupos.map((grupo, indice) => {
                const portada = grupo.historias[0]
                const avatar = normalizarUrlMedia(grupo.avatarUrl)
                return (
                  <button
                    key={grupo.id}
                    type="button"
                    onClick={() => setGrupoVisorIndex(indice)}
                    className="group relative h-44 w-28 flex-shrink-0 overflow-hidden rounded-2xl bg-[#1B4332] text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#2D6A4F]/20"
                    aria-label={`Ver historias de ${grupo.nombre}`}
                  >
                    {portada?.mediaTipo === 'VIDEO' ? (
                      <video src={portada.mediaUrl} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110" muted playsInline />
                    ) : portada ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={portada.mediaUrl} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/30" />
                    <div className={`absolute left-2.5 top-2.5 h-10 w-10 rounded-full p-[2.5px] transition-transform duration-300 group-hover:scale-105 ${grupo.vistasTodas ? 'bg-white/50' : 'bg-gradient-to-tr from-[#2D6A4F] via-[#D4A017] to-[#F4C842] shadow-md'}`}>
                      <div className="h-full w-full overflow-hidden rounded-full border-2 border-white bg-[#1B4332]">
                        {avatar ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={avatar} alt="" className="h-full w-full object-cover" />
                        ) : <span className="grid h-full w-full place-items-center text-xs font-black text-white">{grupo.nombre.charAt(0)}</span>}
                      </div>
                    </div>
                    <span className="absolute inset-x-2.5 bottom-2.5 line-clamp-2 text-[11px] font-bold leading-tight text-white drop-shadow-md">{grupo.nombre}</span>
                  </button>
                )
              })}
        </div>
      </section>

      <ModalCrearHistoria isOpen={modalCrearAbierto} onClose={() => setModalCrearAbierto(false)} onHistoriaCreada={cargarHistorias} />
      {grupoVisorIndex !== null && <VisorHistoriasModal grupos={grupos} grupoInicialIndex={grupoVisorIndex} onClose={() => setGrupoVisorIndex(null)} onHistoriasActualizadas={cargarHistorias} />}
    </>
  )
}
