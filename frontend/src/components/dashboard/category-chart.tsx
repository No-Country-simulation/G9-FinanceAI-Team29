import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

interface CategoryData {
  name: string
  value: number
}

interface CategoryChartProps {
  data: CategoryData[]
}

const categoryColors = [
  "#3b82f6",
  "#8b5cf6",
  "#06b6d4",
  "#f59e0b",
  "#22c55e",
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

export default function CategoryChart({
  data,
}: CategoryChartProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <h2 className="text-lg font-semibold text-slate-100">
        Gastos por categoría
      </h2>

      <p className="mt-1 text-sm text-slate-400">
        Distribución de gastos del mes.
      </p>

      <div className="mt-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={4}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.name}
                  fill={categoryColors[index % categoryColors.length]}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid #334155",
                borderRadius: "12px",
              }}
            />

            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </article>
  )
}