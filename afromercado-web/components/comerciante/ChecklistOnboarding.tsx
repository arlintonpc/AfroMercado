'use client'

interface Paso {
  id: string
  titulo: string
  descripcion: string
  completado: boolean
  href?: string
}

interface Props {
  pasos: Paso[]
}

export default function ChecklistOnboarding({ pasos }: Props) {
  const completados = pasos.filter(p => p.completado).length
  const total = pasos.length
  const porcentaje = Math.round((completados / total) * 100)

  if (completados === total) return null // Ocultar cuando está completo

  return (
    <div className="bg-white border border-[#E8DCC8] rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-bold text-[#1B4332] text-base">Configura tu negocio</h3>
          <p className="text-xs text-gray-500">{completados} de {total} pasos completados</p>
        </div>
        <span className="text-2xl font-bold text-[#2D6A4F]">{porcentaje}%</span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
        <div className="bg-[#2D6A4F] h-2 rounded-full transition-all duration-500"
          style={{ width: `${porcentaje}%` }} />
      </div>

      <div className="space-y-2">
        {pasos.map(paso => (
          <div key={paso.id} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${paso.completado ? 'opacity-50' : 'hover:bg-[#FAF8F5]'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${paso.completado ? 'bg-[#2D6A4F] text-white' : 'border-2 border-gray-200 text-gray-400'}`}>
              {paso.completado ? '✓' : ''}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${paso.completado ? 'line-through text-gray-400' : 'text-gray-800'}`}>{paso.titulo}</p>
              {!paso.completado && <p className="text-xs text-gray-500">{paso.descripcion}</p>}
            </div>
            {!paso.completado && paso.href && (
              <a href={paso.href} className="flex-shrink-0 text-xs font-semibold text-[#2D6A4F] hover:text-[#1B4332] whitespace-nowrap">
                Completar →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
