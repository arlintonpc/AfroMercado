'use client'

import { useState } from 'react'
import { PasswordVisibilityButton } from './PasswordVisibilityButton'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  name?: string
  required?: boolean
  minLength?: number
  disabled?: boolean
  className?: string
  inputClassName?: string
  autoComplete?: string
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  name,
  required = false,
  minLength,
  disabled = false,
  className = '',
  inputClassName = '',
  autoComplete,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      <input
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        disabled={disabled}
        autoComplete={autoComplete}
        className={[
          'w-full pr-11',
          inputClassName,
        ].filter(Boolean).join(' ')}
      />
      <PasswordVisibilityButton
        visible={visible}
        onToggle={() => setVisible((v) => !v)}
        disabled={disabled}
      />
    </div>
  )
}

export default PasswordInput
