import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

/** Inject <!-- partial:name --> markers from /partials/*.html into HTML entries. */
function htmlPartialsPlugin() {
    return {
        name: 'html-partials',
        transformIndexHtml: {
            order: 'pre',
            handler(html) {
                return html.replace(/<!--\s*partial:([\w-]+)\s*-->/g, (_, name) => {
                    const partialPath = path.resolve(process.cwd(), 'partials', `${name}.html`)
                    if (!fs.existsSync(partialPath)) {
                        throw new Error(`Missing HTML partial: ${partialPath}`)
                    }
                    return fs.readFileSync(partialPath, 'utf8')
                })
            },
        },
    }
}

export default defineConfig({
    server: {
        allowedHosts: true,
    },

    base: '/',
    plugins: [htmlPartialsPlugin(), tailwindcss()],
    build: {
        outDir: './build',
        manifest: true,
        rollupOptions: {
            input: {
                main: 'index.html',
                terms: 'terms.html',
                privacy: 'privacy.html',
                cookies: 'cookies.html',
                app_css: 'app.css',
                app_js: 'app.js',
            },
        },
    },
})
