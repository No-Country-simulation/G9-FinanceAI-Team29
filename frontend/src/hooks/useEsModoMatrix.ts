import { useLocation } from "react-router";

/**
 * true cuando el usuario está en /modo-matrix. Se usa para teñir de rojo
 * los elementos compartidos del layout (header, sidebar, widgets flotantes)
 * únicamente en esa página, sin afectar al resto de la app ni al tema oscuro.
 */
export function useEsModoMatrix(): boolean {
  return useLocation().pathname === "/modo-matrix";
}
