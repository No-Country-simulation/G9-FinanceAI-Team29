import { useEffect, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";

interface Punto {
  x: number;
  y: number;
}

const PALETA = {
  light: { nodos: ["#465fff", "#7592ff", "#0ba5ec", "#12b76a"], lineas: "70, 95, 255" },
  dark: { nodos: ["#7592ff", "#9cb9ff", "#36bffa", "#32d583"], lineas: "117, 146, 255" },
};

const PUNTOS_POR_HEBRA = 26;
const LONGITUD_HEBRA = 0.62; // fracción de la diagonal que ocupa cada hebra de ADN

export default function TeamGraphBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let ancho = 0;
    let alto = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

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

    // Dibuja una hebra de ADN (doble hélice) que nace en una esquina y se
    // desvanece hacia el centro, girando sobre su propio eje con el tiempo.
    const dibujarHebra = (cx0: number, cy0: number, dirX: number, dirY: number) => {
      const colores = theme === "dark" ? PALETA.dark : PALETA.light;
      const diag = Math.sqrt(ancho * ancho + alto * alto);
      const tramo = diag * LONGITUD_HEBRA;
      const normalX = -dirY;
      const normalY = dirX;
      const amplitud = Math.min(28, ancho * 0.06);
      const frecuencia = 7;

      const hebraA: Punto[] = [];
      const hebraB: Punto[] = [];

      for (let i = 0; i <= PUNTOS_POR_HEBRA; i++) {
        const t = i / PUNTOS_POR_HEBRA;
        const dist = t * tramo;
        const fase = t * frecuencia + tiempo;
        const baseX = cx0 + dirX * dist;
        const baseY = cy0 + dirY * dist;
        const desplazA = Math.sin(fase) * amplitud;
        const desplazB = Math.sin(fase + Math.PI) * amplitud;
        hebraA.push({ x: baseX + normalX * desplazA, y: baseY + normalY * desplazA });
        hebraB.push({ x: baseX + normalX * desplazB, y: baseY + normalY * desplazB });
      }

      const opacidadEn = (t: number) => Math.max(0, 1 - t * 1.15) * 0.55;

      for (let i = 0; i < hebraA.length; i += 2) {
        const o = opacidadEn(i / PUNTOS_POR_HEBRA);
        if (o <= 0.02) continue;
        ctx.strokeStyle = `rgba(${colores.lineas}, ${o * 0.7})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hebraA[i].x, hebraA[i].y);
        ctx.lineTo(hebraB[i].x, hebraB[i].y);
        ctx.stroke();
      }

      [hebraA, hebraB].forEach((hebra) => {
        for (let i = 0; i < hebra.length - 1; i++) {
          const o = opacidadEn(i / PUNTOS_POR_HEBRA);
          if (o <= 0.02) continue;
          ctx.strokeStyle = `rgba(${colores.lineas}, ${o})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(hebra[i].x, hebra[i].y);
          ctx.lineTo(hebra[i + 1].x, hebra[i + 1].y);
          ctx.stroke();
        }
      });

      [hebraA, hebraB].forEach((hebra, hi) => {
        hebra.forEach((p, i) => {
          const o = opacidadEn(i / PUNTOS_POR_HEBRA);
          if (o <= 0.05) return;
          const color = colores.nodos[(i + hi) % colores.nodos.length];
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.globalAlpha = o;
          ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
          ctx.fill();
        });
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    const dibujar = () => {
      tiempo += 0.02;
      ctx.clearRect(0, 0, ancho, alto);
      dibujarHebra(0, 0, 1, 0.7);
      dibujarHebra(ancho, alto, -1, -0.7);
      raf = requestAnimationFrame(dibujar);
    };
    raf = requestAnimationFrame(dibujar);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full blur-[0.5px] motion-reduce:hidden"
    />
  );
}
