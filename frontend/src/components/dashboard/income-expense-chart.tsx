import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

interface MonthlyData {
  month: string
  ingresos: number
  gastos: number
}

interface IncomeExpenseChartProps {
  data: MonthlyData[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

export default function IncomeExpenseChart({
  data,
}: IncomeExpenseChartProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 xl:col-span-2">
      <h2 className="text-lg font-semibold text-slate-100">
        Ingresos y gastos
      </h2>

      <p className="mt-1 text-sm text-slate-400">
        Evolución mensual de tus finanzas.
      </p>

      <div className="mt-6 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />

            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />

            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "12px",
              }}
            />

            <Legend />

            <Bar
              dataKey="ingresos"
              fill="#22c55e"
              radius={[6, 6, 0, 0]}
            />

            <Bar
              dataKey="gastos"
              fill="#ef4444"
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}