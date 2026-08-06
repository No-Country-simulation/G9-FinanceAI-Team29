import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGamification } from '../../context/GamificationContext';
import {
  obtenerMetas,
  obtenerResumen,
  obtenerTransacciones,
  obtenerUsuario,
} from '../../services/api';
import {
  buildFinancialNotifications,
  FinancialNotification,
} from '../../utils/financialNotifications';
import { Dropdown } from '../ui/dropdown/Dropdown';
import { DropdownItem } from '../ui/dropdown/DropdownItem';

const storageKey = (usuarioId: string) =>
  `finsight:notifications:read:${usuarioId}`;

function readStoredIds(usuarioId: string): string[] {
  try {
    const storedValue = localStorage.getItem(storageKey(usuarioId));
    if (!storedValue) return [];

    const parsedValue: unknown = JSON.parse(storedValue);
    return Array.isArray(parsedValue)
      ? parsedValue.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

export default function NotificationDropdown() {
  const { usuarioId } = useAuth();
  const { health, subioNivelRecientemente } = useGamification();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<FinancialNotification[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => readStoredIds(usuarioId));
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setHasError(false);

    const [profileResult, summaryResult, transactionsResult, goalsResult] =
      await Promise.allSettled([
        obtenerUsuario(usuarioId),
        obtenerResumen(usuarioId),
        obtenerTransacciones(usuarioId),
        obtenerMetas(usuarioId),
      ]);

    const allFailed = [
      profileResult,
      summaryResult,
      transactionsResult,
      goalsResult,
    ].every((result) => result.status === 'rejected');

    if (allFailed) {
      setNotifications([]);
      setHasError(true);
      setLoading(false);
      return;
    }

    setNotifications(
      buildFinancialNotifications({
        perfil: profileResult.status === 'fulfilled' ? profileResult.value : undefined,
        resumen: summaryResult.status === 'fulfilled' ? summaryResult.value : undefined,
        transacciones:
          transactionsResult.status === 'fulfilled'
            ? transactionsResult.value
            : undefined,
        metas: goalsResult.status === 'fulfilled' ? goalsResult.value : undefined,
        nivel: { level: health.level, titulo: health.titulo, subioRecientemente: subioNivelRecientemente },
      }),
    );
    setLoading(false);
  }, [usuarioId, health.level, health.titulo, subioNivelRecientemente]);

  useEffect(() => {
    setReadIds(readStoredIds(usuarioId));
    void loadNotifications();
  }, [loadNotifications, usuarioId]);

  const unreadIds = useMemo(
    () =>
      notifications
        .filter((notification) => !readIds.includes(notification.id))
        .map((notification) => notification.id),
    [notifications, readIds],
  );

  const markAllAsRead = () => {
    if (unreadIds.length === 0) return;

    const updatedIds = Array.from(new Set([...readIds, ...unreadIds]));
    setReadIds(updatedIds);
    localStorage.setItem(storageKey(usuarioId), JSON.stringify(updatedIds));
  };

  const toggleDropdown = () => {
    const willOpen = !isOpen;
    setIsOpen(willOpen);
    if (willOpen) markAllAsRead();
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="dropdown-toggle relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={toggleDropdown}
        aria-label={
          unreadIds.length > 0
            ? `${unreadIds.length} notificaciones sin leer`
            : 'Notificaciones'
        }
      >
        {unreadIds.length > 0 && (
          <span className="absolute right-0 top-0.5 z-10 flex h-2 w-2 rounded-full bg-orange-400">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
          </span>
        )}

        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="max-sm:left-0 max-sm:right-auto max-sm:w-[75vw] max-sm:max-w-[300px] absolute right-0 mt-[17px] flex h-[480px] w-[calc(100vw-2rem)] max-w-[361px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700">
          <div>
            <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Notificaciones
            </h5>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Perfil {usuarioId}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Cerrar notificaciones"
          >
            <svg
              className="fill-current"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-gray-500">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              Calculando alertas…
            </div>
          ) : hasError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                No fue posible cargar los datos financieros.
              </span>
              <button
                type="button"
                onClick={() => void loadNotifications()}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Reintentar
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-full items-center justify-center px-5 text-center text-sm text-gray-500 dark:text-gray-400">
              No hay alertas financieras para ti en este momento, prueba subiendo datos en importar csv.
            </div>
          ) : (
            <ul className="flex flex-col">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <DropdownItem
                    onItemClick={() => setIsOpen(false)}
                    className="flex gap-3 rounded-lg border-b border-gray-100 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
                  >
                    <span
                      className={`relative z-1 flex h-10 max-w-10 shrink-0 items-center justify-center rounded-full text-lg font-semibold ${notification.iconBg}`}
                      aria-hidden="true"
                    >
                      {notification.icono}
                    </span>

                    <span className="block min-w-0">
                      <span className="mb-1.5 block text-theme-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-800 dark:text-white/90">
                          {notification.titulo}
                        </span>
                        <span className="mt-0.5 block">{notification.detalle}</span>
                      </span>

                      <span className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
                        <span>{notification.tipo}</span>
                        <span className="h-1 w-1 rounded-full bg-gray-400" />
                        <span>{notification.tiempo}</span>
                      </span>
                    </span>
                  </DropdownItem>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => void loadNotifications()}
          disabled={loading}
          className="mt-3 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-wait disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          Actualizar notificaciones
        </button>
      </Dropdown>
    </div>
  );
}
