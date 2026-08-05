import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  obtenerPerfilCompleto,
  obtenerTransacciones,
  PerfilCompleto,
} from '../services/api';
import type { ResumenTransacciones, Transaccion } from '../types/finance';
import { useAuth } from './AuthContext';

interface PerfilDataContextValue {
  perfil: PerfilCompleto | null;
  transacciones: Transaccion[];
  resumen: ResumenTransacciones;
  /** Solo true mientras se está resolviendo la primera carga para el usuario actual. */
  loading: boolean;
  refrescar: () => Promise<void>;
  actualizarPerfilLocal: (cambios: Partial<PerfilCompleto>) => void;
  /** @internal usado por usePerfilData para disparar la carga perezosa. */
  asegurarCargado: () => void;
}

const PerfilDataContext = createContext<PerfilDataContextValue | undefined>(undefined);

function calcularResumen(transacciones: Transaccion[]): ResumenTransacciones {
  const porCategoria: Record<string, number> = {};
  let totalGastos = 0;
  let totalIngresos = 0;

  for (const t of transacciones) {
    const monto = Number(t.monto);

    if (t.tipo === 'Gasto') {
      totalGastos += monto;
      porCategoria[t.categoria] = (porCategoria[t.categoria] ?? 0) + monto;
    } else if (t.tipo === 'Ingreso') {
      totalIngresos += monto;
    }
  }

  return { totalGastos, totalIngresos, porCategoria, cantidadTransacciones: transacciones.length };
}

/**
 * Cachea perfil + transacciones del usuario mientras dure la sesión, pero la
 * carga es PEREZOSA: no dispara nada hasta que algún componente use
 * usePerfilData() por primera vez (ej. al entrar a /profile). Así no compite
 * con los fetches propios de otras páginas (Análisis, Recomendaciones, etc.)
 * que no consumen este contexto. Como el estado vive en el provider (por
 * encima de las rutas), volver a /profile en la misma sesión no repite la
 * carga ni muestra el skeleton de nuevo.
 */
export function PerfilDataProvider({ children }: { children: ReactNode }) {
  const { usuarioId } = useAuth();
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(false);
  const cargadoParaRef = useRef<string | null>(null);
  const cargandoParaRef = useRef<string | null>(null);

  const cargar = useCallback(async (id: string) => {
    const [perfilData, transaccionesData] = await Promise.all([
      obtenerPerfilCompleto(id),
      obtenerTransacciones(id),
    ]);

    setPerfil(perfilData);
    setTransacciones(transaccionesData);
    cargadoParaRef.current = id;
  }, []);

  // Si cambia (o se pierde) el usuario activo, se invalida el caché.
  useEffect(() => {
    if (cargadoParaRef.current && cargadoParaRef.current !== usuarioId) {
      setPerfil(null);
      setTransacciones([]);
      cargadoParaRef.current = null;
    }

    if (!usuarioId) {
      setPerfil(null);
      setTransacciones([]);
      cargadoParaRef.current = null;
      cargandoParaRef.current = null;
    }
  }, [usuarioId]);

  const asegurarCargado = useCallback(() => {
    if (!usuarioId) return;
    if (cargadoParaRef.current === usuarioId) return;
    if (cargandoParaRef.current === usuarioId) return;

    cargandoParaRef.current = usuarioId;
    setLoading(true);
    cargar(usuarioId)
      .catch((error) => {
        console.error('No se pudo cargar el perfil del usuario:', error);
      })
      .finally(() => {
        cargandoParaRef.current = null;
        setLoading(false);
      });
  }, [usuarioId, cargar]);

  const refrescar = useCallback(async () => {
    if (!usuarioId) return;
    await cargar(usuarioId);
  }, [usuarioId, cargar]);

  const actualizarPerfilLocal = useCallback((cambios: Partial<PerfilCompleto>) => {
    setPerfil((actual) => (actual ? { ...actual, ...cambios } : actual));
  }, []);

  const resumen = useMemo(() => calcularResumen(transacciones), [transacciones]);

  const value = useMemo<PerfilDataContextValue>(
    () => ({ perfil, transacciones, resumen, loading, refrescar, actualizarPerfilLocal, asegurarCargado }),
    [perfil, transacciones, resumen, loading, refrescar, actualizarPerfilLocal, asegurarCargado],
  );

  return (
    <PerfilDataContext.Provider value={value}>
      {children}
    </PerfilDataContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePerfilData() {
  const ctx = useContext(PerfilDataContext);

  if (!ctx) {
    throw new Error('usePerfilData debe usarse dentro de <PerfilDataProvider>');
  }

  useEffect(() => {
    ctx.asegurarCargado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.asegurarCargado]);

  return ctx;
}
