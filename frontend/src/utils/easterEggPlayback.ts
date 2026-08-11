// Registro centralizado de los easter eggs con video/audio que están sonando
// o animándose en el chat. Permite que, al disparar un easter egg nuevo,
// cualquier easter egg anterior (de otro mensaje) se detenga y congele en su
// último frame en vez de seguir sonando/animando en paralelo.
type DetenerHandler = () => void;

interface EntradaActiva {
  messageId: number;
  detener: DetenerHandler;
}

let siguienteToken = 0;
const handlersActivos = new Map<number, EntradaActiva>();

/**
 * Detiene y desregistra cualquier easter egg activo que pertenezca a un
 * mensaje distinto de `messageId`. Debe llamarse al montar cada pieza de un
 * easter egg (audio o visual) para que el anterior se corte al instante.
 */
export function detenerOtrosEasterEggs(messageId: number): void {
  for (const [token, entrada] of handlersActivos) {
    if (entrada.messageId !== messageId) {
      entrada.detener();
      handlersActivos.delete(token);
    }
  }
}

/**
 * Registra el "detener" de una pieza de easter egg (un <audio> o el video
 * visual) asociada a `messageId`. Devuelve una función para desregistrarla,
 * pensada para usarse como cleanup de un useEffect.
 */
export function registrarEasterEgg(messageId: number, detener: DetenerHandler): () => void {
  const token = siguienteToken++;
  handlersActivos.set(token, { messageId, detener });

  return () => {
    handlersActivos.delete(token);
  };
}
