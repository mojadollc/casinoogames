/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      keyframes: {
        reelSpin: {
          '0%':   { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-50%)' },
        },
        reelLand: {
          '0%':   { transform: 'translateY(-12px)', opacity: '0.6' },
          '60%':  { transform: 'translateY(3px)' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(250,204,21,0.6)' },
          '50%':       { boxShadow: '0 0 22px rgba(250,204,21,1)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0) rotate(-4deg)' },
          '50%':       { transform: 'translateY(-8px) rotate(4deg)' },
        },
        shakeSm: {
          '0%, 100%': { transform: 'translate(0,0)' },
          '20%': { transform: 'translate(-4px,-2px)' },
          '40%': { transform: 'translate(4px,2px)' },
          '60%': { transform: 'translate(-3px,1px)' },
          '80%': { transform: 'translate(3px,-1px)' },
        },
        shakeBig: {
          '0%, 100%': { transform: 'translate(0,0) rotate(0)' },
          '15%': { transform: 'translate(-8px,-4px) rotate(-1deg)' },
          '30%': { transform: 'translate(8px,4px) rotate(1deg)' },
          '45%': { transform: 'translate(-7px,2px) rotate(-0.8deg)' },
          '60%': { transform: 'translate(7px,-2px) rotate(0.8deg)' },
          '75%': { transform: 'translate(-4px,1px)' },
        },
      },
      animation: {
        'reel-spin':   'reelSpin 0.22s linear infinite',
        'reelland':    'reelLand 0.35s ease-out',
        'glow':        'glow 0.8s ease-in-out infinite',
        'floaty':      'floaty 2.4s ease-in-out infinite',
        'shake-sm':    'shakeSm 0.45s ease-in-out',
        'shake-big':   'shakeBig 0.6s ease-in-out',
      },
    },
  },
  plugins: [],
};
