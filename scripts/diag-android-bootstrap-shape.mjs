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

adb(['shell', 'svc', 'wifi', 'enable'])
adb(['shell', 'svc', 'data', 'enable'])
adb(['shell', 'am', 'force-stop', 'com.drevora.worker'])
adb(['shell', 'am', 'start', '-n', 'com.drevora.worker/.MainActivity'])
await new Promise((r) => setTimeout(r, 16000))

const appPid = adb(['shell', 'pidof', 'com.drevora.worker']).trim().split(/\s+/)[0]
try {
  adb(['forward', '--remove-all'])
} catch {
  // ignore
}
adb(['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${appPid}`])

const targets = await (await fetch('http://127.0.0.1:9222/json')).json()
const page = targets.find((t) => t.type === 'page')
const session = await connectWs(page.webSocketDebuggerUrl)
await session.send('Runtime.enable')

const expression = `(async () => {
  const Prefs = window.Capacitor.Plugins.Preferences;
  const root = await Prefs.get({ key: 'drevora:worker-offline-bootstrap-v1' });
  const idx = await Prefs.get({ key: 'drevora:worker-offline-bootstrap-v1:tpl-index' });
  if (!root.value) return { missing: true };
  let parsed;
  try { parsed = JSON.parse(root.value); } catch (e) {
    return { parseError: true, rootLen: root.value.length };
  }
  const worker = parsed.worker || {};
  const vehicles = Array.isArray(parsed.vehicles) ? parsed.vehicles : null;
  const badVehicles = [];
  if (vehicles) {
    vehicles.forEach((v, i) => {
      if (!v || typeof v.id !== 'string' || typeof v.registration !== 'string') {
        badVehicles.push(i);
      }
    });
  }
  let types = [];
  try { types = idx.value ? JSON.parse(idx.value) : []; } catch { types = ['parse-fail']; }
  const tplShapes = [];
  for (const t of types.slice(0, 5)) {
    const row = await Prefs.get({ key: 'drevora:worker-offline-bootstrap-v1:tpl:' + t });
    let items = null;
    let badItem = null;
    try { items = row.value ? JSON.parse(row.value) : []; } catch { badItem = 'json'; }
    if (Array.isArray(items)) {
      const first = items[0];
      if (first) {
        badItem = {
          id: typeof first.id,
          label: typeof first.label,
          section: typeof first.section,
        };
      }
      tplShapes.push({ type: t, count: items.length, first: badItem });
    } else {
      tplShapes.push({ type: t, count: -1, first: badItem });
    }
  }
  return {
    version: parsed.version,
    userIdLen: typeof parsed.userId === 'string' ? parsed.userId.length : null,
    companyIdLen: typeof parsed.companyId === 'string' ? parsed.companyId.length : null,
    workerFields: {
      id: typeof worker.id,
      email: typeof worker.email,
      firstName: typeof worker.firstName,
      lastName: typeof worker.lastName,
      hasDefaultReg: typeof worker.defaultVehicleRegistration === 'string' && worker.defaultVehicleRegistration.length > 0,
    },
    vehicleCount: vehicles ? vehicles.length : null,
    badVehicles,
    typesCount: Array.isArray(types) ? types.length : null,
    tplShapes,
    rootLen: root.value.length,
  };
})()`

const result = await session.send('Runtime.evaluate', {
  expression,
  awaitPromise: true,
  returnByValue: true,
})
console.log(JSON.stringify(result.result?.value ?? result, null, 2))
session.close()
