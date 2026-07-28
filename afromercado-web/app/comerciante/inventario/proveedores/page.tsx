'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { crearProveedor, listarProveedores, type ProveedorInventario } from '../api'

export default function ProveedoresInventarioPage() {
  const [proveedores, setProveedores] = useState<ProveedorInventario[]>([])
  const [nombre, setNombre] = useState('')
  const [nit, setNit] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    setCargando(true); setError(null)
    try { setProveedores(await listarProveedores()) }
    catch (causa) { setError(causa instanceof Error ? causa.message : 'No se pudieron cargar los proveedores.') }
    finally { setCargando(false) }
  }
  useEffect(() => { void cargar() }, [])

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    if (!nombre.trim()) return setError('El nombre del proveedor es obligatorio.')
    setGuardando(true); setError(null)
    try {
      const creado = await crearProveedor({ nombre: nombre.trim(), nit: nit.trim() || null, telefono: telefono.trim() || null, email: email.trim() || null })
      setProveedores((actuales) => [...actuales, creado].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-CO')))
      setNombre(''); setNit(''); setTelefono(''); setEmail('')
    } catch (causa) { setError(causa instanceof Error ? causa.message : 'No se pudo crear el proveedor.') }
    finally { setGuardando(false) }
  }

  return <div className="mx-auto max-w-4xl space-y-6 pb-8">
    <div><Link href="/comerciante/inventario" className="text-xs text-[#1A1A1A]/45 hover:text-[#2D6A4F]">← Inventario</Link><h1 className="mt-1 text-3xl text-[#1A1A1A]" style={{ fontFamily: 'var(--font-dm-serif), Georgia, serif' }}>Proveedores</h1><p className="mt-1 text-sm text-[#1A1A1A]/55">Organiza a quién compras insumos y mercancía para tu comercio.</p></div>
    <form onSubmit={guardar} className="rounded-2xl border border-[#1A1A1A]/8 bg-white p-5 shadow-sm"><h2 className="font-semibold text-[#1A1A1A]">Nuevo proveedor</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium text-[#1A1A1A]/70">Nombre<input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full rounded-xl border border-[#1A1A1A]/15 px-3 py-2.5 outline-none focus:border-[#2D6A4F]" /></label><label className="text-sm font-medium text-[#1A1A1A]/70">NIT o documento<input value={nit} onChange={(e) => setNit(e.target.value)} className="mt-1 w-full rounded-xl border border-[#1A1A1A]/15 px-3 py-2.5 outline-none focus:border-[#2D6A4F]" /></label><label className="text-sm font-medium text-[#1A1A1A]/70">Teléfono<input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="mt-1 w-full rounded-xl border border-[#1A1A1A]/15 px-3 py-2.5 outline-none focus:border-[#2D6A4F]" /></label><label className="text-sm font-medium text-[#1A1A1A]/70">Correo<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-[#1A1A1A]/15 px-3 py-2.5 outline-none focus:border-[#2D6A4F]" /></label></div>{error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}<div className="mt-4 flex justify-end"><Button type="submit" loading={guardando}>Guardar proveedor</Button></div></form>
    <section className="overflow-hidden rounded-2xl border border-[#1A1A1A]/8 bg-white shadow-sm"><div className="border-b border-[#1A1A1A]/6 px-5 py-4"><h2 className="font-semibold text-[#1A1A1A]">Proveedores registrados</h2></div>{cargando ? <p className="px-5 py-10 text-sm text-[#1A1A1A]/45">Cargando proveedores…</p> : proveedores.length ? <div className="divide-y divide-[#1A1A1A]/6">{proveedores.map((proveedor) => <div key={proveedor.id} className="px-5 py-4"><p className="font-semibold text-[#1A1A1A]">{proveedor.nombre}</p><p className="mt-1 text-sm text-[#1A1A1A]/50">{[proveedor.nit, proveedor.telefono, proveedor.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p></div>)}</div> : <p className="px-5 py-10 text-center text-sm text-[#1A1A1A]/45">Aún no tienes proveedores registrados.</p>}</section>
  </div>
}
