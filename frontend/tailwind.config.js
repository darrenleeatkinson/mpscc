/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // base surfaces
        'bg-0': '#070b16',
        'bg-1': '#0a0e1a',
        'bg-2': '#111827',
        // text
        text: '#e8edf7',
        'text-dim': '#9aa6bd',
        'text-faint': '#5f6b83',
        // brand accent
        accent: '#2f6bff',
        'accent-2': '#22d3ee',
        // priority palette
        p1: '#ef4444',
        p2: '#f59e0b',
        p3: '#eab308',
        p4: '#3b82f6',
        p5: '#6b7280',
        // resource status
        'st-available': '#22c55e',
        'st-onroute': '#22d3ee',
        'st-onscene': '#a855f7',
        'st-busy': '#f59e0b',
        'st-stale': '#6b7280',
      },
      borderColor: {
        hair: 'rgba(255,255,255,0.12)',
        'hair-strong': 'rgba(255,255,255,0.22)',
      },
      backgroundColor: {
        panel: 'rgba(255,255,255,0.055)',
        'panel-2': 'rgba(255,255,255,0.09)',
      },
      borderRadius: {
        panel: '16px',
        control: '10px',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'SF Mono',
          'ui-monospace',
          'Cascadia Code',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      backgroundImage: {
        'accent-grad': 'linear-gradient(135deg,#2f6bff 0%,#22d3ee 100%)',
      },
      boxShadow: {
        panel: '0 20px 60px -20px rgba(0,0,0,.7)',
        glow: '0 0 0 1px rgba(255,255,255,0.12), 0 8px 40px -12px rgba(47,107,255,.35)',
        accent: '0 10px 30px -10px rgba(47,107,255,.7)',
      },
      keyframes: {
        fade: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        fade: 'fade .35s ease',
      },
    },
  },
  plugins: [],
}
