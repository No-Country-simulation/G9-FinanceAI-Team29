import { useEffect, useState } from "react";

const COMANDO_CAT = "cat main.py";
const COMANDO_RUN = "python main.py";
const SALIDA = "Hola, soy Finsi. ¿Reviso tus finanzas?";
const VELOCIDAD_TIPEO_MS = 45;

type Fase = "tipeando-cat" | "mostrando-archivo" | "tipeando-run" | "mostrando-salida" | "listo";

/** Animación de terminal para el easter egg "hello world". */
export default function TerminalDemo() {
  const [fase, setFase] = useState<Fase>("tipeando-cat");
  const [tipeadoCat, setTipeadoCat] = useState("");
  const [tipeadoRun, setTipeadoRun] = useState("");

  useEffect(() => {
    if (fase !== "tipeando-cat") return;
    if (tipeadoCat.length < COMANDO_CAT.length) {
      const t = setTimeout(
        () => setTipeadoCat(COMANDO_CAT.slice(0, tipeadoCat.length + 1)),
        VELOCIDAD_TIPEO_MS,
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setFase("mostrando-archivo"), 400);
    return () => clearTimeout(t);
  }, [fase, tipeadoCat]);

  useEffect(() => {
    if (fase !== "mostrando-archivo") return;
    const t = setTimeout(() => setFase("tipeando-run"), 900);
    return () => clearTimeout(t);
  }, [fase]);

  useEffect(() => {
    if (fase !== "tipeando-run") return;
    if (tipeadoRun.length < COMANDO_RUN.length) {
      const t = setTimeout(
        () => setTipeadoRun(COMANDO_RUN.slice(0, tipeadoRun.length + 1)),
        VELOCIDAD_TIPEO_MS,
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setFase("mostrando-salida"), 400);
    return () => clearTimeout(t);
  }, [fase, tipeadoRun]);

  useEffect(() => {
    if (fase !== "mostrando-salida") return;
    const t = setTimeout(() => setFase("listo"), 300);
    return () => clearTimeout(t);
  }, [fase]);

  const mostrarArchivo =
    fase === "mostrando-archivo" || fase === "tipeando-run" || fase === "mostrando-salida" || fase === "listo";
  const mostrarSegundoPrompt = fase === "tipeando-run" || fase === "mostrando-salida" || fase === "listo";
  const mostrarSalida = fase === "mostrando-salida" || fase === "listo";

  return (
    <div className="mt-2 w-full max-w-md overflow-hidden rounded-lg border border-gray-700 bg-[#0d1117] font-mono text-[13px] text-gray-200 shadow-lg">
      <div className="flex items-center gap-1.5 border-b border-gray-700 bg-[#161b22] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-2 text-[11px] text-gray-400">finsi@sandbox: ~/finsight</span>
      </div>

      <div className="space-y-1 px-3 py-3">
        <div>
          <span className="text-[#58a6ff]">finsi@sandbox</span>
          <span className="text-gray-400">:~/finsight$ </span>
          <span>{tipeadoCat}</span>
          {fase === "tipeando-cat" && <span className="animate-pulse">▋</span>}
        </div>

        {mostrarArchivo && (
          <div className="my-1 rounded border border-gray-700 bg-black/30 px-2 py-1.5">
            <div className="mb-1 text-[11px] text-gray-500"># main.py</div>
            <div>
              <span className="text-[#ff7b72]">print</span>
              <span className="text-gray-300">(</span>
              <span className="text-[#a5d6ff]">&quot;Hola, soy Finsi. ¿Reviso tus finanzas?&quot;</span>
              <span className="text-gray-300">)</span>
            </div>
          </div>
        )}

        {mostrarSegundoPrompt && (
          <div>
            <span className="text-[#58a6ff]">finsi@sandbox</span>
            <span className="text-gray-400">:~/finsight$ </span>
            <span>{tipeadoRun}</span>
            {fase === "tipeando-run" && <span className="animate-pulse">▋</span>}
          </div>
        )}

        {mostrarSalida && <div className="text-[#7ee787]">{SALIDA}</div>}

        {fase === "listo" && (
          <div className="mt-1">
            <span className="text-[#58a6ff]">finsi@sandbox</span>
            <span className="text-gray-400">:~/finsight$ </span>
            <span className="animate-pulse">▋</span>
          </div>
        )}
      </div>
    </div>
  );
}
