"use client"

import { useEffect, useRef } from "react"

export default function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: {
      x: number
      y: number
      size: number
      color: string
      speed: number
      angle: number
      rotation: number
      rotationSpeed: number
    }[] = []

    const colors = ["#FF577F", "#FF884B", "#FFBD9B", "#F9F871", "#7A4495", "#A7D2CB", "#F2D388", "#C98474"]

    // Create particles
    for (let i = 0; i < 200; i++) {
      const size = Math.random() * 10 + 5
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        size,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: Math.random() * 15 + 5,
        angle: Math.random() * Math.PI * 2,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
      })
    }

    let animationFrameId: number
    let lastTime = Date.now()

    const animate = () => {
      const now = Date.now()
      const dt = (now - lastTime) / 1000
      lastTime = now

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const particle of particles) {
        particle.x += Math.cos(particle.angle) * particle.speed * dt
        particle.y += Math.sin(particle.angle) * particle.speed * dt + 30 * dt // Add gravity
        particle.speed *= 0.99
        particle.rotation += particle.rotationSpeed
        particle.size *= 0.99

        ctx.save()
        ctx.translate(particle.x, particle.y)
        ctx.rotate(particle.rotation)
        ctx.fillStyle = particle.color
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size)
        ctx.restore()
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />
}

