import { useEffect, useRef } from 'react'

type VehicleCheckSignaturePadProps = {
  onChange: (file: File | null) => void
  disabled?: boolean
}

const CANVAS_HEIGHT = 128

function exportSignatureFile(canvas: HTMLCanvasElement): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(null)
          return
        }

        resolve(
          new File([blob], 'worker-signature.jpg', {
            type: 'image/jpeg',
            lastModified: Date.now(),
          }),
        )
      },
      'image/jpeg',
      0.85,
    )
  })
}

export function VehicleCheckSignaturePad({
  onChange,
  disabled = false,
}: VehicleCheckSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const drawingRef = useRef(false)
  const hasStrokeRef = useRef(false)

  function resizeCanvas() {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const width = Math.max(container.clientWidth, 280)
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(CANVAS_HEIGHT * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`

    const context = canvas.getContext('2d')
    if (!context) return

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.lineWidth = 2.5
    context.strokeStyle = '#113C69'
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, width, CANVAS_HEIGHT)
  }

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [])

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  async function commitSignature() {
    const canvas = canvasRef.current
    if (!canvas || !hasStrokeRef.current) {
      onChange(null)
      return
    }

    const file = await exportSignatureFile(canvas)
    onChange(file)
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    drawingRef.current = true
    hasStrokeRef.current = true
    canvas.setPointerCapture(event.pointerId)

    const point = getPoint(event)
    context.beginPath()
    context.moveTo(point.x, point.y)
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return

    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const point = getPoint(event)
    context.lineTo(point.x, point.y)
    context.stroke()
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return

    drawingRef.current = false
    const canvas = canvasRef.current
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId)
    }

    void commitSignature()
  }

  function handleClear() {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    drawingRef.current = false
    hasStrokeRef.current = false
    resizeCanvas()
    onChange(null)
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="overflow-hidden rounded-[12px] border border-[#C5DFFB] bg-white"
      >
        <canvas
          ref={canvasRef}
          className={`block w-full touch-none ${disabled ? 'opacity-60' : 'cursor-crosshair'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          aria-label="Worker signature pad"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-[11px] text-[#5499BF]">Sign with your finger</p>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="text-[11px] font-semibold text-[#0B68BE] hover:underline disabled:opacity-60"
        >
          Clear signature
        </button>
      </div>
    </div>
  )
}
