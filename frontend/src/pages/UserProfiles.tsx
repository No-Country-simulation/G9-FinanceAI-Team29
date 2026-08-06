import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import PageBreadcrumb from '../components/common/PageBreadCrumb';
import PageMeta from '../components/common/PageMeta';
import Input from '../components/form/input/InputField';
import Label from '../components/form/Label';
import Button from '../components/ui/button/Button';
import { Modal } from '../components/ui/modal';
import { useModal } from '../hooks/useModal';
import { useAuth } from '../context/AuthContext';
import { usePerfilData } from '../context/PerfilDataContext';
import { actualizarPerfil, darDeBajaCuenta } from '../services/api';
import { supabase } from '../services/supabase';
import UserAvatar from '../components/common/UserAvatar';
import LevelCard from '../components/gamificacion/LevelCard';
import { useGamification } from '../context/GamificationContext';
import { AVATAR_OPTIONS } from '../utils/avatarOptions';
import { exportToPdf } from '../utils/export/exportPdf';
import { formatMoney, formatPercent } from '../utils/export/format';
import { fetchLogoBase64 } from '../utils/export/theme';
import {
  actualizarCoincidenciaPassword,
  actualizarFuerzaPassword,
  crearHtmlCoincidenciaPassword,
  crearHtmlFuerzaPassword,
} from '../utils/passwordSwalStrength';

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

function ActionButton({
  children,
  onClick,
  danger = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? 'border-error-300 text-error-600 hover:bg-error-50 dark:border-error-800 dark:text-error-400 dark:hover:bg-error-500/10'
          : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.04]'
      }`}
    >
      {children}
    </button>
  );
}

function DatoCampo({ etiqueta, valor }: { etiqueta: string; valor: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">{etiqueta}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{valor}</p>
    </div>
  );
}

function FilaAjuste({
  titulo,
  descripcion,
  accion,
}: {
  titulo: string;
  descripcion: string;
  accion: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 py-4 last:border-b-0 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">{titulo}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{descripcion}</p>
      </div>
      {accion}
    </div>
  );
}

const WarningIcon = () => (
  <svg className="fill-current" width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10 1.667c.363 0 .698.194.878.51l8.333 14.583a1 1 0 0 1-.868 1.5H1.657a1 1 0 0 1-.868-1.5L9.122 2.177c.18-.316.515-.51.878-.51Zm0 6.166a.75.75 0 0 0-.75.75v3.334a.75.75 0 0 0 1.5 0V8.583a.75.75 0 0 0-.75-.75Zm0 6.417a.917.917 0 1 0 0 1.833.917.917 0 0 0 0-1.833Z"
      fill=""
    />
  </svg>
);

const EYE_ICON_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.0002 13.8619C7.23361 13.8619 4.86803 12.1372 3.92328 9.70241C4.86804 7.26761 7.23361 5.54297 10.0002 5.54297C12.7667 5.54297 15.1323 7.26762 16.0771 9.70243C15.1323 12.1372 12.7667 13.8619 10.0002 13.8619ZM10.0002 4.04297C6.48191 4.04297 3.49489 6.30917 2.4155 9.4593C2.3615 9.61687 2.3615 9.78794 2.41549 9.94552C3.49488 13.0957 6.48191 15.3619 10.0002 15.3619C13.5184 15.3619 16.5055 13.0957 17.5849 9.94555C17.6389 9.78797 17.6389 9.6169 17.5849 9.45932C16.5055 6.30919 13.5184 4.04297 10.0002 4.04297ZM9.99151 7.84413C8.96527 7.84413 8.13333 8.67606 8.13333 9.70231C8.13333 10.7286 8.96527 11.5605 9.99151 11.5605H10.0064C11.0326 11.5605 11.8646 10.7286 11.8646 9.70231C11.8646 8.67606 11.0326 7.84413 10.0064 7.84413H9.99151Z" fill="#667085"/></svg>';

const EYE_CLOSE_ICON_SVG = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.63803 3.57709C4.34513 3.2842 3.87026 3.2842 3.57737 3.57709C3.28447 3.86999 3.28447 4.34486 3.57737 4.63775L4.85323 5.91362C3.74609 6.84199 2.89363 8.06395 2.4155 9.45936C2.3615 9.61694 2.3615 9.78801 2.41549 9.94558C3.49488 13.0957 6.48191 15.3619 10.0002 15.3619C11.255 15.3619 12.4422 15.0737 13.4994 14.5598L15.3625 16.4229C15.6554 16.7158 16.1302 16.7158 16.4231 16.4229C16.716 16.13 16.716 15.6551 16.4231 15.3622L4.63803 3.57709ZM12.3608 13.4212L10.4475 11.5079C10.3061 11.5423 10.1584 11.5606 10.0064 11.5606H9.99151C8.96527 11.5606 8.13333 10.7286 8.13333 9.70237C8.13333 9.5461 8.15262 9.39434 8.18895 9.24933L5.91885 6.97923C5.03505 7.69015 4.34057 8.62704 3.92328 9.70247C4.86803 12.1373 7.23361 13.8619 10.0002 13.8619C10.8326 13.8619 11.6287 13.7058 12.3608 13.4212ZM16.0771 9.70249C15.7843 10.4569 15.3552 11.1432 14.8199 11.7311L15.8813 12.7925C16.6329 11.9813 17.2187 11.0143 17.5849 9.94561C17.6389 9.78803 17.6389 9.61696 17.5849 9.45938C16.5055 6.30925 13.5184 4.04303 10.0002 4.04303C9.13525 4.04303 8.30244 4.17999 7.52218 4.43338L8.75139 5.66259C9.1556 5.58413 9.57311 5.54303 10.0002 5.54303C12.7667 5.54303 15.1323 7.26768 16.0771 9.70249Z" fill="#667085"/></svg>';

const EditIcon = () => (
  <svg className="fill-current" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
      fill=""
    />
  </svg>
);

function coloresPerfil(perfilFinanciero: string) {
  switch (perfilFinanciero) {
    case 'Saludable':
      return 'text-success-600 bg-success-50 dark:bg-success-500/10';
    case 'En observación':
      return 'text-warning-600 bg-warning-50 dark:bg-warning-500/10';
    case 'En riesgo':
      return 'text-error-600 bg-error-50 dark:bg-error-500/10';
    default:
      return 'text-gray-600 bg-gray-50 dark:bg-gray-500/10';
  }
}

function coloresEstado(estado: string) {
  switch (estado) {
    case 'ACTIVO':
      return 'text-success-600 bg-success-50 dark:bg-success-500/10';
    case 'INACTIVO':
      return 'text-warning-600 bg-warning-50 dark:bg-warning-500/10';
    case 'ELIMINADO':
      return 'text-error-600 bg-error-50 dark:bg-error-500/10';
    default:
      return 'text-gray-600 bg-gray-50 dark:bg-gray-500/10';
  }
}

function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6 ${className}`}>
      <div className="flex items-center gap-5">
        <div className="h-20 w-20 shrink-0 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-6 dark:border-gray-800 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </div>
  );
}

function PerfilSkeleton() {
  return (
    <>
      <PageMeta title="Mi cuenta | FinSightAI" description="Perfil y opciones de cuenta" />
      <PageBreadcrumb pageTitle="Mi cuenta" />
      <div className="space-y-6">
        <SkeletonCard />
        <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <div className="mb-6 h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
              </div>
            ))}
          </div>
          <div className="mt-6 h-2 w-full rounded-full bg-gray-200 pt-4 dark:bg-gray-700" />
        </div>
        <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <div className="mb-2 h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-64 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </>
  );
}

export default function UserProfiles() {
  const { usuarioId, email, avatarIcon, signOut, refreshSession } = useAuth();
  const { perfil, transacciones, resumen, loading, actualizarPerfilLocal } = usePerfilData();
  const { health, puntos, rangoPuntos } = useGamification();
  const { isOpen, openModal, closeModal } = useModal();
  const [guardando, setGuardando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [correo, setCorreo] = useState('');
  const [avatarSeleccionado, setAvatarSeleccionado] = useState<string | null>(null);

  const nombreCompleto = useMemo(() => {
    const valor = `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim();
    return valor || email || 'Usuario de FinSightAI';
  }, [perfil, email]);

  const ingresoMensual = perfil?.ingresoMensual ?? 0;
  const ahorroEstimado = perfil?.ahorroMensualEstimado ?? 0;
  const porcentajeAhorro = ingresoMensual > 0 ? (ahorroEstimado / ingresoMensual) * 100 : 0;
  const ahorroNegativo = porcentajeAhorro < 0;
  const anchoBarraAhorro = Math.max(0, Math.min(100, Math.abs(porcentajeAhorro)));

  useEffect(() => {
    if (!perfil) return;

    setNombre(perfil.nombre ?? '');
    setApellido(perfil.apellido ?? '');
    setCorreo(perfil.email ?? '');
  }, [perfil]);

  const abrirEdicion = () => {
    setNombre(perfil?.nombre ?? '');
    setApellido(perfil?.apellido ?? '');
    setCorreo(perfil?.email ?? '');
    setAvatarSeleccionado(avatarIcon);
    openModal();
  };

  const guardarPerfil = async (event: FormEvent) => {
    event.preventDefault();
    setGuardando(true);

    try {
      await actualizarPerfil(usuarioId, { nombre, apellido, email: correo });

      if (avatarSeleccionado !== avatarIcon) {
        const { error } = await supabase.auth.updateUser({
          data: { avatar_icon: avatarSeleccionado },
        });
        if (error) throw error;
      }

      actualizarPerfilLocal({ nombre, apellido, email: correo });

      try {
        await refreshSession();
      } catch (error) {
        console.error('No se pudo refrescar la sesión tras actualizar el perfil:', error);
      }

      closeModal();
      await Swal.fire('Perfil actualizado', 'Tus datos fueron guardados.', 'success');
    } catch (error) {
      await Swal.fire('No se pudo guardar', error instanceof Error ? error.message : 'Error inesperado.', 'error');
    } finally {
      setGuardando(false);
    }
  };

  const campoPassword = (id: string, label: string, placeholder: string, autocomplete: string, extraHtml = '') => `
    <div style="text-align:left; margin-top:14px;">
      <label for="${id}" class="swal2-input-label" style="margin-top:0;">${label}</label>
      <div style="position:relative">
        <input id="${id}" type="password" class="swal2-input" placeholder="${placeholder}" style="margin:0.5em 0 0; padding-right:44px; width:100%; box-sizing:border-box;" autocomplete="${autocomplete}" />
        <button type="button" id="toggle-${id}" aria-label="Mostrar contraseña" style="position:absolute; right:10px; top:calc(50% + 4px); transform:translateY(-50%); background:none; border:none; padding:4px; cursor:pointer; line-height:0;">
          ${EYE_CLOSE_ICON_SVG}
        </button>
      </div>
      ${extraHtml}
    </div>
  `;

  const cambiarPassword = async () => {
    const idActual = 'swal-password-actual';
    const idNueva = 'swal-password-nueva';
    const idConfirmar = 'swal-password-confirmar';
    const idFuerza = 'swal-password-fuerza';
    const idCoincidencia = 'swal-password-coincidencia';

    const resultado = await Swal.fire({
      title: 'Cambiar contraseña',
      html:
        campoPassword(idActual, 'Contraseña actual', 'Tu contraseña actual', 'current-password') +
        campoPassword(idNueva, 'Nueva contraseña', 'Mínimo 8 caracteres', 'new-password', crearHtmlFuerzaPassword(idFuerza)) +
        campoPassword(idConfirmar, 'Repetir nueva contraseña', 'Repite la nueva contraseña', 'new-password', crearHtmlCoincidenciaPassword(idCoincidencia)),
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      didOpen: () => {
        [idActual, idNueva, idConfirmar].forEach((id) => {
          const input = document.getElementById(id) as HTMLInputElement | null;
          const toggle = document.getElementById(`toggle-${id}`) as HTMLButtonElement | null;

          toggle?.addEventListener('click', () => {
            if (!input) return;
            const mostrando = input.type === 'text';
            input.type = mostrando ? 'password' : 'text';
            toggle.innerHTML = mostrando ? EYE_CLOSE_ICON_SVG : EYE_ICON_SVG;
            toggle.setAttribute('aria-label', mostrando ? 'Mostrar contraseña' : 'Ocultar contraseña');
          });
        });

        const inputNueva = document.getElementById(idNueva) as HTMLInputElement | null;
        const inputConfirmar = document.getElementById(idConfirmar) as HTMLInputElement | null;

        inputNueva?.addEventListener('input', () => {
          actualizarFuerzaPassword(idFuerza, inputNueva.value);
          actualizarCoincidenciaPassword(idCoincidencia, inputNueva.value, inputConfirmar?.value ?? '');
        });

        inputConfirmar?.addEventListener('input', () => {
          actualizarCoincidenciaPassword(idCoincidencia, inputNueva?.value ?? '', inputConfirmar.value);
        });

        (document.getElementById(idActual) as HTMLInputElement | null)?.focus();
      },
      preConfirm: () => {
        const actual = (document.getElementById(idActual) as HTMLInputElement | null)?.value ?? '';
        const nueva = (document.getElementById(idNueva) as HTMLInputElement | null)?.value ?? '';
        const confirmar = (document.getElementById(idConfirmar) as HTMLInputElement | null)?.value ?? '';

        if (!actual) {
          Swal.showValidationMessage('Ingresa tu contraseña actual.');
          return false;
        }

        if (nueva.length < 8) {
          Swal.showValidationMessage('La nueva contraseña debe tener al menos 8 caracteres.');
          return false;
        }

        if (nueva === actual) {
          Swal.showValidationMessage('La nueva contraseña debe ser diferente de la actual.');
          return false;
        }

        return { actual, nueva, confirmar };
      },
    });

    if (!resultado.isConfirmed || !resultado.value) return;

    if (resultado.value.nueva !== resultado.value.confirmar) {
      await Swal.fire('Las contraseñas no coinciden', 'La nueva contraseña y su repetición deben ser iguales.', 'error');
      return cambiarPassword();
    }

    const correoActual = perfil?.email ?? email;

    if (!correoActual) {
      await Swal.fire('No se pudo verificar', 'No encontramos el correo de tu cuenta para validar la contraseña actual.', 'error');
      return;
    }

    const { error: errorVerificacion } = await supabase.auth.signInWithPassword({
      email: correoActual,
      password: resultado.value.actual,
    });

    if (errorVerificacion) {
      await Swal.fire('No se pudo cambiar', 'La contraseña actual no es correcta.', 'error');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: resultado.value.nueva });

    if (error) {
      await Swal.fire('No se pudo cambiar', error.message, 'error');
      return;
    }

    await Swal.fire('Contraseña actualizada', 'La nueva contraseña ya está activa.', 'success');
  };

  const cerrarSesionTodosDispositivos = async () => {
    const confirmacion = await Swal.fire({
      title: 'Cerrar sesión en todos los dispositivos',
      text: 'Se cerrará tu sesión en este y en cualquier otro dispositivo donde hayas iniciado sesión.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Cerrar sesiones',
      cancelButtonText: 'Cancelar',
    });

    if (!confirmacion.isConfirmed) return;

    const { error } = await supabase.auth.signOut({ scope: 'global' });

    if (error) {
      await Swal.fire('No se pudo completar', error.message, 'error');
      return;
    }

    window.location.assign('/signin');
  };

  const descargarCsv = () => {
    if (transacciones.length === 0) {
      void Swal.fire('Sin movimientos', 'Todavía no hay transacciones para exportar.', 'info');
      return;
    }

    const escaparCsv = (valor: unknown) => {
      const texto = String(valor ?? '');
      return `"${texto.replace(/"/g, '""')}"`;
    };

    const encabezados = ['fecha', 'descripcion', 'monto', 'tipo', 'categoria', 'medio_pago', 'recurrente'];
    const filas = transacciones.map((transaccion) => [
      transaccion.fecha,
      transaccion.descripcion,
      Number(transaccion.monto).toFixed(2),
      transaccion.tipo,
      transaccion.categoria,
      transaccion.medioPago ?? '',
      transaccion.recurrente ? 'Si' : 'No',
    ].map(escaparCsv).join(','));

    const contenido = `﻿${encabezados.join(',')}\n${filas.join('\n')}`;
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `movimientos_finsight_${usuarioId}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  };

  const compartirInforme = async () => {
    const texto = `Mi informe FinSightAI: perfil ${perfil?.perfilFinanciero ?? 'sin clasificar'}, ingresos ${money.format(resumen?.totalIngresos ?? 0)}, gastos ${money.format(resumen?.totalGastos ?? 0)}.`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'Informe FinSightAI', text: texto });
      } else {
        await navigator.clipboard.writeText(texto);
        await Swal.fire('Informe copiado', 'Puedes pegarlo donde quieras compartirlo.', 'success');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await Swal.fire('No se pudo compartir', 'Intenta nuevamente.', 'error');
    }
  };

  const descargarPdf = async () => {
    if (transacciones.length === 0) {
      await Swal.fire('Sin movimientos', 'Todavía no hay transacciones para exportar.', 'info');
      return;
    }

    try {
      const totalIngresos = resumen?.totalIngresos ?? 0;
      const totalGastos = resumen?.totalGastos ?? 0;
      const categorias = resumen?.porCategoria ?? {};
      const categoriasOrdenadas = Object.keys(categorias).sort(
        (a, b) => categorias[b] - categorias[a],
      );
      const porcentajeAhorroInforme = totalIngresos > 0
        ? ((totalIngresos - totalGastos) / totalIngresos) * 100
        : 0;

      await exportToPdf({
        filename: 'dashboard-financiero',
        title: 'Dashboard Financiero',
        subtitle: 'Resumen de gastos por categoría',
        kpis: [
          { label: 'Total Ingresos', value: formatMoney(totalIngresos), color: 'success' },
          { label: 'Total Gastos', value: formatMoney(totalGastos), color: 'error' },
          { label: '% Ahorro', value: formatPercent(porcentajeAhorroInforme), color: 'brand' },
        ],
        columns: [
          { header: 'Categoría' },
          { header: 'Monto', type: 'currency' },
          { header: '% del Total', type: 'percent' },
        ],
        rows: categoriasOrdenadas.map((categoria) => [
          categoria,
          categorias[categoria],
          totalGastos > 0 ? (categorias[categoria] / totalGastos) * 100 : 0,
        ]),
        showTotals: true,
        logoBase64: await fetchLogoBase64(),
      });
    } catch (error) {
      console.error(error);
      await Swal.fire('No se pudo generar el archivo', 'Intenta nuevamente en unos segundos.', 'error');
    }
  };

  const darDeBaja = async () => {
    const confirmacion = await Swal.fire({
      title: 'Eliminar cuenta',
      html: '<p style="margin-bottom:12px">Tu cuenta pasará al estado <b>ELIMINADO</b>. Conservaremos tus transacciones, metas e informes, pero no podrás iniciar sesión.</p><p>Escribe <b>ELIMINAR</b> para confirmar.</p>',
      input: 'text',
      inputPlaceholder: 'ELIMINAR',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Eliminar cuenta',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d92d20',
      preConfirm: (valor) => {
        if (String(valor ?? '').trim().toUpperCase() !== 'ELIMINAR') {
          Swal.showValidationMessage('Tienes que escribir ELIMINAR exactamente.');
          return false;
        }
        return valor;
      },
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await darDeBajaCuenta(usuarioId);
      await signOut();
      await Swal.fire('Cuenta eliminada', 'Tus datos fueron preservados y la cuenta quedó en estado ELIMINADO.', 'success');
      window.location.assign('/signin');
    } catch (error) {
      await Swal.fire('No se pudo completar', error instanceof Error ? error.message : 'Error inesperado.', 'error');
    }
  };

  if (loading) return <PerfilSkeleton />;

  return (
    <>
      <PageMeta title="Mi cuenta | FinSightAI" description="Perfil y opciones de cuenta" />
      <PageBreadcrumb pageTitle="Mi cuenta" />

      <div className="space-y-6">
        {/* Información personal */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col items-center gap-5 xl:flex-row">
              <UserAvatar
                className="h-20 w-20 border border-gray-200 dark:border-gray-700"
                emojiClassName="text-4xl"
              />
              <div className="text-center xl:text-left">
                <h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">{nombreCompleto}</h4>
                <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${coloresPerfil(perfil?.perfilFinanciero ?? '')}`}>
                    {perfil?.perfilFinanciero ?? 'Sin clasificar'}
                  </span>
                  <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${coloresEstado(perfil?.estado ?? 'ACTIVO')}`}>
                    {perfil?.estado ?? 'ACTIVO'}
                  </span>
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" startIcon={<EditIcon />} onClick={abrirEdicion}>Editar</Button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 border-t border-gray-100 pt-6 dark:border-gray-800 lg:grid-cols-3">
            <DatoCampo etiqueta="Nombre" valor={perfil?.nombre || '—'} />
            <DatoCampo etiqueta="Apellido" valor={perfil?.apellido || '—'} />
            <DatoCampo etiqueta="Correo electrónico" valor={perfil?.email ?? email ?? '—'} />
          </div>
        </div>

        {/* Nivel financiero y puntos de actividad */}
        <LevelCard health={health} puntos={puntos} rangoPuntos={rangoPuntos} />

        {/* Resumen financiero */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white/90">Resumen financiero</h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DatoCampo etiqueta="Ingreso mensual" valor={money.format(ingresoMensual)} />
            <DatoCampo etiqueta="Deuda mensual" valor={money.format(perfil?.deudaMensual ?? 0)} />
            <DatoCampo
              etiqueta="Nivel de endeudamiento"
              valor={
                <span className={(perfil?.nivelEndeudamiento ?? 0) > 30 ? 'text-error-600' : 'text-success-600'}>
                  {perfil?.nivelEndeudamiento ?? 0}%
                </span>
              }
            />
            <DatoCampo etiqueta="Frecuencia de ahorro" valor={perfil?.frecuenciaAhorro || 'Sin datos'} />
          </div>

          <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800">
            <div className="mb-1.5 flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Ahorro estimado sobre ingreso ({money.format(ahorroEstimado)})</span>
              <span className={`font-medium ${ahorroNegativo ? 'text-error-600 dark:text-error-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {porcentajeAhorro.toFixed(0)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-2 rounded-full ${ahorroNegativo ? 'bg-error-500' : 'bg-brand-500'}`}
                style={{ width: `${anchoBarraAhorro}%` }}
              ></div>
            </div>
            {ahorroNegativo && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-error-600 dark:text-error-400">
                <WarningIcon />
                Estás gastando más de lo que ahorras: revisa tus gastos de este mes.
              </p>
            )}
          </div>
        </div>

        {/* Informe financiero */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">Informe financiero</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Descarga o comparte un resumen con tus principales indicadores.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <ActionButton onClick={descargarPdf}>Descargar informe PDF</ActionButton>
            <ActionButton onClick={descargarCsv}>Exportar movimientos CSV</ActionButton>
            <ActionButton onClick={compartirInforme}>Compartir informe</ActionButton>
          </div>
        </div>

        {/* Seguridad */}
        <div id="seguridad" className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">Seguridad</h4>
          <FilaAjuste
            titulo="Cambiar contraseña"
            descripcion="Actualiza la contraseña de tu cuenta."
            accion={<Button variant="outline" size="sm" startIcon={<EditIcon />} onClick={cambiarPassword}>Cambiar contraseña</Button>}
          />
        </div>

        {/* Zona de peligro */}
        <div className="rounded-2xl border border-error-200 bg-white p-5 dark:border-error-800/50 dark:bg-white/[0.03] lg:p-6">
          <h4 className="mb-2 text-lg font-semibold text-gray-800 dark:text-white/90">Zona de peligro</h4>
          <FilaAjuste
            titulo="Cerrar sesión en todos los dispositivos"
            descripcion="Cierra tu sesión en este y en cualquier otro dispositivo donde hayas iniciado sesión."
            accion={<Button variant="outline" size="sm" onClick={cerrarSesionTodosDispositivos}>Cerrar sesiones</Button>}
          />
          <FilaAjuste
            titulo="Eliminar cuenta"
            descripcion="Tu cuenta pasa a estado ELIMINADO y se conservan tus datos financieros."
            accion={
              <button
                type="button"
                onClick={darDeBaja}
                className="rounded-lg border border-error-300 px-4 py-2.5 text-sm font-medium text-error-600 transition hover:bg-error-50 dark:border-error-800 dark:text-error-400 dark:hover:bg-error-500/10"
              >
                Eliminar cuenta
              </button>
            }
          />
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="m-4 max-w-[600px]">
        <div className="no-scrollbar relative w-full max-w-[600px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">Editar información personal</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">Actualiza tus datos para mantener tu perfil al día.</p>
          </div>
          <form onSubmit={guardarPerfil} className="flex flex-col">
            <div className="custom-scrollbar overflow-y-auto px-2 pb-3">
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div>
                  <Label>Nombre</Label>
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div>
                  <Label>Apellido</Label>
                  <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
                </div>
                <div className="lg:col-span-2">
                  <Label>Correo electrónico</Label>
                  <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
                </div>
                <div className="lg:col-span-2">
                  <Label>Foto de perfil</Label>
                  <div className="custom-scrollbar grid max-h-48 grid-cols-8 gap-2 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                    {AVATAR_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatarSeleccionado(emoji)}
                        aria-pressed={avatarSeleccionado === emoji}
                        aria-label={`Usar ${emoji} como foto de perfil`}
                        className={`flex h-10 w-10 items-center justify-center rounded-full text-xl transition-colors ${
                          avatarSeleccionado === emoji
                            ? 'bg-brand-500/20 ring-2 ring-brand-500'
                            : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3 px-2 lg:justify-end">
              <Button size="sm" variant="outline" onClick={closeModal} disabled={guardando}>Cancelar</Button>
              <Button size="sm" type="submit" disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar cambios'}</Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
