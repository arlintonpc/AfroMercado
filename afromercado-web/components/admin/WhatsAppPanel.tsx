'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { obtenerEstadoWhatsApp, conectarWhatsApp, type EstadoWhatsApp } from './api'

export default function WhatsAppPanel() {
  const [estado, setEstado] = useState<EstadoWhatsApp>({ estado: 'DESCONECTADO' })
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const cargarEstado = useCallback(async () => {
    try {
      const s = await obtenerEstadoWhatsApp()
      setEstado(s)
      return s
    } catch {
      return null
    }
  }, [])

  const detenerPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  const iniciarPolling = useCallback(() => {
    detenerPolling()
    pollingRef.current = setInterval(async () => {
      const s = await cargarEstado()
      if (s?.estado === 'CONECTADO') {
        detenerPolling()
      }
    }, 3000)
  }, [cargarEstado, detenerPolling])

  // Polling arranca siempre al montar — detecta QR aunque el backend
  // ya lo haya generado automáticamente al iniciar el servidor.
  useEffect(() => {
    cargarEstado().then((s) => {
      // Si ya está en proceso o conectado, arrancar polling inmediatamente
      if (s?.estado !== 'CONECTADO') {
        iniciarPolling()
      }
    })
    return () => detenerPolling()
  }, [cargarEstado, detenerPolling, iniciarPolling])

  async function handleConectar() {
    setError(null)
    setCargando(true)
    try {
      await conectarWhatsApp()
      await cargarEstado()
      iniciarPolling()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo conectar')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-[#1A1A1A]">WhatsApp</h3>
          <p className="text-sm text-[#1A1A1A]/55 mt-0.5">
            Notificaciones automáticas a comerciantes y compradores
          </p>
        </div>

        {/* Badge de estado */}
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
          estado.estado === 'CONECTADO'
            ? 'bg-[#52B788]/15 text-[#2D6A4F]'
            : estado.estado === 'ESCANEANDO_QR'
            ? 'bg-[#D4A017]/15 text-[#9B7300]'
            : 'bg-[#1A1A1A]/8 text-[#1A1A1A]/50'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            estado.estado === 'CONECTADO' ? 'bg-[#2D6A4F]' :
            estado.estado === 'ESCANEANDO_QR' ? 'bg-[#D4A017] animate-pulse' :
            'bg-[#1A1A1A]/30'
          }`} />
          {estado.estado === 'CONECTADO' ? 'Conectado' :
           estado.estado === 'ESCANEANDO_QR' ? 'Esperando escaneo' :
           'Desconectado'}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* QR */}
      {estado.estado === 'ESCANEANDO_QR' && estado.qrDataUrl && (
        <div className="mb-4 p-4 bg-[#F8F5F0] rounded-xl flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={estado.qrDataUrl}
            alt="Código QR de WhatsApp"
            className="w-48 h-48 rounded-xl"
          />
          <div className="text-sm text-[#1A1A1A]/70 text-center space-y-1">
            <p className="font-medium">Escanea este código con tu WhatsApp</p>
            <p className="text-xs text-[#1A1A1A]/50">
              Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo
            </p>
          </div>
        </div>
      )}

      {/* Conectado */}
      {estado.estado === 'CONECTADO' && (
        <div className="p-4 bg-[#52B788]/8 rounded-xl flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#52B788]/20 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-[#2D6A4F]">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#2D6A4F]">WhatsApp activo</p>
            <p className="text-xs text-[#1A1A1A]/55">
              Las notificaciones se envían automáticamente
            </p>
          </div>
        </div>
      )}

      {/* Desconectado */}
      {estado.estado === 'DESCONECTADO' && (
        <div className="p-4 bg-[#F8F5F0] rounded-xl text-sm text-[#1A1A1A]/60 mb-4">
          WhatsApp no está conectado. Conecta un número para enviar notificaciones automáticas a comerciantes y compradores.
        </div>
      )}

      {/* Botón conectar */}
      {estado.estado !== 'CONECTADO' && (
        <button
          onClick={handleConectar}
          disabled={cargando || estado.estado === 'ESCANEANDO_QR'}
          className="mt-4 w-full h-10 bg-[#25D366] hover:bg-[#1ebe5a] text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {cargando ? (
            'Iniciando…'
          ) : estado.estado === 'ESCANEANDO_QR' ? (
            'Esperando escaneo del QR…'
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Conectar WhatsApp
            </>
          )}
        </button>
      )}
    </div>
  )
}
