"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkle: number;
  phase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/**
 * Fixed, full-viewport animated background: a twinkling starfield plus a handful
 * of particles that drift toward the cursor. Pure canvas, no dependencies, and
 * it bails out entirely when the user prefers reduced motion.
 */
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let stars: Star[] = [];
    let particles: Particle[] = [];
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;

    const seed = () => {
      const starCount = Math.min(
        220,
        Math.round((width * height) / 9000),
      );
      stars = Array.from({ length: starCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.3 + 0.2,
        baseAlpha: Math.random() * 0.5 + 0.25,
        twinkle: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
      }));

      const particleCount = reduceMotion ? 0 : 46;
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
      }));
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    let t = 0;
    const render = () => {
      t += 0.016;
      ctx.clearRect(0, 0, width, height);

      // Twinkling stars
      for (const s of stars) {
        const a = reduceMotion
          ? s.baseAlpha
          : s.baseAlpha + Math.sin(t * s.twinkle * 3 + s.phase) * 0.25;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226, 232, 240, ${Math.max(0.05, a)})`;
        ctx.fill();
      }

      // Mouse-reactive particles + connecting lines
      if (!reduceMotion) {
        for (const p of particles) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 220 && dist > 0.001) {
            const pull = 0.06 / dist;
            p.vx += dx * pull;
            p.vy += dy * pull;
          }
          p.vx *= 0.96;
          p.vy *= 0.96;
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x += width;
          if (p.x > width) p.x -= width;
          if (p.y < 0) p.y += height;
          if (p.y > height) p.y -= height;

          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(56, 189, 248, 0.7)";
          ctx.fill();

          if (dist < 200) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.12 * (1 - dist / 200)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      raf = requestAnimationFrame(render);
    };

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    resize();
    render();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
    />
  );
}
