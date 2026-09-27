/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './sidepanel.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        maroon: {
          50: '#fdf2f3',
          100: '#fbe4e6',
          200: '#f7ccd1',
          300: '#efa5ad',
          400: '#e1727f',
          500: '#cf4456',
          600: '#b42b3e',
          700: '#8c1f30',
          800: '#581c24', // Burgundy
          900: '#4a151b', // Deep Maroon
          950: '#2b090e',
        },
        gold: {
          50: '#fdfbf7',
          100: '#f9f5eb',
          200: '#f2e8d0',
          300: '#e8d4ac',
          400: '#dcbb80',
          500: '#cda258', // Warm Gold
          600: '#b88942', // Bronze Gold
          700: '#966c34',
          800: '#79552d',
          900: '#644627',
        },
        medical: {
          50: '#fdf2f3',
          100: '#fbe4e6',
          200: '#f7ccd1',
          300: '#efa5ad',
          400: '#e1727f',
          500: '#cf4456',
          600: '#b42b3e',
          700: '#8c1f30',
          800: '#581c24',
          900: '#4a151b',
        }
      }
    }
  },
  plugins: []
};
