import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        accent: '#6366f1',           // violet-500
        subtle: '#9ca3af',           // gray-400
        background: '#0f172a',       // slate-900
        foreground: '#f8fafc',       // slate-50
        secondary: '#1e293b',        // slate-800
        'secondary-border': '#334155', // slate-700
      },
    },
  },
  plugins: [],
};

export default config;
