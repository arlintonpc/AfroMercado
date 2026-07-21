import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'verde-selva':    '#2D6A4F',
        'verde-claro':    '#52B788',
        'dorado':         '#D4A017',
        'blanco-natural': '#F8F5F0',
        'carbon':         '#1A1A1A',
      },
      fontFamily: {
        serif: ['var(--font-dm-serif)', 'Georgia', 'serif'],
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'xs':   ['12px', { lineHeight: '16px' }],
        'sm':   ['14px', { lineHeight: '20px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg':   ['18px', { lineHeight: '28px' }],
        'xl':   ['20px', { lineHeight: '28px' }],
        '2xl':  ['24px', { lineHeight: '32px' }],
        '3xl':  ['30px', { lineHeight: '36px' }],
        '4xl':  ['36px', { lineHeight: '40px' }],
      },
      boxShadow: {
        'card':   '0 1px 2px rgba(0,0,0,0.05)',
        'sticky': '0 -2px 8px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        'sm':   '4px',
        'lg':   '8px',
        'full': '9999px',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        gradient: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        gradient: 'gradient 3s ease infinite',
      },
    },
  },
  plugins: [],
}

export default config
