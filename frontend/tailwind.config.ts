/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/core/dictionary.ts',
  ],
  theme: {
    extend: {
      colors: {
        tertiary: '#0E0E0E',
        secondary: '#0E0E0E',
        'secondary-border': '#1D1D29',
        'primary-500': '#0C0C0C',
        'primary-600': '#000000',
        'primary-border': '#E5E5E5',
        accent: '#ffbb3d',
        darkerAccent: '#bb8624',
        // accent: '#F69325', // halloween theme
        error: '#FF5E4F',
        goalie: '#85828B',
        forward: '#66e97b',
        // forward: '#F69325', // halloween theme
        subtle: '#85828B',
        win: '#A4FF95',
        // win: '#FFB768', // halloween theme
        mid: '#f6ff79',
        loss: '#FF7979',
        odyssey: '#D38938',
        support: '#0E0E0E',
        'support-border': '#27262B',
        halloween: '#F69325', // halloween theme
        winter: '#C5FAF0', // christmas theme
        pink: '#F763E4',
      },
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
        '14': 'repeat(14, minmax(0, 1fr))',
        '15': 'repeat(15, minmax(0, 1fr))',
        '16': 'repeat(16, minmax(0, 1fr))',
        '17': 'repeat(17, minmax(0, 1fr))',
        '18': 'repeat(18, minmax(0, 1fr))',
        '19': 'repeat(19, minmax(0, 1fr))',
        '20': 'repeat(20, minmax(0, 1fr))',
      },
      width: {
        '9/25': '36%',
      },
      blur: {
        xs: '2px',
      },
    },
  }
}