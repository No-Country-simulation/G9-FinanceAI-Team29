import type {
  Goal,
  PerfilUsuario,
  ResumenTransacciones,
  Transaccion,
} from '../types/finance';

export interface FinancialNotification {
  id: string;
  icono: string;
  iconBg: string;
  titulo: string;
  detalle: string;
  tipo: string;
  tiempo: string;
  prioridad: number;
}

interface NotificationData {
  perfil?: PerfilUsuario;
  resumen?: ResumenTransacciones;
  transacciones?: Transaccion[];
  metas?: Goal[];
  nivel?: { level: number; titulo: string; subioRecientemente: boolean };
}

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function relativeTime(dateValue: string): string {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Reciente';

  const difference = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(difference / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours} h`;
  if (days === 1) return 'Hace 1 día';
  return `Hace ${days} días`;
}

function buildMonthlyTotals(transacciones: Transaccion[]) {
  const totals = new Map<string, number>();

  transacciones
    .filter((transaction) => transaction.tipo.toUpperCase() === 'GASTO')
    .forEach((transaction) => {
      const date = new Date(transaction.fecha);
      if (Number.isNaN(date.getTime())) return;

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      totals.set(key, (totals.get(key) ?? 0) + Number(transaction.monto));
    });

  return Array.from(totals.entries()).sort(([monthA], [monthB]) =>
    monthA.localeCompare(monthB),
  );
}

export function buildFinancialNotifications({
  perfil,
  resumen,
  transacciones = [],
  metas = [],
  nivel,
}: NotificationData): FinancialNotification[] {
  const notifications: FinancialNotification[] = [];

  if (nivel?.subioRecientemente) {
    notifications.push({
      id: `nivel-${nivel.level}`,
      icono: '🏆',
      iconBg: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10',
      titulo: `¡Subiste a nivel ${nivel.level}!`,
      detalle: `Ahora eres ${nivel.titulo}. Sigue así.`,
      tipo: 'Juegos',
      tiempo: 'Reciente',
      prioridad: 65,
    });
  }

  if (perfil && perfil.ingresoMensual > 0) {
    const debt = perfil.nivelEndeudamiento;

    if (debt > 50) {
      notifications.push({
        id: `debt-high-${Math.round(debt)}`,
        icono: '!',
        iconBg: 'bg-error-50 text-error-600 dark:bg-error-500/10',
        titulo: 'Endeudamiento alto',
        detalle: `El ${debt.toFixed(1)}% de tus ingresos está destinado a deudas. Priorizá reducir las de mayor interés.`,
        tipo: 'Endeudamiento',
        tiempo: 'Datos actuales',
        prioridad: 100,
      });
    } else if (debt > 30) {
      notifications.push({
        id: `debt-medium-${Math.round(debt)}`,
        icono: '!',
        iconBg: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10',
        titulo: 'Endeudamiento moderado',
        detalle: `Tu nivel es ${debt.toFixed(1)}%. Intentá bajarlo hasta el rango recomendado de 30% o menos.`,
        tipo: 'Endeudamiento',
        tiempo: 'Datos actuales',
        prioridad: 85,
      });
    } else {
      notifications.push({
        id: `debt-healthy-${Math.round(debt)}`,
        icono: '✓',
        iconBg: 'bg-success-50 text-success-600 dark:bg-success-500/10',
        titulo: 'Endeudamiento saludable',
        detalle: `Tu nivel de ${debt.toFixed(1)}% está dentro del rango recomendado.`,
        tipo: 'Endeudamiento',
        tiempo: 'Datos actuales',
        prioridad: 35,
      });
    }

    if (perfil.ingresoMensual > 0) {
      const savingsRate = (perfil.ahorroEstimado / perfil.ingresoMensual) * 100;

      if (savingsRate < 0) {
        notifications.push({
          id: `savings-negative-${Math.round(Math.abs(savingsRate))}`,
          icono: '↓',
          iconBg: 'bg-error-50 text-error-600 dark:bg-error-500/10',
          titulo: 'Tus gastos superan tus ingresos',
          detalle: `El balance mensual estimado es ${money.format(perfil.ahorroEstimado)}. Revisá primero los gastos variables.`,
          tipo: 'Ahorro',
          tiempo: 'Datos actuales',
          prioridad: 95,
        });
      } else if (savingsRate < 10) {
        notifications.push({
          id: `savings-low-${Math.round(savingsRate)}`,
          icono: '↓',
          iconBg: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10',
          titulo: 'Capacidad de ahorro baja',
          detalle: `Estás ahorrando aproximadamente ${savingsRate.toFixed(1)}% de tus ingresos.`,
          tipo: 'Ahorro',
          tiempo: 'Datos actuales',
          prioridad: 80,
        });
      } else if (savingsRate >= 20) {
        notifications.push({
          id: `savings-good-${Math.round(savingsRate)}`,
          icono: '↑',
          iconBg: 'bg-success-50 text-success-600 dark:bg-success-500/10',
          titulo: 'Buen nivel de ahorro',
          detalle: `Tu ahorro estimado equivale al ${savingsRate.toFixed(1)}% de tus ingresos.`,
          tipo: 'Ahorro',
          tiempo: 'Datos actuales',
          prioridad: 40,
        });
      }
    }
  }

  if (resumen && resumen.totalGastos > 0) {
    const mainCategory = Object.entries(resumen.porCategoria).sort(
      ([, amountA], [, amountB]) => amountB - amountA,
    )[0];

    if (mainCategory) {
      const [category, amount] = mainCategory;
      const percentage = (amount / resumen.totalGastos) * 100;
      const concentrated = percentage >= 35;

      notifications.push({
        id: `category-${category}-${Math.round(percentage)}`,
        icono: concentrated ? '!' : '◉',
        iconBg: concentrated
          ? 'bg-warning-50 text-warning-600 dark:bg-warning-500/10'
          : 'bg-brand-50 text-brand-600 dark:bg-brand-500/10',
        titulo: concentrated
          ? `Gasto concentrado en ${category}`
          : `${category} es tu principal categoría`,
        detalle: `${money.format(amount)} corresponde al ${percentage.toFixed(1)}% de tus gastos registrados.`,
        tipo: 'Categorías',
        tiempo: 'Datos actuales',
        prioridad: concentrated ? 75 : 30,
      });
    }
  }

  const sortedTransactions = [...transacciones].sort(
    (transactionA, transactionB) =>
      new Date(transactionB.fecha).getTime() - new Date(transactionA.fecha).getTime(),
  );
  const latestTransaction = sortedTransactions[0];

  if (latestTransaction) {
    notifications.push({
      id: `transaction-${latestTransaction.id}`,
      icono: latestTransaction.tipo.toUpperCase() === 'INGRESO' ? '↑' : '↓',
      iconBg:
        latestTransaction.tipo.toUpperCase() === 'INGRESO'
          ? 'bg-success-50 text-success-600 dark:bg-success-500/10'
          : 'bg-brand-50 text-brand-600 dark:bg-brand-500/10',
      titulo: 'Última transacción registrada',
      detalle: `${latestTransaction.descripcion} · ${money.format(latestTransaction.monto)} en ${latestTransaction.categoria}.`,
      tipo: 'Transacción',
      tiempo: relativeTime(latestTransaction.fecha),
      prioridad: 55,
    });
  }

  if (perfil?.ingresoMensual) {
    const largeExpense = sortedTransactions.find(
      (transaction) =>
        transaction.tipo.toUpperCase() === 'GASTO' &&
        transaction.monto >= perfil.ingresoMensual * 0.25,
    );

    if (largeExpense) {
      notifications.push({
        id: `large-expense-${largeExpense.id}`,
        icono: '!',
        iconBg: 'bg-warning-50 text-warning-600 dark:bg-warning-500/10',
        titulo: 'Gasto de importe elevado',
        detalle: `${largeExpense.descripcion} representa al menos el 25% de tu ingreso mensual: ${money.format(largeExpense.monto)}.`,
        tipo: 'Transacción',
        tiempo: relativeTime(largeExpense.fecha),
        prioridad: 70,
      });
    }
  }

  const monthlyTotals = buildMonthlyTotals(transacciones);
  if (monthlyTotals.length >= 2) {
    const [, currentTotal] = monthlyTotals[monthlyTotals.length - 1];
    const [, previousTotal] = monthlyTotals[monthlyTotals.length - 2];

    if (previousTotal > 0) {
      const variation = ((currentTotal - previousTotal) / previousTotal) * 100;

      if (Math.abs(variation) >= 10) {
        const increased = variation > 0;
        notifications.push({
          id: `monthly-variation-${Math.round(variation)}`,
          icono: increased ? '↑' : '↓',
          iconBg: increased
            ? 'bg-error-50 text-error-600 dark:bg-error-500/10'
            : 'bg-success-50 text-success-600 dark:bg-success-500/10',
          titulo: increased ? 'Tus gastos mensuales aumentaron' : 'Tus gastos mensuales disminuyeron',
          detalle: `El último mes registrado tuvo un cambio de ${Math.abs(variation).toFixed(1)}% frente al anterior.`,
          tipo: 'Tendencia',
          tiempo: 'Último período',
          prioridad: increased ? 90 : 45,
        });
      }
    }
  }

  const completedGoal = metas.find((goal) => goal.estado === 'COMPLETADA');
  const advancedGoal = metas
    .filter((goal) => goal.estado === 'ACTIVA')
    .sort((goalA, goalB) => goalB.progreso - goalA.progreso)[0];

  if (completedGoal) {
    notifications.push({
      id: `goal-completed-${completedGoal.id}`,
      icono: '✓',
      iconBg: 'bg-success-50 text-success-600 dark:bg-success-500/10',
      titulo: 'Meta financiera completada',
      detalle: `Alcanzaste “${completedGoal.nombre}”.`,
      tipo: 'Meta',
      tiempo: relativeTime(completedGoal.fechaActualizacion),
      prioridad: 65,
    });
  } else if (advancedGoal && advancedGoal.progreso >= 75) {
    notifications.push({
      id: `goal-progress-${advancedGoal.id}-${Math.round(advancedGoal.progreso)}`,
      icono: '◎',
      iconBg: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10',
      titulo: 'Tu meta está cerca',
      detalle: `“${advancedGoal.nombre}” lleva un ${advancedGoal.progreso.toFixed(1)}% de avance.`,
      tipo: 'Meta',
      tiempo: 'Datos actuales',
      prioridad: 60,
    });
  }

  return notifications
    .sort((notificationA, notificationB) => notificationB.prioridad - notificationA.prioridad)
    .slice(0, 8);
}
