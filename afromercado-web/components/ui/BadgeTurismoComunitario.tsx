interface Props {
  verificadoEtnico: boolean
  rntVerificado: boolean
  size?: 'sm' | 'md' | 'lg'
  mostrarTooltip?: boolean
}

const CRITERIOS = [
  '✅ RNT — Registro Nacional de Turismo vigente',
  '✅ Comunidad afro, indígena, raizal o campesina verificada por AfroMercado',
  '✅ Territorio y origen cultural confirmados',
]

export default function BadgeTurismoComunitario({ verificadoEtnico, rntVerificado, size = 'md', mostrarTooltip = true }: Props) {
  if (!verificadoEtnico || !rntVerificado) return null

  const pad  = { sm: 'px-2 py-0.5 gap-1 text-[10px]', md: 'px-2.5 py-1 gap-1.5 text-xs', lg: 'px-3 py-1.5 gap-2 text-sm' }
  const icon = { sm: 'w-3 h-3', md: 'w-3.5 h-3.5', lg: 'w-4 h-4' }

  return (
    <div className="relative group inline-flex">
      <span className={`inline-flex items-center ${pad[size]} bg-[#FDF6E3] text-[#854D0E] border border-[#F4C842] rounded-full font-semibold`}>
        <svg className={`${icon[size]} text-[#D4A017] flex-shrink-0`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
        </svg>
        Turismo Comunitario Certificado
      </span>

      {mostrarTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white border border-gray-100 rounded-xl shadow-xl p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
          <p className="font-bold text-[#1A1A1A] text-xs mb-2">¿Qué significa?</p>
          <ul className="space-y-1.5">
            {CRITERIOS.map(item => (
              <li key={item} className="text-[11px] text-gray-600 leading-snug">{item}</li>
            ))}
          </ul>
          <div className="mt-3 pt-2 border-t border-gray-100">
            <p className="text-[10px] text-gray-400">Certificado por el equipo AfroMercado</p>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r border-b border-gray-100 rotate-45 -mt-1.5" />
        </div>
      )}
    </div>
  )
}
