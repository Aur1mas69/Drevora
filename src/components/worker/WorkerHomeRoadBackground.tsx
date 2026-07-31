/**
 * Lightweight inline SVG road for the Worker Home hero (light mode).
 * Decorative only — no raster asset, no animation, easy to remove.
 */
export function WorkerHomeRoadBackground({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 480 200"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="workerRoadAsphalt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a3f47" />
          <stop offset="55%" stopColor="#2c3038" />
          <stop offset="100%" stopColor="#22262d" />
        </linearGradient>
        <linearGradient id="workerRoadDepth" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1a1d22" stopOpacity="0.35" />
          <stop offset="45%" stopColor="#1a1d22" stopOpacity="0" />
          <stop offset="100%" stopColor="#1a1d22" stopOpacity="0.2" />
        </linearGradient>
        <pattern
          id="workerRoadGrain"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1.5" r="0.55" fill="#ffffff" fillOpacity="0.035" />
          <circle cx="4.2" cy="3.8" r="0.45" fill="#000000" fillOpacity="0.06" />
          <circle cx="2.8" cy="5.2" r="0.4" fill="#ffffff" fillOpacity="0.025" />
        </pattern>
      </defs>

      {/* Base asphalt + soft horizontal depth */}
      <rect width="480" height="200" fill="url(#workerRoadAsphalt)" />
      <rect width="480" height="200" fill="url(#workerRoadGrain)" />
      <rect width="480" height="200" fill="url(#workerRoadDepth)" />

      {/* Road surface with mild perspective (recedes toward upper-right) */}
      <path
        d="M-40 200 L170 78 L310 78 L520 200 Z"
        fill="#2a2e36"
      />
      <path
        d="M-40 200 L170 78 L310 78 L520 200 Z"
        fill="url(#workerRoadGrain)"
        opacity="0.85"
      />

      {/* Thin white road-edge lines */}
      <path
        d="M-28 192 L178 84"
        fill="none"
        stroke="#f4f7fb"
        strokeWidth="1.35"
        strokeOpacity="0.78"
        strokeLinecap="round"
      />
      <path
        d="M508 192 L302 84"
        fill="none"
        stroke="#f4f7fb"
        strokeWidth="1.35"
        strokeOpacity="0.78"
        strokeLinecap="round"
      />

      {/* Dashed white centre line */}
      <path
        d="M240 188 L240 92"
        fill="none"
        stroke="#f4f7fb"
        strokeWidth="1.6"
        strokeOpacity="0.82"
        strokeLinecap="round"
        strokeDasharray="10 11"
      />

      {/* Muted amber road reflectors between selected dashes */}
      <g fill="#c9893a" fillOpacity="0.72">
        <ellipse cx="240" cy="168" rx="1.7" ry="1.15" />
        <ellipse cx="240" cy="146" rx="1.55" ry="1.05" />
        <ellipse cx="240" cy="124" rx="1.35" ry="0.95" />
        <ellipse cx="240" cy="103" rx="1.15" ry="0.85" />
      </g>
    </svg>
  )
}
