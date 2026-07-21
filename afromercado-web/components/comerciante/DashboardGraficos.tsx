'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import { formatearPrecio } from '@/lib/formatearPrecio'

interface TendenciaData {
  mes: string
  neto: number
  pedidos: number
}

interface ProductoTop {
  id: number
  nombre: string
  cantidadVendida: number
}

interface DashboardGraficosProps {
  tendenciaMensual: TendenciaData[]
  topProductos: ProductoTop[]
}

interface TooltipPayloadItem {
  value: number
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

// Declarado fuera de DashboardGraficos a propósito: un componente definido
// dentro del render de otro se recrea (identidad nueva) en cada render,
// perdiendo su estado y rompiendo la memoización de recharts.
function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-4 rounded-xl shadow-lg border border-[#1A1A1A]/10">
        <p className="font-semibold text-[#1A1A1A] mb-2">{label}</p>
        <p className="text-sm text-[#2D6A4F] font-medium">
          Ingresos: {formatearPrecio(payload[0].value)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {payload[1].value} {payload[1].value === 1 ? 'pedido' : 'pedidos'}
        </p>
      </div>
    )
  }
  return null
}

export default function DashboardGraficos({ tendenciaMensual, topProductos }: DashboardGraficosProps) {
  // Formatear los meses para el gráfico (ej: "2026-07" -> "Jul")
  const dataFormateada = useMemo(() => {
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    return tendenciaMensual.map(d => {
      const [, month] = d.mes.split('-')
      return {
        ...d,
        nombreMes: meses[parseInt(month) - 1] ?? d.mes
      }
    })
  }, [tendenciaMensual])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      {/* Gráfico de Tendencia de Ingresos */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#1A1A1A]/5">
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-6">Tendencia de Ingresos (6 meses)</h3>
        <div className="h-72 w-full">
          {dataFormateada.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataFormateada} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNeto" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2D6A4F" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2D6A4F" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="nombreMes" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  tickFormatter={(value) => `$${(value / 1000)}k`}
                />
                <YAxis yAxisId="right" orientation="right" hide />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="neto" 
                  stroke="#2D6A4F" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorNeto)" 
                />
                <Area yAxisId="right" type="monotone" dataKey="pedidos" stroke="transparent" fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              Aún no hay suficientes datos históricos.
            </div>
          )}
        </div>
      </div>

      {/* Gráfico de Top Productos por Cantidad */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#1A1A1A]/5">
        <h3 className="text-lg font-bold text-[#1A1A1A] mb-6">Productos Más Vendidos</h3>
        <div className="h-72 w-full">
          {topProductos.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductos} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                <XAxis type="number" axisLine={false} tickLine={false} hide />
                <YAxis 
                  dataKey="nombre" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  width={120}
                  tick={{ fill: '#4B5563', fontSize: 12 }}
                  tickFormatter={(val) => val.length > 15 ? val.substring(0, 15) + '...' : val}
                />
                <Tooltip 
                  cursor={{ fill: '#F3F4F6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="cantidadVendida" name="Unidades Vendidas" fill="#D4A017" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              No hay ventas registradas aún.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
