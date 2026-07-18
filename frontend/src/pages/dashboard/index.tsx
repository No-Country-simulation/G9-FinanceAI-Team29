import AiInsights from "../../components/dashboard/ai-insights"
import CategoryChart from "../../components/dashboard/category-chart"
import IncomeExpenseChart from "../../components/dashboard/income-expense-chart"
import SummaryCard from "../../components/dashboard/summary-card"
import TransactionList from "../../components/dashboard/transaction-list"

import {
  categoryData,
  insights,
  monthlyData,
  summaryCards,
  transactions,
} from "./dashboard-data"

export default function DashboardPage() {
  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-100">
          Resumen financiero
        </h1>

        <p className="mt-1 text-sm text-slate-400">
          Consultá el estado general de tus finanzas personales.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.title}
            title={card.title}
            value={card.value}
            change={card.change}
            trend={card.trend}
            icon={card.icon}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <IncomeExpenseChart data={monthlyData} />
        <CategoryChart data={categoryData} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <TransactionList transactions={transactions} />
        <AiInsights insights={insights} />
      </div>
    </section>
  )
}