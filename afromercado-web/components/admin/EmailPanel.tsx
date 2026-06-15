'use client'

import { useEffect, useState } from 'react'
import {
  obtenerEstadoEmail,
  actualizarConfigEmail,
  guardarConfigSmtp,
  enviarEmailTest,
  type EstadoEmail,
  type InputSmtp,
} from './api'

const PRESETS: Array<{ label: string; host: string; port: number; secure: boolean }> = [
  { label: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false },
  { label: 'Outlook', host: 'smtp.office365.com', port: 587, secure: false },
  { label: 'Hostinger', host: 'smtp.hostinger.com', port: 587, secure: false },
  { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 587, secure: false },
]

type Aviso = { tipo: 'exito' | 'error'; texto: string }

export default function EmailPanel() {
  const [estado, setEstado] = useState<EstadoEmail | null>(null)
  const [cargando, setCargando] = useState(true)

  // Formulario SMTP
  const [editandoSmtp, setEditandoSmtp] = useState(false)
  const [smtp, setSmtp] = useState<InputSmtp>({ host: '', port: 587, user: '', pass: '', secure: false })
  const [guardandoSmtp, setGuardandoSmtp] = useState(false)

  // Email del administrador
  const [editandoAdmin, setEditandoAdmin] = useState(false)
  const [emailAdmin, setEmailAdmin] = useState('')
  const [guardandoAdmin, setGuardandoAdmin] = useState(false)

  const [enviandoTest, setEnviandoTest] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)

  function mostrarAviso(tipo: Aviso['tipo'], texto: string) {
    setAviso({ tipo, texto })
    setTimeout(() => setAviso(null), 5000)
  }

  async function cargar() {
    try {
      const data = await obtenerEstadoEmail()
      setEstado(data)
      setEmailAdmin(data.adminEmail ?? '')
      setSmtp({
        host: data.smtp.host ?? '',
        port: data.smtp.port ?? 587,
        user: data.smtp.user ?? '',
        pass: '',
        secure: data.smtp.secure ?? false,
      })
    } catch {
      mostrarAviso('error', 'No se pudo cargar la configuración de email')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { void cargar() }, [])

  function aplicarPreset(preset: (typeof PRESETS)[number]) {
    setSmtp(s => ({ ...s, host: preset.host, port: preset.port, secure: preset.secure }))
  }

  async function handleGuardarSmtp() {
    if (!smtp.host.trim() || !smtp.user.trim()) return
    setGuardandoSmtp(true)
    try {
      await guardarConfigSmtp(smtp)
      await cargar()
      setEditandoSmtp(false)
      mostrarAviso('exito', 'Configuración SMTP guardada')
    } catch (err) {
      mostrarAviso('error', err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardandoSmtp(false)
    }
  }

  async function handleGuardarAdmin() {
    if (!emailAdmin.trim()) return
    setGuardandoAdmin(true)
    try {
      await actualizarConfigEmail(emailAdmin.trim())
      await cargar()
      setEditandoAdmin(false)
      mostrarAviso('exito', 'Email de administrador actualizado')
    } catch (err) {
      mostrarAviso('error', err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setGuardandoAdmin(false)
    }
  }

  async function handleTest() {
    setEnviandoTest(true)
    try {
      const msg = await enviarEmailTest()
      mostrarAviso('exito', msg)
    } catch (err) {
      mostrarAviso('error', err instanceof Error ? err.message : 'Error al enviar email de prueba')
    } finally {
      setEnviandoTest(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-[#1A1A1A]/8 p-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-[#1A1A1A]">Email</h3>
          <p className="text-sm text-[#1A1A1A]/55 mt-0.5">Notificaciones automáticas vía SMTP</p>
        </div>
        {!cargando && estado && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
            estado.configurado
              ? 'bg-[#52B788]/15 text-[#2D6A4F]'
              : 'bg-[#C0392B]/10 text-[#C0392B]'
          }`}>
            <span className={`w-2 h-2 rounded-full ${estado.configurado ? 'bg-[#2D6A4F]' : 'bg-[#C0392B]'}`} />
            {estado.configurado ? 'Configurado' : 'Sin configurar'}
          </span>
        )}
      </div>

      {/* Aviso */}
      {aviso && (
        <div className={`mb-4 p-3 rounded-xl text-sm font-medium ${
          aviso.tipo === 'exito'
            ? 'bg-[#52B788]/10 text-[#2D6A4F] border border-[#52B788]/30'
            : 'bg-[#C0392B]/8 text-[#C0392B] border border-[#C0392B]/20'
        }`}>
          {aviso.texto}
        </div>
      )}

      {cargando ? (
        <div className="space-y-3">
          <div className="h-4 bg-[#1A1A1A]/8 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-[#1A1A1A]/8 rounded animate-pulse w-1/2" />
          <div className="h-4 bg-[#1A1A1A]/8 rounded animate-pulse w-2/3" />
        </div>
      ) : estado ? (
        <div className="space-y-4">

          {/* ── Sección SMTP ── */}
          <div className="rounded-xl border border-[#1A1A1A]/8 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#F8F5F0]">
              <span className="text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wide">
                Servidor SMTP
              </span>
              {!editandoSmtp && (
                <button
                  type="button"
                  onClick={() => setEditandoSmtp(true)}
                  className="text-xs text-[#2D6A4F] font-semibold hover:underline"
                >
                  {estado.smtp.host ? 'Editar' : 'Configurar'}
                </button>
              )}
            </div>

            {editandoSmtp ? (
              <div className="p-4 space-y-3">
                {/* Presets */}
                <div>
                  <p className="text-xs text-[#1A1A1A]/50 mb-2">Proveedor</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => aplicarPreset(p)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          smtp.host === p.host
                            ? 'bg-[#2D6A4F] text-white border-[#2D6A4F]'
                            : 'border-[#1A1A1A]/15 text-[#1A1A1A]/70 hover:border-[#2D6A4F]/40'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSmtp(s => ({ ...s, host: '', port: 587, secure: false }))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#1A1A1A]/15 text-[#1A1A1A]/70 hover:border-[#2D6A4F]/40 transition-colors"
                    >
                      Otro
                    </button>
                  </div>
                </div>

                {/* Host + Puerto */}
                <div className="grid grid-cols-[1fr_100px] gap-2">
                  <div>
                    <label className="text-xs text-[#1A1A1A]/50 mb-1 block">Servidor</label>
                    <input
                      type="text"
                      value={smtp.host}
                      onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))}
                      placeholder="smtp.gmail.com"
                      className="w-full h-9 px-3 text-sm border border-[#1A1A1A]/15 rounded-lg focus:outline-none focus:border-[#2D6A4F]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#1A1A1A]/50 mb-1 block">Puerto</label>
                    <input
                      type="number"
                      value={smtp.port}
                      onChange={e => setSmtp(s => ({ ...s, port: parseInt(e.target.value) || 587 }))}
                      className="w-full h-9 px-3 text-sm border border-[#1A1A1A]/15 rounded-lg focus:outline-none focus:border-[#2D6A4F]"
                    />
                  </div>
                </div>

                {/* Usuario */}
                <div>
                  <label className="text-xs text-[#1A1A1A]/50 mb-1 block">Usuario (email)</label>
                  <input
                    type="email"
                    value={smtp.user}
                    onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))}
                    placeholder="tu@gmail.com"
                    className="w-full h-9 px-3 text-sm border border-[#1A1A1A]/15 rounded-lg focus:outline-none focus:border-[#2D6A4F]"
                  />
                </div>

                {/* Contraseña */}
                <div>
                  <label className="text-xs text-[#1A1A1A]/50 mb-1 block">
                    Contraseña {estado.smtp.tienePassword && <span className="text-[#2D6A4F]">(dejar vacío para no cambiar)</span>}
                  </label>
                  <input
                    type="password"
                    value={smtp.pass}
                    onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))}
                    placeholder={estado.smtp.tienePassword ? '••••••••' : 'Contraseña o App Password'}
                    className="w-full h-9 px-3 text-sm border border-[#1A1A1A]/15 rounded-lg focus:outline-none focus:border-[#2D6A4F]"
                  />
                </div>

                {/* TLS */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    role="checkbox"
                    aria-checked={smtp.secure}
                    onClick={() => setSmtp(s => ({ ...s, secure: !s.secure }))}
                    className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 cursor-pointer ${
                      smtp.secure ? 'bg-[#2D6A4F]' : 'bg-[#1A1A1A]/20'
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ${
                      smtp.secure ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`} />
                  </div>
                  <span className="text-sm text-[#1A1A1A]/80">SSL directo (puerto 465)</span>
                </label>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleGuardarSmtp}
                    disabled={guardandoSmtp || !smtp.host.trim() || !smtp.user.trim()}
                    className="h-9 px-4 bg-[#2D6A4F] text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:bg-[#245a42] transition-colors"
                  >
                    {guardandoSmtp ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoSmtp(false)}
                    className="h-9 px-3 text-sm text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 space-y-2">
                {estado.smtp.host ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <span className="text-[#1A1A1A]/50">Servidor</span>
                    <span className="text-[#1A1A1A] font-medium">{estado.smtp.host}</span>
                    <span className="text-[#1A1A1A]/50">Puerto</span>
                    <span className="text-[#1A1A1A]">{estado.smtp.port}</span>
                    <span className="text-[#1A1A1A]/50">Usuario</span>
                    <span className="text-[#1A1A1A] truncate">{estado.smtp.user}</span>
                    <span className="text-[#1A1A1A]/50">Contraseña</span>
                    <span className="text-[#1A1A1A]">
                      {estado.smtp.tienePassword ? '••••••••' : <span className="text-[#C0392B] text-xs">No configurada</span>}
                    </span>
                    <span className="text-[#1A1A1A]/50">Seguridad</span>
                    <span className="text-[#1A1A1A]">{estado.smtp.secure ? 'SSL/TLS' : 'STARTTLS'}</span>
                  </div>
                ) : (
                  <p className="text-sm text-[#1A1A1A]/40 italic py-1">No configurado. Haz clic en "Configurar" para agregar los datos SMTP.</p>
                )}
              </div>
            )}
          </div>

          {/* ── Email del administrador ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wide">
                Email del administrador
              </label>
              {!editandoAdmin && (
                <button
                  type="button"
                  onClick={() => { setEditandoAdmin(true); setEmailAdmin(estado.adminEmail ?? '') }}
                  className="text-xs text-[#2D6A4F] font-semibold hover:underline"
                >
                  Editar
                </button>
              )}
            </div>

            {editandoAdmin ? (
              <div className="flex gap-2">
                <input
                  type="email"
                  value={emailAdmin}
                  onChange={e => setEmailAdmin(e.target.value)}
                  placeholder="admin@ejemplo.com"
                  className="flex-1 h-9 px-3 text-sm border border-[#1A1A1A]/15 rounded-xl focus:outline-none focus:border-[#2D6A4F]"
                />
                <button
                  type="button"
                  onClick={handleGuardarAdmin}
                  disabled={guardandoAdmin || !emailAdmin.trim()}
                  className="h-9 px-4 bg-[#2D6A4F] text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:bg-[#245a42] transition-colors"
                >
                  {guardandoAdmin ? '…' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditandoAdmin(false)}
                  className="h-9 px-3 text-sm text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-[#F8F5F0] rounded-xl text-sm">
                {estado.adminEmail
                  ? <span className="text-[#1A1A1A]">{estado.adminEmail}</span>
                  : <span className="text-[#1A1A1A]/40 italic">No configurado</span>
                }
              </div>
            )}
            <p className="text-xs text-[#1A1A1A]/40 mt-1">
              Recibe notificaciones de comprobantes de pago.
            </p>
          </div>

          {/* ── Botón test ── */}
          {estado.configurado && estado.adminEmail && (
            <button
              type="button"
              onClick={handleTest}
              disabled={enviandoTest}
              className="w-full h-10 border border-[#2D6A4F] text-[#2D6A4F] text-sm font-semibold rounded-xl hover:bg-[#2D6A4F]/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              {enviandoTest ? 'Enviando…' : 'Enviar email de prueba'}
            </button>
          )}

        </div>
      ) : null}
    </div>
  )
}
