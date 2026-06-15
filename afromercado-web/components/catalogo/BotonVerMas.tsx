'use client'

interface BotonVerMasProps {
  onClick: () => void
  cargando: boolean
}

function Spinner() {
  return (
    <svg
      className="animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

export default function BotonVerMas({ onClick, cargando }: BotonVerMasProps) {
  return (
    <div className="flex justify-center mt-8">
      <button
        onClick={onClick}
        disabled={cargando}
        aria-busy={cargando}
        className={[
          'flex items-center gap-2 px-8 min-h-[44px] rounded-full border-2 font-medium text-sm transition-colors duration-150',
          'border-[#2D6A4F] text-[#2D6A4F]',
          cargando
            ? 'opacity-60 cursor-not-allowed'
            : 'hover:bg-[#2D6A4F] hover:text-white active:bg-[#245a42]',
        ].join(' ')}
        style={{ fontFamily: 'var(--font-inter)' }}
      >
        {cargando ? (
          <>
            <Spinner />
            Cargando...
          </>
        ) : (
          'Ver más productos'
        )}
      </button>
    </div>
  )
}
