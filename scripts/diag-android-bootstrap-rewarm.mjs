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
const targets = await (await fetch('http://127.0.0.1:9222/json')).json()
const page = targets.find((t) => t.type === 'page')
const session = await connectWs(page.webSocketDebuggerUrl)
await session.send('Runtime.enable')

const expression = `(async () => {
  const Prefs = window.Capacitor.Plugins.Preferences;
  // Clear probe so next warm can be observed cleanly
  await Prefs.remove({ key: 'drevora:worker-offline-bootstrap-v1' });
  await Prefs.remove({ key: 'drevora:worker-offline-bootstrap-v1:tpl-index' });
  await Prefs.remove({ key: 'drevora:bootstrap-probe' });
  const membership = await Prefs.get({ key: 'drevora:native-offline-membership-v1' });
  let membershipMeta = null;
  if (membership.value) {
    const m = JSON.parse(membership.value);
    membershipMeta = {
      userIdLen: m.userId?.length ?? null,
      companyIdLen: m.companyId?.length ?? null,
      hasSettingsId: !!m.companySettings?.id,
      settingsIdLen: m.companySettings?.id?.length ?? null,
    };
  }
  // Force a reload of Home by navigating
  location.hash = '';
  location.reload();
  return { cleared: true, membershipMeta };
})()`

const result = await session.send('Runtime.evaluate', {
  expression,
  awaitPromise: true,
  returnByValue: true,
})
console.log(JSON.stringify(result.result?.value ?? result, null, 2))
session.close()

await new Promise((r) => setTimeout(r, 18000))

const appPid2 = adb(['shell', 'pidof', 'com.drevora.worker']).trim().split(/\s+/)[0]
adb(['forward', '--remove-all'])
adb(['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${appPid2}`])
const targets2 = await (await fetch('http://127.0.0.1:9222/json')).json()
const page2 = targets2.find((t) => t.type === 'page')
const session2 = await connectWs(page2.webSocketDebuggerUrl)
await session2.send('Runtime.enable')

const expression2 = `(async () => {
  const Prefs = window.Capacitor.Plugins.Preferences;
  const root = await Prefs.get({ key: 'drevora:worker-offline-bootstrap-v1' });
  const idx = await Prefs.get({ key: 'drevora:worker-offline-bootstrap-v1:tpl-index' });
  if (!root.value) return { afterReload: 'missing' };
  const parsed = JSON.parse(root.value);
  return {
    afterReload: 'present',
    userIdLen: parsed.userId?.length ?? null,
    companyIdLen: parsed.companyId?.length ?? null,
    vehicleCount: Array.isArray(parsed.vehicles) ? parsed.vehicles.length : null,
    hasDefaultReg: !!(parsed.worker && parsed.worker.defaultVehicleRegistration),
    rootLen: root.value.length,
    idx: idx.value,
  };
})()`

const result2 = await session2.send('Runtime.evaluate', {
  expression: expression2,
  awaitPromise: true,
  returnByValue: true,
})
console.log(JSON.stringify(result2.result?.value ?? result2, null, 2))
session2.close()
