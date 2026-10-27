import { useEffect, useRef } from "react";
import { TEAM_COLORS } from "./ui.jsx";

// confetti(x, y) bursts paper from a screen point.
let burst = () => {};
export const confetti = (x, y) => burst(x, y);

export function ConfettiLayer() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, c = cv.getContext("2d");
    let parts = [], raf = 0;
    const size = () => { const d = window.devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d; c.setTransform(d, 0, 0, d, 0, 0); };
    size(); window.addEventListener("resize", size);
    const frame = () => {
      c.clearRect(0, 0, innerWidth, innerHeight);
      parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 20);
      for (const p of parts) {
        p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = Math.min(1, p.life / 30);
        c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        c.restore();
      }
      raf = parts.length ? requestAnimationFrame(frame) : 0;
    };
    burst = (x, y) => {
      if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      for (let i = 0; i < 140; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3, v = 6 + Math.random() * 10;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, life: 90 + Math.random() * 50, col: TEAM_COLORS[i % TEAM_COLORS.length] });
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", size); burst = () => {}; };
  }, []);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
