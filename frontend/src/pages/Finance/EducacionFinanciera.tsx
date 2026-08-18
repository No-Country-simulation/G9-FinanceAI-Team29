import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useAuth } from "../../context/AuthContext";
import { analizarFinanzas, obtenerTransacciones, obtenerUsuario } from "../../services/api";
import type { AnalisisResponse, PerfilUsuario } from "../../types/finance";
import { construirAnalisisRequest } from "../../utils/construirAnalisisRequest";
import {
  DollarLineIcon,
  InfoIcon,
  ListIcon,
  LockIcon,
  PieChartIcon,
  ShootingStarIcon,
  TaskIcon,
} from "../../icons";

type ConceptoId =
  | "capacidad-ahorro"
  | "deuda-ingreso"
  | "gastos-fijos-variables"
  | "fondo-emergencia"
  | "metas-planificacion";

type Concepto = {
  id: ConceptoId;
  icono: ComponentType<{ className?: string }>;
  titulo: string;
  resumen: string;
  queEs: string;
  porQueImporta: string;
  ejemplo: string;
  claves: string[];
  preguntaFinsi: string;
};


type RecomendacionEducativa = {
  conceptoId: ConceptoId;
  motivo: string;
};

function obtenerRecomendacionEducativa(
  perfil: PerfilUsuario | null,
  analisis: AnalisisResponse | null,
): RecomendacionEducativa {
  if (!perfil) {
    return {
      conceptoId: "capacidad-ahorro",
      motivo:
        "Entender este indicador te ayuda a interpretar mejor cuánto margen queda después de cubrir tus gastos y cómo puede impactar en tus próximos objetivos.",
    };
  }

  const perfilNormalizado = (
    analisis?.perfilFinanciero ??
    perfil.perfilFinanciero ??
    ""
  )
    .trim()
    .toLowerCase();

  const nivelEndeudamiento = Number(perfil.nivelEndeudamiento ?? 0);
  const ingresoMensual = Number(
    analisis?.totalIngresos ??
    perfil.ingresoMensual ??
    0,
  );
  const porcentajeAhorro = Number(
    analisis?.porcentajeAhorro ??
    (
      ingresoMensual > 0
        ? (Number(perfil.ahorroEstimado ?? 0) / ingresoMensual) * 100
        : 0
    ),
  );

  // Si el endeudamiento es especialmente alto, priorizamos entender primero
  // cuánto del ingreso está comprometido, sin importar la etiqueta general.
  if (nivelEndeudamiento >= 35 || perfilNormalizado.includes("riesgo")) {
    return {
      conceptoId: "deuda-ingreso",
      motivo:
        "Tu situación actual hace especialmente útil entender qué parte de tus ingresos está comprometida en pagos de deuda y cuánto margen financiero queda disponible.",
    };
  }

  // En observación, la capacidad de ahorro suele ser el punto más útil para
  // comprender cuánto margen real existe antes de avanzar hacia otros objetivos.
  if (perfilNormalizado.includes("observ")) {
    return {
      conceptoId: "capacidad-ahorro",
      motivo:
        "Tu perfil actual sugiere que vale la pena entender cuánto de tus ingresos logras conservar después de cubrir gastos y obligaciones.",
    };
  }

  // Si el perfil es saludable pero el margen de ahorro es bajo, conviene
  // reforzar primero ese concepto antes de pasar a planificación de metas.
  if (perfilNormalizado.includes("salud") && porcentajeAhorro < 10) {
    return {
      conceptoId: "capacidad-ahorro",
      motivo:
        "Aunque tu perfil general es saludable, revisar tu capacidad de ahorro te ayuda a entender cuánto margen tienes hoy para imprevistos y objetivos futuros.",
    };
  }

  // Un perfil saludable con margen de ahorro puede aprovechar mejor la
  // educación orientada a transformar ese margen en objetivos concretos.
  if (perfilNormalizado.includes("salud")) {
    return {
      conceptoId: "metas-planificacion",
      motivo:
        "Tu situación financiera parte de una base saludable, por lo que aprender a convertir tu margen de ahorro en metas concretas puede ser un buen siguiente paso.",
    };
  }

  // Fallback conservador si el backend devuelve una etiqueta nueva o inesperada.
  return {
    conceptoId: "fondo-emergencia",
    motivo:
      "Construir una base para imprevistos es un buen punto de partida cuando todavía no hay una prioridad financiera claramente identificada.",
  };
}

const conceptos: Concepto[] = [
  {
    id: "capacidad-ahorro",
    icono: DollarLineIcon,
    titulo: "Capacidad de ahorro",
    resumen:
      "Entiende qué parte de tus ingresos queda disponible después de cubrir tus gastos.",
    queEs:
      "La capacidad de ahorro representa cuánto dinero o qué proporción de tus ingresos puedes conservar después de cubrir tus gastos habituales.",
    porQueImporta:
      "Te ayuda a saber cuánto margen tienes para enfrentar imprevistos, crear un fondo de emergencia o avanzar hacia metas financieras.",
    ejemplo:
      "Si ingresas $2.000 y tus gastos del período son $1.600, te quedan $400 disponibles. Eso equivale a una capacidad de ahorro del 20%.",
    claves: [
      "No depende solo de cuánto ganas, sino también de cuánto gastas.",
      "Puede variar de un mes a otro.",
      "Mejorarla aumenta tu margen para afrontar gastos inesperados y objetivos futuros.",
    ],
    preguntaFinsi:
      "Quiero entender mejor mi capacidad de ahorro. Explicame qué significa, cómo se calcula y cómo se relaciona con mis finanzas actuales.",
  },
  {
    id: "deuda-ingreso",
    icono: PieChartIcon,
    titulo: "Relación deuda/ingreso",
    resumen:
      "Descubre qué parte de tus ingresos está comprometida en pagos de deuda.",
    queEs:
      "La relación deuda/ingreso compara los pagos que destinas a deudas con tus ingresos del mismo período.",
    porQueImporta:
      "Cuanto mayor sea la proporción de ingresos comprometida, menor margen queda para gastos cotidianos, ahorro y situaciones imprevistas.",
    ejemplo:
      "Si ingresas $2.000 al mes y destinas $500 al pago de deudas, el 25% de tus ingresos está comprometido en esos pagos.",
    claves: [
      "Sirve para medir cuánto pesan las deudas dentro de tu presupuesto.",
      "Un porcentaje más alto implica menos flexibilidad financiera.",
      "Debe interpretarse junto con tus gastos, ingresos y capacidad de ahorro.",
    ],
    preguntaFinsi:
      "Quiero entender mejor mi relación deuda/ingreso. Explicame qué significa y cómo influye en mi situación financiera actual.",
  },
  {
    id: "gastos-fijos-variables",
    icono: ListIcon,
    titulo: "Gastos fijos vs. variables",
    resumen:
      "Aprende a distinguir los gastos difíciles de modificar de aquellos que ofrecen más margen de ajuste.",
    queEs:
      "Los gastos fijos suelen repetirse con importes relativamente estables, mientras que los variables cambian según el consumo, las decisiones y las circunstancias de cada período.",
    porQueImporta:
      "Separarlos permite identificar qué parte de tus gastos es difícil de reducir rápidamente y dónde puede existir mayor margen para hacer ajustes.",
    ejemplo:
      "Un alquiler suele comportarse como gasto fijo. Salidas, compras no esenciales o entretenimiento suelen ser más variables.",
    claves: [
      "No todo gasto recurrente es necesariamente imposible de modificar.",
      "Los gastos variables suelen ofrecer más margen de ajuste a corto plazo.",
      "Clasificarlos ayuda a construir presupuestos más realistas.",
    ],
    preguntaFinsi:
      "Quiero entender la diferencia entre gastos fijos y variables y cómo se refleja en mis gastos actuales.",
  },
  {
    id: "fondo-emergencia",
    icono: LockIcon,
    titulo: "Fondo de emergencia",
    resumen:
      "Entiende por qué reservar dinero para imprevistos puede darte mayor estabilidad.",
    queEs:
      "Un fondo de emergencia es dinero reservado para gastos inesperados o períodos en los que tus ingresos habituales se reducen.",
    porQueImporta:
      "Puede evitar que un imprevisto te obligue a usar dinero destinado a gastos esenciales, abandonar una meta o asumir nueva deuda.",
    ejemplo:
      "Una reparación urgente, un gasto médico inesperado o una caída temporal de ingresos son situaciones en las que un fondo de emergencia puede dar margen de respuesta.",
    claves: [
      "Debe estar separado de los gastos cotidianos.",
      "Se construye progresivamente, no necesariamente de una sola vez.",
      "El monto adecuado depende de la situación de cada persona.",
    ],
    preguntaFinsi:
      "Quiero aprender sobre fondos de emergencia. Explicame para qué sirven y cómo podría pensar uno según mi situación financiera actual.",
  },
  {
    id: "metas-planificacion",
    icono: TaskIcon,
    titulo: "Metas y planificación financiera",
    resumen:
      "Convierte una intención futura en un objetivo concreto, medible y con seguimiento.",
    queEs:
      "Una meta financiera transforma algo que quieres conseguir en un objetivo con un monto, una fecha y un plan de avance.",
    porQueImporta:
      "Te permite estimar cuánto necesitas reservar, medir tu progreso y adaptar el plan si cambian tus ingresos, gastos o prioridades.",
    ejemplo:
      "En lugar de pensar solamente 'quiero comprar una notebook', puedes definir cuánto necesitas, para qué fecha y cuánto deberías reservar periódicamente.",
    claves: [
      "Una meta clara tiene un objetivo concreto.",
      "Definir una fecha ayuda a estimar el ritmo necesario.",
      "El plan puede ajustarse si tu situación financiera cambia.",
    ],
    preguntaFinsi:
      "Quiero entender mejor cómo planificar una meta financiera y cómo relacionarla con mi capacidad de ahorro actual.",
  },
];

export default function EducacionFinanciera() {
  const navigate = useNavigate();
  const { usuarioId } = useAuth();
  const [conceptoAbierto, setConceptoAbierto] = useState<Concepto | null>(null);
  const [perfilUsuario, setPerfilUsuario] = useState<PerfilUsuario | null>(null);
  const [analisisUsuario, setAnalisisUsuario] = useState<AnalisisResponse | null>(null);

  useEffect(() => {
    if (!usuarioId) {
      return;
    }

    localStorage.setItem(
      `finsight:educacion-financiera:visto:${usuarioId}`,
      "true",
    );

    window.dispatchEvent(
      new Event("finsight:educacion-financiera-vista"),
    );
  }, [usuarioId]);

  useEffect(() => {
    let cancelado = false;

    const cargarDatosEducativos = async () => {
      try {
        const [perfil, transacciones] = await Promise.all([
          obtenerUsuario(usuarioId),
          obtenerTransacciones(usuarioId),
        ]);

        const analisis =
          transacciones.length > 0
            ? await analizarFinanzas(
                construirAnalisisRequest(perfil, transacciones),
                usuarioId,
              )
            : null;

        if (!cancelado) {
          setPerfilUsuario(perfil);
          setAnalisisUsuario(analisis);
        }
      } catch (error) {
        console.warn(
          "No se pudo personalizar la recomendación educativa. Se usará la recomendación general.",
          error,
        );

        if (!cancelado) {
          setPerfilUsuario(null);
          setAnalisisUsuario(null);
        }
      }
    };

    if (usuarioId) {
      setPerfilUsuario(null);
      setAnalisisUsuario(null);
      void cargarDatosEducativos();
    }

    return () => {
      cancelado = true;
    };
  }, [usuarioId]);

  const recomendacion = useMemo(
    () => obtenerRecomendacionEducativa(perfilUsuario, analisisUsuario),
    [perfilUsuario, analisisUsuario],
  );

  const recomendado = useMemo(
    () =>
      conceptos.find((concepto) => concepto.id === recomendacion.conceptoId) ??
      conceptos[0],
    [recomendacion.conceptoId],
  );

  const preguntarleAFinsi = (concepto: Concepto) => {
    navigate("/asistente-ia", {
      state: {
        autoPrompt: concepto.preguntaFinsi,
        educationTopic: concepto.id,
      },
    });
  };

  return (
    <>
      <PageMeta
        title="Educación Financiera | FinSightAI"
        description="Aprende los conceptos detrás de tus indicadores financieros"
      />

      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-brand-500">
            Aprende sobre tus finanzas
          </p>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Educación Financiera
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400">
            Comprende los conceptos que están detrás de tus indicadores, recomendaciones
            y decisiones financieras. La idea no es solo saber qué hacer, sino entender por qué.
          </p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-purple-50 shadow-sm dark:border-brand-500/20 dark:from-brand-500/10 dark:via-white/[0.03] dark:to-purple-500/10">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                <ShootingStarIcon className="h-3.5 w-3.5" />
                Recomendado para ti
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-gray-900">
                  <recomendado.icono className="h-6 w-6 text-brand-500" />
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                    {recomendado.titulo}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {recomendado.resumen}
                  </p>
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    <strong className="font-semibold text-gray-700 dark:text-gray-300">
                      ¿Por qué empezar acá?
                    </strong>{" "}
                    {recomendacion.motivo}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <button
                type="button"
                onClick={() => setConceptoAbierto(recomendado)}
                className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Aprender más
              </button>
              <button
                type="button"
                onClick={() => preguntarleAFinsi(recomendado)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300 bg-white px-5 py-3 text-sm font-semibold text-brand-600 transition hover:bg-brand-50 dark:border-brand-700 dark:bg-white/[0.03] dark:text-brand-300 dark:hover:bg-white/[0.06]"
              >
                <img
                  src="/images/icons/finsi_icon_sm.png"
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
                Preguntarle a Finsi
              </button>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Conceptos fundamentales
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Cinco ideas clave para entender mejor tu situación y tus decisiones financieras.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {conceptos.map((concepto) => (
              <article
                key={concepto.id}
                className="flex min-h-[250px] flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500/40"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
                  <concepto.icono className="h-5 w-5 text-brand-500" />
                </div>
                <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
                  {concepto.titulo}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  {concepto.resumen}
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setConceptoAbierto(concepto)}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600"
                  >
                    Aprender más
                  </button>
                  <button
                    type="button"
                    onClick={() => preguntarleAFinsi(concepto)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 dark:border-gray-700 dark:text-gray-300 dark:hover:border-brand-700 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
                  >
                    <img
                  src="/images/icons/finsi_icon_sm.png"
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
                    Finsi
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
              <InfoIcon className="h-5 w-5 text-brand-500" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-white/90">
                Educación para comprender, no para reemplazar asesoramiento profesional
              </h3>
              <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                Estos contenidos tienen fines educativos y ayudan a interpretar mejor los datos
                disponibles en FinSightAI. No constituyen asesoramiento financiero profesional.
              </p>
            </div>
          </div>
        </div>
      </div>

      {conceptoAbierto && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setConceptoAbierto(null);
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
                  <conceptoAbierto.icono className="h-5 w-5 text-brand-500" />
                </div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {conceptoAbierto.titulo}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setConceptoAbierto(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-6 p-6">
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-500">
                  ¿Qué es?
                </p>
                <p className="text-sm leading-7 text-gray-600 dark:text-gray-300">
                  {conceptoAbierto.queEs}
                </p>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-500">
                  ¿Por qué importa?
                </p>
                <p className="text-sm leading-7 text-gray-600 dark:text-gray-300">
                  {conceptoAbierto.porQueImporta}
                </p>
              </section>

              <section className="rounded-2xl bg-brand-50 p-4 dark:bg-brand-500/10">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">
                  Ejemplo sencillo
                </p>
                <p className="text-sm leading-7 text-gray-700 dark:text-gray-300">
                  {conceptoAbierto.ejemplo}
                </p>
              </section>

              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-brand-500">
                  Para recordar
                </p>
                <ul className="space-y-3">
                  {conceptoAbierto.claves.map((clave) => (
                    <li
                      key={clave}
                      className="flex gap-3 text-sm leading-6 text-gray-600 dark:text-gray-300"
                    >
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      <span>{clave}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-500/20 dark:bg-brand-500/10">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white/90">
                      ¿Quieres relacionarlo con tus números?
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Finsi puede explicarlo usando el contexto financiero disponible en tu cuenta.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => preguntarleAFinsi(conceptoAbierto)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
                  >
                    <img
                  src="/images/icons/finsi_icon_sm.png"
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                />
                    Preguntarle a Finsi
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
