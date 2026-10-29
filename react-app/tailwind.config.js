/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        bg:      '#F4F7F9',
        surface: '#FFFFFF',
        surface2:'#F1F3F6',
        surface3:'#E8ECF1',
        border:  '#E2E6EB',
        border2: '#D0D5DC',
        ink:     '#0B2B3C',
        ink2:    '#3B4150',
        ink3:    '#5F6B7A',
        ink4:    '#8B95A5',
        ink5:    '#B0B8C4',

        /* WEAVE primary accent. Replaces blue as the interactive colour:
           nav selection, focus rings, primary buttons, section rules. */
        cyan:    { DEFAULT:'#00A8CC', bright:'#00C2E0', light:'#E4F4F9', mid:'#A8DCEA', dark:'#00718A' },
        /* WEAVE secondary accent, used for AI / recommendation emphasis --
           the lime the mockup uses for the RECOMMENDATION column and the
           highlighted scenario chip. */
        lime:    { DEFAULT:'#B8D943', light:'#EEF7C8', mid:'#D4E88A', dark:'#7A9420' },

        /* Status-flag colours are domain semantics (replenish/low/ok/hold/
           redeploy), not branding -- left exactly as they were so the SKU
           table keeps meaning the same thing. */
        blue:    { DEFAULT:'#2E6BE6', light:'#EBF1FD', dark:'#1D4FA0' },
        green:   { DEFAULT:'#1A8754', light:'#E6F5ED' },
        amber:   { DEFAULT:'#D97706', light:'#FEF3E2' },
        red:     { DEFAULT:'#C93B3B', light:'#FDE8E8' },
        purple:  { DEFAULT:'#6C5CE7', light:'#F0EEFE' },

        sidebar: { DEFAULT:'#0B2B3C', hover:'#123A4F', card:'#102F41' },
      },
      borderRadius: { sm:'4px', DEFAULT:'6px', lg:'10px' },
      boxShadow: {
        card:  '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
        panel: '0 4px 16px rgba(0,0,0,.08)',
      },
    },
  },
  plugins: [],
}
