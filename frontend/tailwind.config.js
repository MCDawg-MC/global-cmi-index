/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'momentum-strong-up': '#059669',
        'momentum-up': '#10B981',
        'momentum-stable': '#FCD34D',
        'momentum-down': '#F59E0B',
        'momentum-strong-down': '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
