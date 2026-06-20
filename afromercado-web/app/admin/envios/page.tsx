'use client'

import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import { Button } from '@/components/ui/Button'
import { formatearPrecio } from '@/lib/formatearPrecio'

// ── Tipos ─────────────────────────────────────────────────────

interface Tarifa {
  id: number
  departamento: string
  pesoMaxKg: number
  precio: number
  activa: boolean
}

type TarifasAgrupadas = Record<string, Tarifa[]>

// ── Página ────────────────────────────────────────────────────

export default function AdminEnviosPage() {
  const [tarifas, setTarifas] = useState<TarifasAgrupadas>({})
  const [cargando, setCargando] = useState(true)
  const [procesandoId, setProcesandoId] = useState<number | null>(null)
  const [aviso, setAviso] = useState<{ tipo: 'exito' | 'error'; texto: string } | null>(null)

  // Formulario
  const [departamento, setDepartamento] = useState('')
  const [pesoMaxKg, setPesoMaxKg] = useState('')
  const [precio, setPrecio] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await apiFetch<{ ok: boolean; data: TarifasAgrupadas }>('/envios/tarifas')
      setTarifas(res.data ?? {})
    } catch {
      /* silencioso */
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 4000)
    return () => clearTimeout(t)
  }, [aviso])

  function validar() {
    const e: Record<string, string> = {}
    if (!departamento.trim()) e.departamento = 'Escribe el departamento.'
    const p = parseFloat(pesoMaxKg)
    if (!pesoMaxKg || isNaN(p) || p <= 0) e.pesoMaxKg = 'Peso máximo inválido.'
    const pr = parseFloat(precio)
    if (!precio || isNaN(pr) || pr < 0) e.precio = 'Precio inválido.'
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return
    setGuardando(true)
    try {
      await apiFetch('/envios/tarifas', {
        method: 'POST',
        body: {
          departamento: departamento.trim(),
          pesoMaxKg: parseFloat(pesoMaxKg),
          precio: parseFloat(precio),
        },
      })
      setAviso({ tipo: 'exito', texto: 'Tarifa guardada.' })
      setDepartamento(''); setPesoMaxKg(''); setPrecio('')
      await cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error al guardar.' })
    } finally {
      setGuardando(false)
    }
  }

  async function handleDesactivar(id: number) {
    setProcesandoId(id)
    try {
      await apiFetch(`/envios/tarifas/${id}/desactivar`, { method: 'PATCH' })
      setAviso({ tipo: 'exito', texto: 'Tarifa desactivada.' })
      await cargar()
    } catch (err) {
      setAviso({ tipo: 'error', texto: err instanceof Error ? err.message : 'Error.' })
    } finally {
      setProcesandoId(null)
    }
  }

  const departamentos = Object.keys(tarifas).sort()

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div>
        <h1 className="text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>
          Tarifas de envío
        </h1>
        <p className="mt-1 text-sm text-[#1A1A1A]/60">
          Define el precio del flete por departamento y peso máximo. Cuando hay varias filas para el mismo departamento, se aplica la de peso inmediatamente superior al del pedido.
        </p>
      </div>

      {/* Aviso */}
      {aviso && (
        <div className={[
          'rounded-xl border px-4 py-3 text-sm font-medium',
          aviso.tipo === 'exito'
            ? 'border-[#52B788]/40 bg-[#52B788]/10 text-[#2D6A4F]'
            : 'border-[#C0392B]/30 bg-[#C0392B]/5 text-[#C0392B]',
        ].join(' ')}>
          {aviso.texto}
        </div>
      )}

      {/* Formulario nueva tarifa */}
      <form
        onSubmit={handleGuardar}
        className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-5 shadow-sm flex flex-col gap-4"
      >
        <h2 className="text-sm font-bold text-[#1A1A1A]">Agregar / actualizar tarifa</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#1A1A1A]/70">Departamento</label>
            <input
              value={departamento}
              onChange={(e) => setDepartamento(e.target.value)}
              placeholder="Ej: Chocó o Nacional"
              className="rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
            />
            {errores.departamento && <p className="text-xs text-[#C0392B]">{errores.departamento}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#1A1A1A]/70">Peso máximo (kg)</label>
            <input
              type="number" min="0.1" step="0.5"
              value={pesoMaxKg}
              onChange={(e) => setPesoMaxKg(e.target.value)}
              placeholder="Ej: 5"
              className="rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
            />
            {errores.pesoMaxKg && <p className="text-xs text-[#C0392B]">{errores.pesoMaxKg}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[#1A1A1A]/70">Precio (COP)</label>
            <input
              type="number" min="0" step="500"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="Ej: 8000"
              className="rounded-lg border border-[#1A1A1A]/15 px-3 py-2 text-sm focus:outline-none focus:border-[#2D6A4F]"
            />
            {errores.precio && <p className="text-xs text-[#C0392B]">{errores.precio}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={guardando} size="sm">
            Guardar tarifa
          </Button>
          <p className="text-xs text-[#1A1A1A]/40">
            Si ya existe una tarifa para ese departamento y peso, se actualiza el precio.
          </p>
        </div>
      </form>

      {/* Lista agrupada */}
      {cargando ? (
        <div className="text-sm text-[#1A1A1A]/50 py-8 text-center">Cargando tarifas…</div>
      ) : departamentos.length === 0 ? (
        <div className="rounded-2xl border border-[#1A1A1A]/5 bg-white p-8 text-center">
          <p className="text-[#1A1A1A]/50 text-sm">
            No hay tarifas configuradas. Agrega la primera arriba.
          </p>
          <p className="mt-2 text-xs text-[#1A1A1A]/35">
            Usa Nacional como departamento para el fallback cuando no hay tarifa específica.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {departamentos.map((dep) => (
            <div key={dep} className="rounded-2xl border border-[#1A1A1A]/5 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-[#1A1A1A]/5 bg-[#F8F5F0]/60">
                <h3 className="text-sm font-bold text-[#1A1A1A]">{dep}</h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-[#1A1A1A]/40 border-b border-[#1A1A1A]/5">
                    <th className="px-5 py-2 font-semibold">Hasta (kg)</th>
                    <th className="px-5 py-2 font-semibold">Precio</th>
                    <th className="px-5 py-2 text-right font-semibold">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {tarifas[dep].map((t) => (
                    <tr key={t.id} className="border-b border-[#1A1A1A]/4 last:border-0 hover:bg-[#F8F5F0]/40">
                      <td className="px-5 py-3 font-mono text-[#1A1A1A]">{t.pesoMaxKg} kg</td>
                      <td className="px-5 py-3 font-semibold text-[#2D6A4F]">{formatearPrecio(t.precio)}</td>
                      <td className="px-5 py-3 text-right">
                        <Button
                          variant="danger"
                          size="sm"
                          loading={procesandoId === t.id}
                          onClick={() => handleDesactivar(t.id)}
                        >
                          Desactivar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
