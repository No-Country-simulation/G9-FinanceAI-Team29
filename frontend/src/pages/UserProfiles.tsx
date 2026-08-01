import { FormEvent, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import PageBreadcrumb from '../components/common/PageBreadCrumb';
import PageMeta from '../components/common/PageMeta';
import Input from '../components/form/input/InputField';
import Label from '../components/form/Label';
import { useAuth } from '../context/AuthContext';
import {
  actualizarPerfil,
  darDeBajaCuenta,
  obtenerPerfilCompleto,
  obtenerResumen,
  obtenerTransacciones,
  PerfilCompleto,
  ResumenTransacciones,
  Transaccion,
} from '../services/api';
import { supabase } from '../services/supabase';

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

export default function UserProfiles() {
  const { usuarioId, email, signOut } = useAuth();
  const [perfil, setPerfil] = useState<PerfilCompleto | null>(null);
  const [resumen, setResumen] = useState<ResumenTransacciones | null>(null);
  const [transacciones, setTransacciones] = useState<Transaccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [editing, setEditing] = useState(false);

  const nombreCompleto = useMemo(() => {
    const valor = `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim();
    return valor || email || 'Usuario de FinSightAI';
  }, [perfil, email]);

  useEffect(() => {
    if (!usuarioId) {
      setLoading(false);
      return;
    }

    Promise.all([
      obtenerPerfilCompleto(usuarioId),
      obtenerResumen(usuarioId),
      obtenerTransacciones(usuarioId),
    ])
      .then(([perfilData, resumenData, transaccionesData]) => {
        setPerfil(perfilData);
        setResumen(resumenData);
        setTransacciones(transaccionesData);
        setNombre(perfilData.nombre ?? '');
        setApellido(perfilData.apellido ?? '');
      })
      .catch((error) => {
        void Swal.fire('No se pudo cargar el perfil', error.message, 'error');
      })
      .finally(() => setLoading(false));
  }, [usuarioId]);

  const guardarPerfil = async (event: FormEvent) => {
    event.preventDefault();

    try {
      await actualizarPerfil(usuarioId, { nombre, apellido });
      setPerfil((actual) => actual ? { ...actual, nombre, apellido } : actual);
      setEditing(false);
      await Swal.fire('Perfil actualizado', 'Tus datos fueron guardados.', 'success');
    } catch (error) {
      await Swal.fire('No se pudo guardar', error instanceof Error ? error.message : 'Error inesperado.', 'error');
    }
  };

  const cambiarPassword = async () => {
    const resultado = await Swal.fire({
      title: 'Cambiar contraseña',
      input: 'password',
      inputLabel: 'Nueva contraseña',
      inputPlaceholder: 'Mínimo 8 caracteres',
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
      cancelButtonText: 'Cancelar',
      inputValidator: (value) => value.length < 8 ? 'Usá al menos 8 caracteres.' : undefined,
    });

    if (!resultado.value) return;

    const { error } = await supabase.auth.updateUser({ password: resultado.value });

    if (error) {
      await Swal.fire('No se pudo cambiar', error.message, 'error');
      return;
    }

    await Swal.fire('Contraseña actualizada', 'La nueva contraseña ya está activa.', 'success');
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

    const contenido = `\uFEFF${encabezados.join(',')}\n${filas.join('\n')}`;
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
        await Swal.fire('Informe copiado', 'Podés pegarlo donde quieras compartirlo.', 'success');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await Swal.fire('No se pudo compartir', 'Probá nuevamente.', 'error');
    }
  };

  const descargarPdf = () => {
    const categorias = Object.entries(resumen?.porCategoria ?? {})
      .map(([categoria, monto]) => `<tr><td>${categoria}</td><td>${money.format(monto)}</td></tr>`)
      .join('');
    const recientes = transacciones.slice(0, 10)
      .map((t) => `<tr><td>${t.fecha}</td><td>${t.descripcion}</td><td>${t.categoria}</td><td>${money.format(t.monto)}</td></tr>`)
      .join('');

    const ventana = window.open('', '_blank', 'width=900,height=700');
    if (!ventana) {
      void Swal.fire('Ventana bloqueada', 'Habilitá las ventanas emergentes para generar el PDF.', 'warning');
      return;
    }

    ventana.document.write(`<!doctype html><html><head><title>Informe FinSightAI</title><style>
      body{font-family:Arial,sans-serif;color:#172033;padding:36px}h1{margin-bottom:4px}.muted{color:#667085}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:24px 0}.card{border:1px solid #d0d5dd;border-radius:12px;padding:16px}
      table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border-bottom:1px solid #eaecf0;padding:9px;text-align:left;font-size:13px}
      h2{margin-top:28px}@media print{button{display:none}body{padding:12px}}
    </style></head><body>
      <h1>Informe financiero FinSightAI</h1><div class="muted">${nombreCompleto} · ${new Date().toLocaleDateString('es-AR')}</div>
      <div class="grid"><div class="card"><b>Perfil</b><br>${perfil?.perfilFinanciero ?? 'Sin clasificar'}</div>
      <div class="card"><b>Ingresos</b><br>${money.format(resumen?.totalIngresos ?? 0)}</div>
      <div class="card"><b>Gastos</b><br>${money.format(resumen?.totalGastos ?? 0)}</div></div>
      <h2>Gastos por categoría</h2><table><thead><tr><th>Categoría</th><th>Monto</th></tr></thead><tbody>${categorias || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody></table>
      <h2>Últimas transacciones</h2><table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Monto</th></tr></thead><tbody>${recientes || '<tr><td colspan="4">Sin datos</td></tr>'}</tbody></table>
      <script>window.onload=()=>window.print();<\/script></body></html>`);
    ventana.document.close();
  };

  const darDeBaja = async () => {
    const confirmacion = await Swal.fire({
      title: 'Dar de baja tu cuenta',
      html: '<p style="margin-bottom:12px">Tu cuenta pasará al estado <b>ELIMINADO</b>. Conservaremos tus transacciones, metas e informes, pero no podrás iniciar sesión.</p><p>Escribí <b>ELIMINAR</b> para confirmar.</p>',
      input: 'text',
      inputPlaceholder: 'ELIMINAR',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Dar de baja',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d92d20',
      preConfirm: (valor) => {
        if (String(valor ?? '').trim().toUpperCase() !== 'ELIMINAR') {
          Swal.showValidationMessage('Tenés que escribir ELIMINAR exactamente.');
          return false;
        }
        return valor;
      },
    });

    if (!confirmacion.isConfirmed) return;

    try {
      await darDeBajaCuenta(usuarioId);
      await signOut();
      await Swal.fire('Cuenta dada de baja', 'Tus datos fueron preservados y la cuenta quedó en estado ELIMINADO.', 'success');
      window.location.assign('/signin');
    } catch (error) {
      await Swal.fire('No se pudo completar', error instanceof Error ? error.message : 'Error inesperado.', 'error');
    }
  };

  if (loading) return <p className="p-6 text-gray-500">Cargando perfil...</p>;

  return (
    <>
      <PageMeta title="Mi cuenta | FinSightAI" description="Perfil y opciones de cuenta" />
      <PageBreadcrumb pageTitle="Mi cuenta" />

      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <img src="/logo_crop.png" alt="FinSightAI" className="h-16 w-16 rounded-full border border-gray-200 object-cover dark:border-gray-700" />
              <div><h1 className="text-xl font-semibold text-gray-900 dark:text-white">{nombreCompleto}</h1>
              <p className="text-sm text-gray-500">{email}</p><p className="mt-1 text-sm text-brand-600">Perfil {perfil?.perfilFinanciero ?? 'sin clasificar'} · Estado {perfil?.estado ?? 'ACTIVO'}</p></div>
            </div>
            <ActionButton onClick={() => setEditing((valor) => !valor)}>Editar perfil</ActionButton>
          </div>

          {editing && <form onSubmit={guardarPerfil} className="mt-6 grid gap-4 border-t border-gray-200 pt-6 dark:border-gray-800 md:grid-cols-2">
            <div><Label>Nombre</Label><Input value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
            <div><Label>Apellido</Label><Input value={apellido} onChange={(e) => setApellido(e.target.value)} /></div>
            <div className="md:col-span-2 flex gap-3"><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">Guardar cambios</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancelar</button></div>
          </form>}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Informe financiero</h2>
          <p className="mt-1 text-sm text-gray-500">Descargá o compartí un resumen con tus principales indicadores.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><ActionButton onClick={descargarPdf}>Descargar informe PDF</ActionButton><ActionButton onClick={descargarCsv}>Exportar movimientos CSV</ActionButton><ActionButton onClick={compartirInforme}>Compartir informe</ActionButton></div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Seguridad y cuenta</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><ActionButton onClick={cambiarPassword}>Cambiar contraseña</ActionButton><ActionButton onClick={darDeBaja} danger>Dar de baja mi cuenta</ActionButton></div>
          <p className="mt-4 text-xs text-gray-500">La baja cambia la cuenta a ELIMINADO y conserva sus datos financieros. Las cuentas INACTIVAS pueden reactivarse al volver a iniciar sesión.</p>
        </section>
      </div>
    </>
  );
}
