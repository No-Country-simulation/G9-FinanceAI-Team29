import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface IncomeExpensesChartProps {
  ingresos: number;
  gastos: number;
}

const formatMoney = (val: number) =>
  Number(val || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });

export default function IncomeExpensesChart({ ingresos, gastos }: IncomeExpensesChartProps) {
  const options: ApexOptions = {
    colors: ['#465fff', '#E5484D'],
    chart: {
      fontFamily: 'Outfit, sans-serif',
      type: 'bar',
      height: 180,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '50%',
        borderRadius: 5,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 4, colors: ['transparent'] },
    xaxis: {
      categories: ['Ingresos', 'Gastos'],
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    legend: { show: true, position: 'top', horizontalAlign: 'left' },
    yaxis: {
      title: { text: undefined },
      tooltip: { enabled: false },
    },
    grid: { yaxis: { lines: { show: true } } },
    fill: { opacity: 1 },
    tooltip: {
      y: { formatter: (val: number) => `$${formatMoney(val)}` },
    },
  };

  const series = [
    {
      name: 'Monto',
      data: [ingresos, gastos],
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
        Ingresos vs Gastos
      </h3>

      <div className="max-w-full overflow-x-auto custom-scrollbar flex-1 flex items-center">
        <div className="-ml-5 min-w-[400px] xl:min-w-full pl-2 w-full">
          <Chart options={options} series={series} type="bar" height={180} />
        </div>
      </div>

      <div className="flex justify-around mt-4 pb-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">Ingresos</p>
          <p className="text-lg font-bold text-success-600">
            ${formatMoney(ingresos)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Gastos</p>
          <p className="text-lg font-bold text-error-600">
            ${formatMoney(gastos)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm text-gray-500">Balance</p>
          <p className={`text-lg font-bold ${(Number(ingresos) - Number(gastos)) >= 0 ? 'text-success-600' : 'text-error-600'}`}>
            ${formatMoney(Number(ingresos) - Number(gastos))}
          </p>
        </div>
      </div>
    </div>
  );
}
