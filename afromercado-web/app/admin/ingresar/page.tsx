'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'

export default function AdminIngresarPage() {
  const router = useRouter()
  const { login, logout } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function manejarSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const usuario = await login(email.trim(), password)
      if (usuario.rol !== 'ADMIN') {
        // No es admin: cerramos la sesión recién creada y avisamos.
        logout()
        setError('Acceso solo para administradores')
        return
      }
      router.replace('/admin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F8F5F0] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1
            className="text-4xl text-[#2D6A4F] leading-none"
            style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}
          >
            Teravia
          </h1>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#D4A017]">
            Panel de administración
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-8 shadow-sm">
          <h2 className="mb-1 text-xl font-semibold text-[#1A1A1A]">
            Iniciar sesión
          </h2>
          <p className="mb-6 text-sm text-[#1A1A1A]/60">
            Ingresa con tu cuenta de administrador.
          </p>

          <form onSubmit={manejarSubmit} className="flex flex-col gap-5" noValidate>
            <Input
              label="Correo electrónico"
              name="email"
              type="email"
              placeholder="admin@afromercado.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={enviando}
            />
            <Input
              label="Contraseña"
              name="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={enviando}
            />

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-[#C0392B]/30 bg-[#C0392B]/5 px-4 py-3 text-sm font-medium text-[#C0392B]"
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={enviando}
              disabled={!email || !password}
              className="mt-1 w-full"
            >
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[#1A1A1A]/40">
          Área restringida · Teravia © {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}
