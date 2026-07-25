'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { listarHistorias, type GrupoHistoria } from '@/lib/api/cultura'
import { normalizarUrlMedia } from '@/lib/api/client'
import ModalCrearHistoria from './ModalCrearHistoria'
import VisorHistoriasModal from './VisorHistoriasModal'

export default function HistoriasCarrusel() {
  const { usuario, autenticado } = useAuth()

  const [grupos, setGrupos] = useState<GrupoHistoria[]>([])
  const [cargando, setCargando] = useState(true)

  const [modalCrearAbierto, setModalCrearAbierto] = useState(false)
  const [grupoVisorIndex, setGrupoVisorIndex] = useState<number | null>(null)

  useEffect(() => {
    let unmounted = false
    listarHistorias()
      .then((res) => {
        if (!unmounted) setGrupos(res)
      })
      .catch(() => {})
      .finally(() => {
        if (!unmounted) setCargando(false)
      })
    return () => {
      unmounted = true
    }
  }, [])

  function recargarHistorias() {
    setCargando(true)
    listarHistorias()
      .then((res) => setGrupos(res))
      .catch(() => {})
      .finally(() => setCargando(false))
  }

  const avatarUsuario = normalizarUrlMedia(usuario?.avatarUrl)

  return (
    <>
      <div className="w-full flex items-center gap-4 overflow-x-auto py-2 px-1 scrollbar-none select-none">
        {/* 1. Botón "+ Crear Historia" */}
        {autenticado && (
          <button
            type="button"
            onClick={() => setModalCrearAbierto(true)}
            className="group flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
          >
            <div className="relative w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-[#2D6A4F] to-[#D4A017] shadow-md group-hover:scale-105 transition-transform">
              <div className="w-full h-full rounded-full overflow-hidden bg-[#1B4332] flex items-center justify-center border-2 border-white">
                {avatarUsuario ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatarUsuario} alt={usuario?.nombre} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-bold text-lg">{usuario?.nombre?.[0] || 'U'}</span>
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-[#D4A017] text-[#1A1A1A] border-2 border-white flex items-center justify-center font-extrabold text-xs shadow-md">
                +
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#1A1A1A] group-hover:text-[#2D6A4F] transition-colors">
              Crear historia
            </span>
          </button>
        )}

        {/* 2. Círculos de Historias Agrupadas */}
        {cargando
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 flex-shrink-0 animate-pulse">
                <div className="w-16 h-16 rounded-full bg-gray-200" />
                <div className="w-12 h-3 rounded bg-gray-200" />
              </div>
            ))
          : grupos.map((g, idx) => {
              const avatarGrupo = normalizarUrlMedia(g.avatarUrl)
              const yaVisto = g.vistasTodas

              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGrupoVisorIndex(idx)}
                  className="group flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer"
                >
                  <div
                    className={`w-16 h-16 rounded-full p-[2.5px] transition-transform group-hover:scale-105 ${
                      yaVisto
                        ? 'bg-gray-300'
                        : 'bg-gradient-to-tr from-[#2D6A4F] via-[#52B788] to-[#D4A017] shadow-md animate-pulse'
                    }`}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-[#1B4332] flex items-center justify-center border-2 border-white">
                      {avatarGrupo ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={avatarGrupo} alt={g.nombre} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-lg">{g.nombre.charAt(0)}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#1A1A1A] group-hover:text-[#2D6A4F] truncate max-w-[70px]">
                    {g.nombre}
                  </span>
                </button>
              )
            })}
      </div>

      {/* Modal Creador de Historia */}
      <ModalCrearHistoria
        isOpen={modalCrearAbierto}
        onClose={() => setModalCrearAbierto(false)}
        onHistoriaCreada={() => recargarHistorias()}
      />

      {/* Visor Inmersivo de Historias */}
      {grupoVisorIndex !== null && (
        <VisorHistoriasModal
          grupos={grupos}
          grupoInicialIndex={grupoVisorIndex}
          onClose={() => setGrupoVisorIndex(null)}
          onHistoriasActualizadas={() => recargarHistorias()}
        />
      )}
    </>
  )
}
