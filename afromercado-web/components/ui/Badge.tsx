import React from "react";

type BadgeVariant = "verde" | "gris" | "dorado" | "naranja";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  verde:  "bg-[#52B788]/20 text-[#2D6A4F]",
  gris:   "bg-[#1A1A1A]/10 text-[#1A1A1A]/60",
  dorado: "bg-[#D4A017]/15 text-[#1A1A1A]",
  naranja: "bg-[#E67E22]/15 text-[#E67E22]",
};

export function Badge({ variant, children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1",
        "text-sm font-semibold font-[var(--font-inter)] leading-none",
        "whitespace-nowrap",
        variantClasses[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

export default Badge;
