import React from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  titulo: string;
  descripcion: string;
  onReintentar?: () => void;
}

// Ícono SVG de caja vacía / hoja — simple y legible a cualquier tamaño
function EmptyBoxIcon() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Caja */}
      <rect
        x="12"
        y="28"
        width="48"
        height="34"
        rx="4"
        stroke="#2D6A4F"
        strokeWidth="2.5"
        fill="none"
      />
      {/* Tapa abierta */}
      <path
        d="M12 28L20 16h32l8 12"
        stroke="#2D6A4F"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Línea central de la tapa */}
      <line
        x1="36"
        y1="16"
        x2="36"
        y2="28"
        stroke="#2D6A4F"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Línea interior de la caja */}
      <line
        x1="12"
        y1="28"
        x2="60"
        y2="28"
        stroke="#2D6A4F"
        strokeWidth="2.5"
      />
      {/* Hoja decorativa dentro */}
      <path
        d="M30 42c0-4 3-7 6-8 3 1 6 4 6 8-1.5 2-4 3-6 3s-4.5-1-6-3z"
        fill="#52B788"
        opacity="0.5"
      />
      <line
        x1="36"
        y1="34"
        x2="36"
        y2="48"
        stroke="#2D6A4F"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EmptyState({ titulo, descripcion, onReintentar }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16 px-6 text-center">
      {/* Ícono */}
      <EmptyBoxIcon />

      {/* Título */}
      <h2
        className="text-2xl text-[#2D6A4F] font-[var(--font-dm-serif)] leading-snug"
        style={{ fontFamily: "var(--font-dm-serif), Georgia, serif" }}
      >
        {titulo}
      </h2>

      {/* Descripción */}
      <p className="text-base text-[#1A1A1A]/70 font-[var(--font-inter)] max-w-sm leading-relaxed">
        {descripcion}
      </p>

      {/* Botón opcional */}
      {onReintentar && (
        <Button variant="secondary" onClick={onReintentar} className="mt-2">
          Reintentar
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
