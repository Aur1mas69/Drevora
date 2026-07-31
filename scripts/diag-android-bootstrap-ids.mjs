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
  const membership = JSON.parse((await Prefs.get({ key: 'drevora:native-offline-membership-v1' })).value);
  const lsKey = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.includes('auth-token'));
  let lsMeta = null;
  if (lsKey) {
    try {
      const parsed = JSON.parse(localStorage.getItem(lsKey) || 'null');
      lsMeta = {
        hasUser: !!parsed?.user,
        userIdLen: parsed?.user?.id?.length ?? null,
        emailLen: parsed?.user?.email?.length ?? null,
        idsMatchMembership: parsed?.user?.id === membership.userId,
      };
    } catch {
      lsMeta = { parseError: true };
    }
  }
  // Try SecureAuthStorage via Capacitor if present
  let secureMeta = null;
  try {
    const Secure = window.Capacitor?.Plugins?.SecureAuthStorage;
    if (Secure && lsKey) {
      const got = await Secure.getItem({ key: lsKey });
      if (got?.value) {
        const parsed = JSON.parse(got.value);
        secureMeta = {
          userIdLen: parsed?.user?.id?.length ?? null,
          idsMatchMembership: parsed?.user?.id === membership.userId,
        };
      } else {
        secureMeta = { empty: true };
      }
    }
  } catch (e) {
    secureMeta = { err: String(e && e.message ? e.message : e) };
  }
  return { lsKeyPresent: !!lsKey, lsMeta, secureMeta };
})()`

const result = await session.send('Runtime.evaluate', {
  expression,
  awaitPromise: true,
  returnByValue: true,
})
console.log(JSON.stringify(result.result?.value ?? result, null, 2))
session.close()
