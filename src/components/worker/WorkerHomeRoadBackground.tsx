/** Same public-asset pattern as the Worker robot — works on Web/PWA and Capacitor. */
export const WORKER_HOME_ROAD_BG_SRC = '/assets/worker/worker-home-road-bg.png'

/**
 * Worker Home motivational banner road background (light mode).
 * Full-bleed <img> filling the banner shell — cover, road/truck left.
 */
export function WorkerHomeRoadBackground({ className }: { className?: string }) {
  return (
    <img
      src={WORKER_HOME_ROAD_BG_SRC}
      alt=""
      aria-hidden="true"
      width={1200}
      height={400}
      loading="eager"
      decoding="async"
      className={className}
      style={{
        objectFit: 'cover',
        objectPosition: 'left center',
      }}
    />
  )
}
