import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    server: {
        allowedHosts: true
    },

    base: '',
    plugins: [
        tailwindcss(),
    ],
    build: {
        outDir: './build',
        manifest: true,
        rollupOptions: {
            input: {
                main: 'index.html',
                app_css: 'app.css',
                app_js: 'app.js'
            }
        },
    }
})