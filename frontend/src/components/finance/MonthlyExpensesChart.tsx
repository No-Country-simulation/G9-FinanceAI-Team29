import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';
import { Transaccion } from '../../types/finance';

interface MonthlyExpensesChartProps {
  transacciones: Transaccion[];
}

export default function MonthlyExpensesChart({ transacciones }: MonthlyExpensesChartProps) {
  const totalesPorMes = new Map<string, number>();

  transacciones
    .filter(t => t.tipo === 'Gasto')
    .forEach(t => {
      const fecha = new Date(t.fecha);
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      totalesPorMes.set(clave, (totalesPorMes.get(clave) || 0) + t.monto);
    });

  const clavesOrdenadas = Array.from(totalesPorMes.keys()).sort();
  const mostrarAnio = new Set(clavesOrdenadas.map(c => c.split('-')[0])).size > 1;

  const categorias = clavesOrdenadas.map(clave => {
    const [anio, mes] = clave.split('-');
    const etiqueta = new Date(Number(anio), Number(mes) - 1, 1)
      .toLocaleDateString('es-ES', { month: 'short' })
      .replace('.', '');
    const capitalizada = etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
    return mostrarAnio ? `${capitalizada} ${anio.slice(2)}` : capitalizada;
  });

  const data = clavesOrdenadas.map(clave => totalesPorMes.get(clave) || 0);

  const options: ApexOptions = {
    colors: ['#465fff'],
    chart: {
      fontFamily: 'Outfit, sans-serif',
      type: 'bar',
      height: 180,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '39%',
        borderRadius: 5,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 4, colors: ['transparent'] },
    xaxis: {
      categories: categorias,
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    legend: { show: false },
    yaxis: {
      title: { text: undefined },
      labels: {
        formatter: (val: number) => `$${Math.round(val).toLocaleString('es-ES')}`,
      },
    },
    grid: { yaxis: { lines: { show: true } } },
    fill: { opacity: 1 },
    tooltip: {
      y: { formatter: (val: number) => `$${val.toLocaleString('es-ES', { minimumFractionDigits: 2 })}` },
    },
  };

  const series = [
    {
      name: 'Gastos',
      data,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Gastos Mensuales
      </h3>

      {data.length > 0 ? (
        <div className="max-w-full overflow-x-auto custom-scrollbar">
          <div className="-ml-5 min-w-[400px] xl:min-w-full pl-2">
            <Chart options={options} series={series} type="bar" height={180} />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-gray-500">
          No hay gastos registrados
        </div>
      )}
    </div>
  );
}
