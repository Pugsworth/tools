/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                lospec: {
                    bg: '#161616',
                    card: '#242424',
                    accent: '#9ca2af',
                    highlight: '#3b82f6'
                }
            },
            animation: {
                'slide-up': 'slideUp 0.3s ease-out forwards'
            },
            keyframes: {
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' }
                }
            }
        }
    },
    plugins: [],
}