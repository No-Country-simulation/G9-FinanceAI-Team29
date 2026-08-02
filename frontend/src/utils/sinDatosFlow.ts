import { obtenerPerfilCompleto } from "../services/api";

const PATRON_SIN_DATOS = /no posee transacciones/i;

/** El backend responde 400 con este mensaje cuando el usuario no tiene
 * movimientos cargados; se usa para distinguir ese caso de otros errores. */
export function esErrorSinDatos(mensaje: string): boolean {
  return PATRON_SIN_DATOS.test(mensaje);
}

export const MENSAJE_SIN_DATOS =
  "No es posible realizar tu solicitud, no tienes datos ingresados. ¿Deseas ingresar datos?";

export const MENSAJE_OTRA_CONSULTA = "¿Deseas hacer otra consulta?";

export async function construirMensajeDespedida(
  usuarioId: string,
  email: string | null,
): Promise<string> {
  let identificacion = email ?? usuarioId;
  try {
    const perfil = await obtenerPerfilCompleto(usuarioId);
    const nombreCompleto = [perfil.nombre, perfil.apellido].filter(Boolean).join(" ").trim();
    identificacion = nombreCompleto || perfil.email || email || usuarioId;
  } catch {
    // Si no se puede cargar el perfil, se usa el correo o el ID como respaldo.
  }
  return `¡Gracias por tu visita, ${identificacion}! Tu sesión con Finsi ha finalizado.`;
}
