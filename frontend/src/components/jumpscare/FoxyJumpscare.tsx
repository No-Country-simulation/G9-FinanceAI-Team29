// ============================================================================
//  FoxyJumpscare  —  MÓDULO 100% AISLADO (broma / jumpscare)
// ----------------------------------------------------------------------------
//  Qué hace: cuenta N segundos DESDE que el usuario interactúa por primera vez
//  (clic o tecla en el login). Al terminar, muestra a Foxy a pantalla completa
//  con sonido. Arrancar tras el primer gesto garantiza que el audio suene
//  (los navegadores solo permiten audio tras una interacción real).
//
//  ATAJO:  Ctrl + M  -> activa / desactiva el jumpscare en caliente.
//
//  No toca el backend ni ningún estado global.
//
//  CÓMO BORRARLO (deja el proyecto exactamente igual que antes):
//    1. Borra esta carpeta:  src/components/jumpscare/
//    2. En  src/pages/AuthPages/SignIn.tsx  quita las 2 líneas marcadas
//       con el comentario  // [JUMPSCARE]
//    3. (Opcional) borra  public/jumpscare/
//
//  ASSETS (en  frontend/public/jumpscare/ ):
//    - foxy.gif  (o .png) -> imagen que aparece
//    - foxy.mp3           -> sonido del susto  (OPCIONAL)
// ============================================================================

import { useEffect, useRef, useState } from "react";

// ----- CONFIG (edita libremente) --------------------------------------------
const TEST_MODE = true; // <- PONLO EN false cuando termines de probar
const DELAY_MS = TEST_MODE ? 10_000 : 20_000; // cuenta desde el 1er gesto
const IMAGE_SRC = "/jumpscare/foxy.gif"; // ruta dentro de /public
const SOUND_SRC = "/jumpscare/foxy.mp3"; // deja "" si no quieres sonido
const VISIBLE_MS = 2500; // cuánto dura el susto en pantalla (ms)
// ----------------------------------------------------------------------------

export default function FoxyJumpscare() {
  const [active, setActive] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(true); // Ctrl+M lo cambia
  const armedRef = useRef(false); // ¿ya arrancó la cuenta atrás?

  useEffect(() => {
    if (SOUND_SRC) {
      audioRef.current = new Audio(SOUND_SRC);
      audioRef.current.preload = "auto";
    }

    let showTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;

    // Avisito breve en pantalla (para el toggle) sin ensuciar el render React
    const toast = (msg: string) => {
      const el = document.createElement("div");
      el.textContent = msg;
      Object.assign(el.style, {
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: "10px 18px",
        borderRadius: "10px",
        fontSize: "14px",
        fontFamily: "system-ui, sans-serif",
        zIndex: "1000000",
        pointerEvents: "none",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      } as CSSStyleDeclaration);
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    };

    const playAudio = () => {
      const a = audioRef.current;
      if (!a) return;
      a.muted = false;
      a.volume = 1;
      a.currentTime = 0;
      a.play().catch(() => {});
    };

    const fire = () => {
      if (!enabledRef.current) return;
      setActive(true);
      playAudio();
      hideTimer = setTimeout(() => setActive(false), VISIBLE_MS);
    };

    // Desbloquea el audio con el gesto y arranca la cuenta atrás (solo 1 vez)
    const arm = () => {
      if (armedRef.current || !enabledRef.current) return;
      armedRef.current = true;

      // Desbloqueo de audio: reproducir en silencio dentro del gesto y pausar
      const a = audioRef.current;
      if (a) {
        a.muted = true;
        a.play()
          .then(() => {
            a.pause();
            a.currentTime = 0;
            a.muted = false;
          })
          .catch(() => {});
      }

      showTimer = setTimeout(fire, DELAY_MS);
    };

    const onGesture = () => arm();

    const onToggle = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "m" || e.key === "M")) {
        e.preventDefault();
        enabledRef.current = !enabledRef.current;
        if (!enabledRef.current) {
          clearTimeout(showTimer);
          clearTimeout(hideTimer);
          setActive(false);
          armedRef.current = false; // permite re-armar al reactivar
          toast("🦊 Jumpscare DESACTIVADO");
        } else {
          toast("🦊 Jumpscare ACTIVADO");
          // se re-armará con el próximo clic/tecla
        }
      }
    };

    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("keydown", onToggle);

    // Disparador manual de prueba (solo TEST_MODE): en consola -> __foxyNow()
    if (TEST_MODE) {
      (window as unknown as { __foxyNow?: () => void }).__foxyNow = () => {
        setActive(true);
        playAudio();
      };
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("keydown", onToggle);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (!active) return null;

  return (
    <div
      onClick={() => setActive(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        animation: "foxy-shake 0.08s infinite",
      }}
    >
      {imgOk ? (
        <img
          src={IMAGE_SRC}
          alt=""
          onError={() => setImgOk(false)}
          style={{
            width: "100vw",
            height: "100vh",
            objectFit: "contain",
            animation: "foxy-pop 0.25s ease-out",
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
      ) : (
        <div
          style={{
            color: "#ff2222",
            fontSize: "18vw",
            fontWeight: 900,
            fontFamily: "Impact, system-ui, sans-serif",
            textShadow: "0 0 30px #ff0000",
            animation: "foxy-pop 0.25s ease-out",
            userSelect: "none",
          }}
        >
          FOXY
        </div>
      )}
      <style>{`
        @keyframes foxy-shake {
          0%   { transform: translate(0, 0); }
          25%  { transform: translate(-12px, 8px); }
          50%  { transform: translate(10px, -10px); }
          75%  { transform: translate(-8px, -6px); }
          100% { transform: translate(0, 0); }
        }
        @keyframes foxy-pop {
          0%   { transform: scale(0.2); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
