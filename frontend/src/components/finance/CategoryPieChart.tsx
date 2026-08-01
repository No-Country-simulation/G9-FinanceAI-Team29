import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface CategoryPieChartProps {
  porCategoria: Record<string, number>;
  porcentajes: Record<string, number>;
}

const CATEGORY_COLORS = [
  '#465FFF',
  '#12B76A',
  '#F79009',
  '#0BA5EC',
  '#7A5AF8',
  '#F04438',
  '#06AED4',
  '#EE46BC',
  '#6172F3',
  '#F63D68',
  '#667085',
];

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactMoney = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function CategoryPieChart({ porCategoria, porcentajes }: CategoryPieChartProps) {
  const categorias = Object.entries(porCategoria)
    .filter(([, monto]) => Number.isFinite(monto) && monto > 0)
    .sort(([, montoA], [, montoB]) => montoB - montoA);

  const labels = categorias.map(([categoria]) => categoria);
  const montos = categorias.map(([, monto]) => monto);
  const total = montos.reduce((acumulado, monto) => acumulado + monto, 0);

  const options: ApexOptions = {
    chart: {
      type: 'donut',
      fontFamily: 'Outfit, sans-serif',
      toolbar: {
        show: false,
      },
    },
    labels,
    colors: CATEGORY_COLORS,
    stroke: {
      show: true,
      width: 3,
      colors: ['#ffffff'],
    },
    legend: {
      show: false,
    },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '12px',
              fontWeight: 500,
              color: '#667085',
              offsetY: -2,
            },
            value: {
              show: true,
              fontSize: '18px',
              fontWeight: 700,
              color: '#1D2939',
              offsetY: 4,
              formatter: (value: string) => compactMoney.format(Number(value)),
            },
            total: {
              show: true,
              showAlways: true,
              label: 'Gasto total',
              fontSize: '18px',
              fontWeight: 700,
              color: '#1D2939',
              formatter: () => compactMoney.format(total),
            },
          },
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      enabled: true,
      theme: 'light',
      fillSeriesColor: false,
      marker: {
        show: true,
      },
      style: {
        fontSize: '14px',
        fontFamily: 'Outfit, sans-serif',
      },
      y: {
        formatter: (value: number, context) => {
          const categoria = labels[context.seriesIndex];
          const porcentaje =
            porcentajes[categoria] ?? (total > 0 ? (value / total) * 100 : 0);

          return `${money.format(value)} · ${porcentaje.toLocaleString('es-CL', {
            maximumFractionDigits: 1,
          })}%`;
        },
      },
    },
    states: {
      hover: {
        filter: {
          type: 'lighten',
        },
      },
    },
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="mb-2">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Gastos por Categoría
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Distribución del gasto total por categoría
        </p>
      </div>

      {categorias.length > 0 && total > 0 ? (
        <>
          <div
            className="mx-auto my-2 max-w-[280px]"
            role="img"
            aria-label={`Gráfico de gastos por categoría. Gasto total: ${money.format(total)}`}
          >
            <Chart options={options} series={montos} type="donut" height={260} />
          </div>

          <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {categorias.map(([categoria, monto], index) => {
              const porcentaje =
                porcentajes[categoria] ?? (total > 0 ? (monto / total) * 100 : 0);

              return (
                <div
                  key={categoria}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {categoria}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-right">
                    <span className="text-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">
                      {money.format(monto)}
                    </span>
                    <span className="min-w-11 rounded-full bg-gray-100 px-2 py-0.5 text-center text-xs font-medium tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {porcentaje.toLocaleString('es-CL', { maximumFractionDigits: 1 })}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex h-64 items-center justify-center text-gray-500">
          No hay datos disponibles
        </div>
      )}
    </div>
  );
}
