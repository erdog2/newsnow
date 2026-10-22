const GLYPHS = "01アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF<>/\\#$%"

function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const size = 16
    let drops: number[] = []
    let timer: ReturnType<typeof setInterval> | undefined

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const columns = Math.ceil(window.innerWidth / size)
      drops = Array.from({ length: columns }, () => Math.random() * -50)
    }

    const draw = () => {
      ctx.fillStyle = "rgba(4, 7, 13, 0.18)"
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight)
      ctx.font = `${size - 2}px ui-monospace, Menlo, monospace`
      drops.forEach((y, i) => {
        const char = GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
        ctx.fillStyle = Math.random() > 0.975 ? "#ffffff" : i % 7 === 0 ? "#ff3b5c" : "#22e4ff"
        ctx.fillText(char, i * size, y * size)
        drops[i] = y * size > window.innerHeight && Math.random() > 0.97 ? 0 : y + 1
      })
    }

    const start = () => {
      if (!timer) timer = setInterval(draw, 80)
    }
    const stop = () => {
      clearInterval(timer)
      timer = undefined
    }
    const onVisibility = () => (document.hidden ? stop() : start())

    resize()
    start()
    window.addEventListener("resize", resize)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      stop()
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return <canvas ref={ref} className="hud-bg-matrix w-full h-full" />
}

export function HudBackground() {
  return (
    <>
      <div className="hud-bg-grid" />
      <MatrixRain />
      <div className="hud-scanlines" />
    </>
  )
}
