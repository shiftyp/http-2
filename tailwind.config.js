/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          400: '#94a3b8',
          300: '#cbd5e1',
          200: '#e2e8f0',
          100: '#f1f5f9',
        },
        blue: {
          900: '#1e3a8a',
          800: '#1e40af',
          700: '#1d4ed8',
          600: '#2563eb',
          500: '#3b82f6',
          400: '#60a5fa',
          300: '#93c5fd',
        },
        green: {
          600: '#059669',
          500: '#10b981',
          400: '#34d399',
        },
        yellow: {
          600: '#d97706',
          500: '#f59e0b',
          400: '#fbbf24',
        },
        red: {
          600: '#dc2626',
          500: '#ef4444',
          400: '#f87171',
        },
        cyan: {
          600: '#0891b2',
          500: '#06b6d4',
          400: '#22d3ee',
        }
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      fontFamily: {
        'mono': ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59, 130, 246, 0.5)',
        'glow-sm': '0 0 10px rgba(59, 130, 246, 0.3)',
        'glow-lg': '0 0 30px rgba(59, 130, 246, 0.7)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}