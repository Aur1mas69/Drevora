/**
 * Android emulator offline bootstrap verification via raw CDP (WebView).
 * Avoids Playwright connectOverCDP (unsupported Browser domain on Android).
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

function pass(msg) {
  console.log('PASS:', msg)
}
function fail(msg) {
  console.error('FAIL:', msg)
  process.exitCode = 1
}

async function listTargets() {
  const res = await fetch('http://127.0.0.1:9222/json')
  return res.json()
}

async function forwardToApp() {
  const appPid = adb(['shell', 'pidof', 'com.drevora.worker']).trim().split(/\s+/)[0]
  if (!appPid) throw new Error('Worker app not running')
  try {
    adb(['forward', '--remove-all'])
  } catch {
    // ignore
  }
  adb(['forward', 'tcp:9222', `localabstract:webview_devtools_remote_${appPid}`])
  await new Promise((r) => setTimeout(r, 400))
  return appPid
}

function connectWs(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    const pending = new Map()
    let nextId = 1
    ws.addEventListener('open', () => {
      resolve({
        ws,
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
    ws.addEventListener('error', (err) => reject(err))
  })
}

async function openPageSession() {
  await forwardToApp()
  const targets = await listTargets()
  const pageTarget =
    targets.find((t) => t.type === 'page' && /localhost|drevora/i.test(t.url || t.title || '')) ||
    targets.find((t) => t.type === 'page')
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error('No WebView page target')
  }
  const session = await connectWs(pageTarget.webSocketDebuggerUrl)
  await session.send('Runtime.enable')
  return session
}

async function evalBodyText(session) {
  const result = await session.send('Runtime.evaluate', {
    expression: `document.body ? document.body.innerText : ''`,
    returnByValue: true,
    awaitPromise: true,
  })
  return String(result?.result?.value ?? '')
}

async function waitForText(session, pattern, attempts = 24) {
  let text = ''
  for (let i = 0; i < attempts; i++) {
    text = await evalBodyText(session)
    if (pattern.test(text)) return text
    await new Promise((r) => setTimeout(r, 1250))
  }
  return text
}

async function clickByText(session, text) {
  await session.send('Runtime.evaluate', {
    expression: `(() => {
      const match = [...document.querySelectorAll('a,button,[role="button"],span,div')]
        .find((el) => (el.textContent || '').trim() === ${JSON.stringify(text)});
      if (!match) return false;
      match.click();
      return true;
    })()`,
    returnByValue: true,
  })
}

async function clickContinue(session) {
  const result = await session.send('Runtime.evaluate', {
    expression: `(() => {
      const btn = [...document.querySelectorAll('button')]
        .find((el) => (el.textContent || '').trim() === 'Continue');
      if (!btn) return false;
      btn.click();
      return true;
    })()`,
    returnByValue: true,
  })
  return Boolean(result?.result?.value)
}

async function main() {
  adb(['shell', 'svc', 'wifi', 'enable'])
  adb(['shell', 'svc', 'data', 'enable'])
  await new Promise((r) => setTimeout(r, 2000))
  adb(['shell', 'am', 'force-stop', 'com.drevora.worker'])
  adb(['shell', 'am', 'start', '-n', 'com.drevora.worker/.MainActivity'])
  await new Promise((r) => setTimeout(r, 10000))

  let session = await openPageSession()
  let text = await waitForText(session, /Start Vehicle Check|Sign in/i)
  console.log('online body:', text.slice(0, 420).replace(/\s+/g, ' ').trim())
  if (/Start Vehicle Check/i.test(text)) pass('Android online Worker Home loaded')
  else fail('Android online Home missing Start Vehicle Check')

  // Open Vehicle Check once online to warm fleet + templates into Preferences.
  await clickByText(session, 'Start Vehicle Check')
  text = await waitForText(session, /Select vehicle|Unable to start/i, 20)
  console.log('online VC:', text.slice(0, 300).replace(/\s+/g, ' ').trim())
  if (/Select vehicle/i.test(text) && /SELECTED VEHICLE|Continue/i.test(text)) {
    pass('Android online Vehicle Check opened for warm')
  } else console.log('WARN: online VC warm navigation incomplete')
  // Prefer an exact Continue button click when present
  const continued = await clickContinue(session)
  if (!continued) {
    console.log('WARN: Continue button not clicked during online warm')
  }
  session.close()

  // Give warm writes time to finish Preferences I/O
  await new Promise((r) => setTimeout(r, 6000))
  const prefs = adb([
    'shell',
    'run-as',
    'com.drevora.worker',
    'cat',
    'shared_prefs/CapacitorStorage.xml',
  ])
  const hasRoot = prefs.includes('drevora:worker-offline-bootstrap-v1')
  const hasTplIndex = prefs.includes('drevora:worker-offline-bootstrap-v1:tpl-index')
  if (hasRoot) pass('Bootstrap root key present in Preferences after online Home')
  else fail('Bootstrap root key missing after online Home')
  if (hasTplIndex) pass('Bootstrap tpl-index key present in Preferences')
  else console.log('WARN: tpl-index missing (ok if fleet has no vehicle types yet)')

  // Key names only — do not print values
  const keyNames = [...prefs.matchAll(/name="([^"]+)"/g)].map((m) => m[1])
  console.log(
    'bootstrap-related keys:',
    keyNames.filter((k) => k.includes('worker-offline-bootstrap')).join(', ') || '(none)',
  )

  adb(['shell', 'am', 'force-stop', 'com.drevora.worker'])
  adb(['shell', 'svc', 'wifi', 'disable'])
  adb(['shell', 'svc', 'data', 'disable'])
  await new Promise((r) => setTimeout(r, 2000))
  adb(['shell', 'am', 'start', '-n', 'com.drevora.worker/.MainActivity'])
  await new Promise((r) => setTimeout(r, 12000))

  session = await openPageSession()
  text = await waitForText(
    session,
    /Start Vehicle Check|Sign in|prepare offline/i,
    36,
  )
  console.log('offline body:', text.slice(0, 450).replace(/\s+/g, ' ').trim())

  if (/Start Vehicle Check/i.test(text)) {
    pass('Android offline Home shows Start Vehicle Check')
  } else {
    fail('Android offline Home did not show Start Vehicle Check')
  }

  if (/Good (morning|afternoon|evening)/i.test(text)) {
    pass('Android offline Home keeps the Worker greeting')
  } else {
    fail('Android offline Home missing the Worker greeting')
  }

  // Offline Home renders the CTA only — no live cards, no Quick actions.
  if (/Quick actions/i.test(text)) {
    fail('Android offline Home still renders Quick actions')
  } else {
    pass('Android offline Home hides Quick actions')
  }

  if (/DEFAULT VEHICLE/i.test(text)) {
    fail('Android offline Home still renders the default vehicle card')
  } else {
    pass('Android offline Home hides live dashboard cards')
  }

  if (
    /Connect to the internet once to prepare offline Vehicle Checks/i.test(text) &&
    prefs.includes('drevora:worker-offline-bootstrap-v1')
  ) {
    fail('Not-prepared message shown despite bootstrap cache')
  }

  await clickByText(session, 'Start Vehicle Check')
  text = await waitForText(session, /Select vehicle|Continue|Unable to start/i, 24)
  console.log('offline VC:', text.slice(0, 420).replace(/\s+/g, ' ').trim())
  if (
    (/Select vehicle/i.test(text) || /Continue/i.test(text)) &&
    !/Unable to start a Vehicle Check/i.test(text)
  ) {
    pass('Android offline Vehicle Check opened')
  } else {
    fail('Android offline Vehicle Check failed to open')
  }

  const clicked = await clickContinue(session)
  if (!clicked) fail('Android Continue button missing')
  else {
    text = await waitForText(
      session,
      /Front view|Checklist for|Mark each item|Failed to load/i,
      16,
    )
    console.log('offline checklist:', text.slice(0, 420).replace(/\s+/g, ' ').trim())
    if (/Failed to load inspection checklist/i.test(text)) {
      fail('Android checklist load failed offline')
    } else if (/Front view|Checklist for|Mark each item/i.test(text)) {
      pass('Android offline checklist opened')
    } else {
      fail('Android offline checklist did not open')
    }
  }

  session.close()
  adb(['shell', 'svc', 'wifi', 'enable'])
  adb(['shell', 'svc', 'data', 'enable'])
}

main().catch((err) => {
  console.error('FAIL:', err instanceof Error ? err.message : err)
  try {
    adb(['shell', 'svc', 'wifi', 'enable'])
    adb(['shell', 'svc', 'data', 'enable'])
  } catch {
    // ignore
  }
  process.exitCode = 1
})
