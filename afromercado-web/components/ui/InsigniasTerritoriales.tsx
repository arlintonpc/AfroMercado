'use client'

import React from 'react'

export interface InsigniasProps {
  verificado?: boolean
  lideradoPorMujeres?: boolean
  agroEcologico?: boolean
  origenChoco?: boolean
  puntosTotal?: number
  tamaño?: 'sm' | 'md' | 'lg'
  className?: string
}

export function InsigniaVerificado({ tamaño = 'md' }: { tamaño?: 'sm' | 'md' | 'lg' }) {
  const iconSize = tamaño === 'sm' ? 14 : tamaño === 'md' ? 18 : 22
  return (
    <span
      title="Comercio Certificado AfroMercado"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-[#1B4332] font-bold text-xs border border-emerald-300 shadow-sm"
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#2D6A4F" stroke="#1B4332" />
        <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Verificado</span>
    </span>
  )
}

export function InsigniaMujeres({ tamaño = 'md' }: { tamaño?: 'sm' | 'md' | 'lg' }) {
  const iconSize = tamaño === 'sm' ? 14 : tamaño === 'md' ? 18 : 22
  return (
    <span
      title="Empresa Liderada por Mujeres Afrocolombianas"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 text-purple-900 font-bold text-xs border border-purple-300 shadow-sm"
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#8B5CF6" stroke="#6D28D9" />
      </svg>
      <span>Liderado por Mujeres</span>
    </span>
  )
}

export function InsigniaAgroEcologico({ tamaño = 'md' }: { tamaño?: 'sm' | 'md' | 'lg' }) {
  const iconSize = tamaño === 'sm' ? 14 : tamaño === 'md' ? 18 : 22
  return (
    <span
      title="Producción Agro-Ecológica y Sostenible"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-100 text-teal-900 font-bold text-xs border border-teal-300 shadow-sm"
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" fill="#14B8A6" stroke="#0D9488" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" stroke="#0D9488" strokeLinecap="round" />
      </svg>
      <span>Eco-Sostenible</span>
    </span>
  )
}

export function InsigniaOrigenChoco({ tamaño = 'md' }: { tamaño?: 'sm' | 'md' | 'lg' }) {
  const iconSize = tamaño === 'sm' ? 14 : tamaño === 'md' ? 18 : 22
  return (
    <span
      title="Origen 100% Auténtico del Chocó"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-950 font-bold text-xs border border-amber-300 shadow-sm"
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" fill="#F59E0B" stroke="#D97706" />
        <path d="M12 6v6l4 2" stroke="white" strokeLinecap="round" />
      </svg>
      <span>Origen Chocó</span>
    </span>
  )
}

export default function InsigniasTerritoriales({
  verificado = false,
  lideradoPorMujeres = false,
  agroEcologico = false,
  origenChoco = false,
  puntosTotal = 0,
  tamaño = 'md',
  className = '',
}: InsigniasProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {verificado && <InsigniaVerificado tamaño={tamaño} />}
      {lideradoPorMujeres && <InsigniaMujeres tamaño={tamaño} />}
      {agroEcologico && <InsigniaAgroEcologico tamaño={tamaño} />}
      {origenChoco && <InsigniaOrigenChoco tamaño={tamaño} />}

      {puntosTotal > 0 && (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-900 font-extrabold text-xs border border-amber-400/40">
          ⭐ {puntosTotal} pts
        </span>
      )}
    </div>
  )
}
