import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface CategoryPieChartProps {
  porCategoria: Record<string, number>;
  porcentajes: Record<string, number>;
}

export default function CategoryPieChart({ porCategoria, porcentajes }: CategoryPieChartProps) {
  const categorias = Object.keys(porCategoria);
  const montos = Object.values(porCategoria);

  const options: ApexOptions = {
    chart: {
      type: 'donut',
      fontFamily: 'Outfit, sans-serif',
    },
    labels: categorias,
    colors: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#7C8CF8', '#E7E9ED'],
    legend: {
      position: 'bottom',
      fontSize: '12px',
      fontFamily: 'Outfit',
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '14px',
            },
            value: {
              show: true,
              fontSize: '20px',
              fontWeight: 'bold',
              formatter: (val: string) => `$${Number(val).toLocaleString('es-ES', { minimumFractionDigits: 0 })}`,
            },
            total: {
              show: true,
              label: 'Total Gastos',
              formatter: () => {
                const total = montos.reduce((a, b) => a + b, 0);
                return `$${total.toLocaleString('es-ES', { minimumFractionDigits: 0 })}`;
              },
            },
          },
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      y: {
        formatter: (val: number) => `$${val.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`,
      },
    },
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Gastos por Categoría
      </h3>

      {categorias.length > 0 ? (
        <div className="max-w-[320px] mx-auto">
          <Chart options={options} series={montos} type="donut" height={280} />
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          No hay datos disponibles
        </div>
      )}

      <div className="mt-4 space-y-2">
        {categorias.map((cat) => (
          <div key={cat} className="flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">{cat}</span>
            <span className="font-medium text-gray-800 dark:text-white/90">
              ${porCategoria[cat]?.toLocaleString('es-ES', { minimumFractionDigits: 2 })} ({porcentajes[cat]}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
