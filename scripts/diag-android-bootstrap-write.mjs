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
        close() {
          ws.close()
        },
      })
    })
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data))
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)))
        else res(msg.result)
      }
    })
    ws.addEventListener('error', reject)
  })
}

const appPid = adb(['shell', 'pidof', 'com.drevora.worker']).trim().split(/\s+/)[0]
try {
  adb(['forward', '--remove-all'])
} catch {
  // ignore
}
adb(['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${appPid}`])
await new Promise((r) => setTimeout(r, 400))

const targets = await (await fetch('http://127.0.0.1:9222/json')).json()
const page = targets.find((t) => t.type === 'page')
const session = await connectWs(page.webSocketDebuggerUrl)
await session.send('Runtime.enable')

const expression = `(async () => {
  const Prefs = window.Capacitor.Plugins.Preferences;
  const before = await Prefs.keys();
  const tiny = JSON.stringify({
    version: 1,
    userId: 'probe-user',
    companyId: 'probe-co',
    savedAt: new Date().toISOString(),
    worker: { id: 'w', email: 'a@b.c', firstName: 'A', lastName: 'B' },
    vehicles: [],
    templateItemsByVehicleType: {}
  });
  try {
    await Prefs.set({ key: 'drevora:worker-offline-bootstrap-v1', value: tiny });
    await Prefs.set({ key: 'drevora:worker-offline-bootstrap-v1:tpl-index', value: '[]' });
  } catch (e) {
    return { err: String(e && e.message ? e.message : e), before: before.keys };
  }
  const after = await Prefs.keys();
  const root = await Prefs.get({ key: 'drevora:worker-offline-bootstrap-v1' });
  return {
    before: before.keys,
    after: after.keys,
    rootLen: root.value ? root.value.length : null,
  };
})()`

const result = await session.send('Runtime.evaluate', {
  expression,
  awaitPromise: true,
  returnByValue: true,
})
console.log(JSON.stringify(result.result?.value ?? result, null, 2))
session.close()
