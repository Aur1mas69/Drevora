// Prevent a Light flash before React mounts when a Worker previously
// chose Dark on this device. Best-effort only: if more than one Worker
// account has saved a preference on this browser, we cannot yet know
// which is signed in, so we defer to the normal post-mount apply.
// Inert outside the Worker app: worker-dark only affects CSS scoped to
// .worker-mobile-layout / .worker-theme-surface (see worker-theme.css).
//
// Loaded from index.html as a synchronous, same-origin, non-module
// <script src> (not inline) so it satisfies the production CSP
// (script-src 'self' ...) while still running before first paint.
;(function () {
  try {
    var prefix = 'drevora.worker.appearance:'
    var match = null
    var matchCount = 0
    for (var i = 0; i < window.localStorage.length; i++) {
      var key = window.localStorage.key(i)
      if (key && key.indexOf(prefix) === 0) {
        matchCount++
        match = window.localStorage.getItem(key)
      }
    }
    if (matchCount === 1 && match === 'dark') {
      document.documentElement.classList.add('worker-dark')
    }
  } catch (e) {
    /* localStorage unavailable (private mode) — skip, no visual harm. */
  }
})()
