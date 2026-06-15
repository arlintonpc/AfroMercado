import React, { useId } from "react";

interface InputProps {
  label: string;
  name?: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

export function Input({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  hint,
  disabled = false,
  className = "",
}: InputProps) {
  const generatedId = useId();
  const id = name ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={["flex flex-col gap-1", className].join(" ")}>
      {/* Label */}
      <label
        htmlFor={id}
        className="font-semibold text-sm text-[#1A1A1A] font-[var(--font-inter)] leading-tight"
      >
        {label}
      </label>

      {/* Input wrapper */}
      <div className="relative flex items-center min-h-[44px]">
        <input
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={describedBy || undefined}
          className={[
            // Base
            "w-full bg-transparent min-h-[44px] py-2 text-base text-[#1A1A1A]",
            "border-b outline-none transition-colors duration-150",
            "placeholder:text-[#1A1A1A]/40",
            "font-[var(--font-inter)]",
            // Border color states
            error
              ? "border-[#C0392B] focus:border-[#C0392B]"
              : "border-[#1A1A1A]/30 focus:border-[#D4A017]",
            // Disabled
            disabled
              ? "opacity-50 cursor-not-allowed"
              : "cursor-text",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      </div>

      {/* Error message */}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-[#C0392B] leading-tight mt-0.5">
          {error}
        </p>
      )}

      {/* Hint */}
      {!error && hint && (
        <p id={hintId} className="text-sm text-[#1A1A1A]/50 leading-tight mt-0.5">
          {hint}
        </p>
      )}
    </div>
  );
}

export default Input;
