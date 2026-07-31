/**
 * Prints what the WebView sees for connectivity while the device is offline:
 * Capacitor Network.getStatus() vs navigator.onLine, plus which bundle is live.
 *
 * Pass --reset-sw to drop a stale service worker that an earlier web/dev load
 * left controlling the Capacitor origin (it keeps serving its own precache and
 * shadows every APK update).
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const adbPath = path.join(
  process.env.LOCALAPPDATA || '',
  'Android',
  'Sdk',
  'platform-tools',
  'adb.exe',
)

function adb(args) {
  return execFileSync(adbPath, args, { encoding: 'utf8' })
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const pending = new Map()
    let nextId = 1
    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const id = nextId++
          return new Promise((res, rej) => {
            pending.set(id, { res, rej })
            ws.send(JSON.stringify({ id, method, params }))
          })
        },
        close: () => ws.close(),
      })
    })
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data))
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) rej(new Error(msg.error.message))
        else res(msg.result)
      }
    })
    ws.addEventListener('error', reject)
  })
}

async function main() {
  const appPid = adb(['shell', 'pidof', 'com.drevora.worker']).trim().split(/\s+/)[0]
  if (!appPid) throw new Error('Worker app not running')
  try {
    adb(['forward', '--remove-all'])
  } catch {
    // ignore
  }
  adb(['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${appPid}`])
  await new Promise((r) => setTimeout(r, 500))

  const targets = await (await fetch('http://127.0.0.1:9222/json')).json()
  const target = targets.find((t) => t.type === 'page')
  const session = await connectWs(target.webSocketDebuggerUrl)
  await session.send('Runtime.enable')

  const result = await session.send('Runtime.evaluate', {
    expression: `(async () => {
      const out = {
        navigatorOnLine: navigator.onLine,
        body: (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ').trim().slice(0, 400),
        hasLoadingSkeleton: Boolean(document.querySelector('[aria-label="Loading worker home"]')),
        hasCta: Boolean(document.querySelector('.worker-home-cta')),
        ctaCount: document.querySelectorAll('a[href="/worker/vehicle-checks"]').length,
        path: location.pathname,
        scripts: [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
        swControlled: Boolean(navigator.serviceWorker && navigator.serviceWorker.controller),
      };
      try {
        const s = await window.Capacitor.Plugins.Network.getStatus();
        out.capacitorConnected = s.connected;
        out.capacitorType = s.connectionType;
      } catch (e) {
        out.capacitorError = String(e && e.message ? e.message : e);
      }
      return JSON.stringify(out);
    })()`,
    returnByValue: true,
    awaitPromise: true,
  })

  console.log(result?.result?.value ?? '(no result)')

  if (process.argv.includes('--reset-sw')) {
    const reset = await session.send('Runtime.evaluate', {
      expression: `(async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) await reg.unregister();
        const keys = await caches.keys();
        for (const key of keys) await caches.delete(key);
        return JSON.stringify({ unregistered: regs.length, cachesDeleted: keys.length });
      })()`,
      returnByValue: true,
      awaitPromise: true,
    })
    console.log('reset-sw:', reset?.result?.value ?? '(no result)')
  }

  session.close()
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
