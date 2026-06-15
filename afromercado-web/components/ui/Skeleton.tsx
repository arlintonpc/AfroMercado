import React from "react";

// ---------------------------------------------------------------------------
// Skeleton base — ancho/alto definidos desde fuera via className
// ---------------------------------------------------------------------------
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={["skeleton rounded-sm", className].filter(Boolean).join(" ")}
    />
  );
}

// ---------------------------------------------------------------------------
// SkeletonText — bloque de varias líneas de texto simulado
// ---------------------------------------------------------------------------
interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = "" }: SkeletonTextProps) {
  return (
    <div
      aria-hidden="true"
      className={["flex flex-col gap-2", className].filter(Boolean).join(" ")}
    >
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={[
            "h-4",
            // La última línea es más corta para simular texto real
            i === lines - 1 ? "w-3/4" : "w-full",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkeletonCard — placeholder de tarjeta de producto
// ---------------------------------------------------------------------------
interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className = "" }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className={[
        "flex flex-col gap-3 rounded-lg bg-white p-4 shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Imagen del producto */}
      <Skeleton className="aspect-[4/3] w-full rounded-lg" />

      {/* Badge de estado */}
      <Skeleton className="w-20 h-5 rounded-full" />

      {/* Nombre del producto */}
      <Skeleton className="w-4/5 h-5" />

      {/* Descripción corta */}
      <SkeletonText lines={2} />

      {/* Precio y botón */}
      <div className="flex items-center justify-between mt-1">
        <Skeleton className="w-24 h-6" />
        <Skeleton className="w-32 h-[44px] rounded-lg" />
      </div>
    </div>
  );
}

export default Skeleton;
