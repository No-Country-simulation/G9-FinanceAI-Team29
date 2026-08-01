import { useEffect, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";

interface Nodo {
  radioBase: number;
  angulo: number;
  velocidadAngular: number;
  velocidadRadial: number;
  tamano: number;
}

const PALETA = {
  light: {
    fondo: "rgba(255, 255, 255, 0)",
    nodos: ["#465fff", "#7592ff", "#0ba5ec", "#12b76a", "#f79009"],
    lineas: "70, 95, 255",
  },
  dark: {
    fondo: "rgba(11, 13, 33, 0)",
    nodos: ["#7592ff", "#9cb9ff", "#36bffa", "#32d583", "#fdb022"],
    lineas: "117, 146, 255",
  },
};

export default function GraphSpiralBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let ancho = 0;
    let alto = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const NUM_NODOS = 60;
    const nodos: Nodo[] = Array.from({ length: NUM_NODOS }, (_, i) => ({
      radioBase: (i / NUM_NODOS) * 0.9 + 0.05,
      angulo: (i / NUM_NODOS) * Math.PI * 10,
      velocidadAngular: 0.06 + Math.random() * 0.05,
      velocidadRadial: 0.15 + Math.random() * 0.1,
      tamano: 2.5 + Math.random() * 3.5,
    }));

    const ajustarTamano = () => {
      const rect = canvas.getBoundingClientRect();
      ancho = rect.width;
      alto = rect.height;
      canvas.width = ancho * dpr;
      canvas.height = alto * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ajustarTamano();

    const resizeObserver = new ResizeObserver(ajustarTamano);
    resizeObserver.observe(canvas);

    let raf = 0;
    let tiempo = 0;

    const dibujar = () => {
      const colores = theme === "dark" ? PALETA.dark : PALETA.light;
      tiempo += 0.006;
      ctx.clearRect(0, 0, ancho, alto);

      const cx = ancho / 2;
      const cy = alto / 2;
      const radioMax = Math.min(ancho, alto) * 0.62;

      const posiciones = nodos.map((n) => {
        const espiral = n.radioBase + Math.sin(tiempo * n.velocidadRadial + n.angulo) * 0.06;
        const angulo = n.angulo + tiempo * n.velocidadAngular * (n.radioBase > 0.5 ? 1 : -1);
        const r = espiral * radioMax;
        return {
          x: cx + Math.cos(angulo) * r,
          y: cy + Math.sin(angulo) * r * 0.85,
          tamano: n.tamano,
        };
      });

      for (let i = 0; i < posiciones.length; i++) {
        for (let j = i + 1; j < posiciones.length; j++) {
          const a = posiciones[i];
          const b = posiciones[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const distMax = radioMax * 0.28;
          if (dist < distMax) {
            const opacidad = (1 - dist / distMax) * 0.6;
            ctx.strokeStyle = `rgba(${colores.lineas}, ${opacidad})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      posiciones.forEach((p, i) => {
        const color = colores.nodos[i % colores.nodos.length];
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 1;
        ctx.arc(p.x, p.y, p.tamano, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      raf = requestAnimationFrame(dibujar);
    };
    raf = requestAnimationFrame(dibujar);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [theme]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full blur-[0.5px]" />
      <div className="absolute inset-0 bg-gradient-to-r from-white/70 via-white/15 to-transparent dark:from-gray-900/70 dark:via-gray-900/10 dark:to-transparent" />
    </div>
  );
}
