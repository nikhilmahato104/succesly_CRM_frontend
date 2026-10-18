/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    'translate-y-full', 'translate-y-0', '-translate-y-full',
    'opacity-0', 'opacity-100',
    'scale-95', 'scale-100',
    'ease-out', 'ease-in',
    'duration-150', 'duration-200', 'duration-300',
  ],
  theme: {
    // extend: {},
      extend: {
    fontFamily: {
      brand: ['Bricolage Grotesque', 'sans-serif'],
    },
    // One corner radius for the whole UI — see --radius in src/index.css
    borderRadius: {
      md: 'var(--radius)',
      lg: 'var(--radius)',
      xl: 'var(--radius)',
    },
  },

  },
  plugins: [],
};
