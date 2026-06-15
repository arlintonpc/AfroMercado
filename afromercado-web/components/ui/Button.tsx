import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: "button" | "submit" | "reset";
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#2D6A4F] text-white hover:bg-[#245a42] active:bg-[#1d4a37] border-transparent",
  secondary:
    "border border-[#2D6A4F] text-[#2D6A4F] bg-transparent hover:bg-[#2D6A4F]/5 active:bg-[#2D6A4F]/10",
  ghost:
    "border-transparent text-[#2D6A4F] bg-transparent hover:bg-[#52B788]/10 active:bg-[#52B788]/20",
  danger:
    "bg-[#C0392B] text-white hover:bg-[#a93226] active:bg-[#922b21] border-transparent",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-sm px-3 min-h-[44px] gap-1.5",
  md: "text-base px-5 min-h-[44px] gap-2",
  lg: "text-lg px-7 min-h-[52px] gap-2.5",
};

const Spinner = () => (
  <svg
    className="animate-spin"
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <circle
      cx="9"
      cy="9"
      r="7"
      stroke="currentColor"
      strokeOpacity="0.3"
      strokeWidth="2"
    />
    <path
      d="M9 2a7 7 0 0 1 7 7"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  className = "",
  onClick,
  type = "button",
  children,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={[
        "inline-flex items-center justify-center font-semibold rounded-lg",
        "transition-colors duration-150 cursor-pointer select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-2",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-busy={loading}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export default Button;
