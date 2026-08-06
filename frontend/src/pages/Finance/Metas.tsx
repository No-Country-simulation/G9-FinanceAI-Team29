import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import PageMeta from '../../components/common/PageMeta';
import { actualizarMeta, agregarAhorroMeta, cancelarMeta, crearMeta, obtenerMetas, obtenerTransacciones } from '../../services/api';
import type { Goal, GoalCategory, GoalInput } from '../../types/finance';
import { confirmarAccion, mostrarExito, mostrarInfo, solicitarMonto } from '../../utils/alerts';
import { useAuth } from '../../context/AuthContext';
import { useGamification } from '../../context/GamificationContext';
import { useOnboarding } from '../../context/OnboardingContext';
import { formatMoney } from '../../utils/export/format';

const emptyForm: GoalInput = { nombre: '', descripcion: '', categoria: 'AHORRO', montoObjetivo: 0, fechaObjetivo: '' };

export default function Metas() {
  const { usuarioId } = useAuth();
  const { registrarEvento } = useGamification();
  const { isTourActive } = useOnboarding();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [form, setForm] = useState<GoalInput>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const active = useMemo(() => goals.filter(g => g.estado !== 'CANCELADA'), [goals]);

  async function load() {
    try { setLoading(true); setError(''); setGoals(await obtenerMetas(usuarioId)); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las metas'); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    setGoals([]);
    setEditing(null);
    setForm(emptyForm);
    void load();

    (async () => {
      try {
        const transacciones = await obtenerTransacciones(usuarioId);
        if (transacciones.length === 0 && !isTourActive) {
          await mostrarInfo(
            'Todavía no tienes datos financieros',
            'Carga tus movimientos antes de crear metas. Te llevamos al resumen financiero.',
          );
          navigate('/');
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [usuarioId, navigate, isTourActive]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.nombre.trim() || form.montoObjetivo <= 0) { setError('Completá el nombre y un monto objetivo válido.'); return; }
    try {
      setSaving(true); setError('');
      if (editing) await actualizarMeta(editing, form, usuarioId); else await crearMeta(form, usuarioId);
      if (!editing) registrarEvento('meta_creada');
      setForm(emptyForm); setEditing(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la meta'); }
    finally { setSaving(false); }
  }

  function edit(goal: Goal) {
    setEditing(goal.id);
    setForm({ nombre: goal.nombre, descripcion: goal.descripcion ?? '', categoria: goal.categoria, montoObjetivo: goal.montoObjetivo, fechaObjetivo: goal.fechaObjetivo ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function addSavings(goal: Goal) {
    setError('');
    const amount = await solicitarMonto(
      `Agregar ahorro a “${goal.nombre}”`,
      `Llevás ${formatMoney(goal.montoReservado)} de ${formatMoney(goal.montoObjetivo)}.`,
    );
    if (amount == null) return;

    try {
      await agregarAhorroMeta(goal.id, amount, usuarioId);
      registrarEvento('ahorro_meta');
      await load();
      await mostrarExito('Ahorro agregado', `Se sumaron ${formatMoney(amount)} a tu meta.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar el ahorro');
    }
  }

  async function cancel(goal: Goal) {
    const confirmed = await confirmarAccion(
      `¿Cancelar “${goal.nombre}”?`,
      'El progreso quedará guardado en el historial y la meta dejará de aparecer como activa.',
      'Sí, cancelar meta',
    );
    if (!confirmed) return;

    try {
      await cancelarMeta(goal.id, usuarioId);
      await load();
      await mostrarExito('Meta cancelada', 'La meta se guardó en el historial.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar la meta');
    }
  }

  return <>
    <PageMeta title="Metas | FinSightAI" description="Metas financieras" />
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Metas financieras</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Convertí tus objetivos en un plan medible y seguí el progreso.</p>
      </div>

      <form id="formulario-meta" data-tour="page-goals" onSubmit={submit} className="scroll-mt-24 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-gray-900 dark:text-white">{editing ? 'Editar meta' : 'Nueva meta'}</h2>{editing && <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); }} className="text-sm text-gray-500">Cancelar edición</button>}</div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <input className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white" placeholder="Nombre de la meta" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
          <select className="h-11 rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:[color-scheme:dark]" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value as GoalCategory })}>
            <option className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white" value="AHORRO">Ahorro</option>
            <option className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white" value="COMPRA">Compra</option>
            <option className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white" value="DEUDA">Deuda</option>
            <option className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white" value="EMERGENCIA">Emergencia</option>
            <option className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white" value="VIAJE">Viaje</option>
            <option className="bg-white text-gray-900 dark:bg-gray-900 dark:text-white" value="OTRO">Otro</option>
          </select>
          <input type="number" min="0.01" step="0.01" className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white" placeholder="Monto objetivo en USD" value={form.montoObjetivo || ''} onChange={e => setForm({ ...form, montoObjetivo: Number(e.target.value) })} />
          <input type="date" className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white" value={form.fechaObjetivo ?? ''} onChange={e => setForm({ ...form, fechaObjetivo: e.target.value })} />
          <input className="h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white lg:col-span-2" placeholder="Descripción opcional" value={form.descripcion ?? ''} onChange={e => setForm({ ...form, descripcion: e.target.value })} />
        </div>
        <button disabled={saving} className="mt-4 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear meta'}</button>
      </form>

      {error && <div className="rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-900/40 dark:bg-error-900/10 dark:text-error-400">{error}</div>}
      {loading ? <div className="py-12 text-center text-gray-500">Cargando metas…</div> : active.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center dark:border-gray-700 sm:p-10"><img src="/images/mascot/finsight-bird-empty.png" alt="Finsi te invita a crear una meta" className="mx-auto h-44 w-auto object-contain sm:h-56" /><p className="mt-3 font-medium text-gray-900 dark:text-white">Todavía no tenés metas activas</p><p className="mt-1 text-sm text-gray-500">Creá la primera para empezar a medir tu progreso.</p></div> :
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{active.map(goal => <article key={goal.id} className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        {goal.progreso >= 100 && <div className="mb-4 flex items-center gap-3 rounded-xl bg-success-50 p-3 dark:bg-success-500/10"><img src="/images/mascot/finsight-bird-goal-complete.png" alt="Finsi celebra la meta completada" className="h-20 w-16 shrink-0 object-contain" /><p className="text-sm font-semibold text-success-700 dark:text-success-400">¡Meta cumplida! Finsi celebra tu progreso.</p></div>}
        <div className="flex items-start justify-between gap-3"><div><span className="text-xs font-medium text-brand-500">{goal.categoria}</span><h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{goal.nombre}</h3></div><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs dark:bg-gray-800 dark:text-gray-300">{goal.estado}</span></div>
        {goal.descripcion && <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{goal.descripcion}</p>}
        <div className="mt-5"><div className="mb-2 flex justify-between text-sm"><span className="text-gray-600 dark:text-gray-300">{formatMoney(goal.montoReservado)} ahorrados</span><strong className="text-gray-700 dark:text-gray-200">{goal.progreso.toFixed(0)}%</strong></div><div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(goal.progreso, 100)}%` }} /></div></div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-gray-500">Objetivo</p><p className="font-medium dark:text-white">{formatMoney(goal.montoObjetivo)}</p></div><div><p className="text-gray-500">Faltan</p><p className="font-medium dark:text-white">{formatMoney(goal.montoRestante)}</p></div>{goal.reservaMensualSugerida != null && <div><p className="text-gray-500">Sugerido/mes</p><p className="font-medium dark:text-white">{formatMoney(goal.reservaMensualSugerida)}</p></div>}{goal.fechaObjetivo && <div><p className="text-gray-500">Fecha objetivo</p><p className="font-medium dark:text-white">{new Date(`${goal.fechaObjetivo}T00:00:00`).toLocaleDateString('es-AR')}</p></div>}</div>
        <div className="mt-5 flex flex-wrap gap-2"><button onClick={() => addSavings(goal)} className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white">+ Agregar ahorro</button><button onClick={() => edit(goal)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs dark:border-gray-700 dark:text-white">Editar</button><button onClick={() => cancel(goal)} className="rounded-lg border border-error-300 px-3 py-2 text-xs text-error-600 dark:border-error-800">Cancelar</button></div>
      </article>)}</div>}
    </div>
  </>;
}
