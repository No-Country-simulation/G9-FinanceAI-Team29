import {
  ArrowDownCircle,
  ArrowUpCircle,
  WalletCards,
} from "lucide-react"

import Card from "../ui/card"
import type { Transaction } from "../../types/transaction"

interface TransactionSummaryProps {
  transactions: Transaction[]
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export default function TransactionSummary({
  transactions,
}: TransactionSummaryProps) {
  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0)

  const totalExpenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0)

  const balance = totalIncome - totalExpenses

  const summaryItems = [
    {
      title: "Ingresos",
      value: currencyFormatter.format(totalIncome),
      icon: ArrowUpCircle,
      iconClassName: "text-emerald-400",
      iconBackgroundClassName: "bg-emerald-500/10",
    },
    {
      title: "Gastos",
      value: currencyFormatter.format(totalExpenses),
      icon: ArrowDownCircle,
      iconClassName: "text-rose-400",
      iconBackgroundClassName: "bg-rose-500/10",
    },
    {
      title: "Balance",
      value: currencyFormatter.format(balance),
      icon: WalletCards,
      iconClassName:
        balance >= 0 ? "text-blue-400" : "text-amber-400",
      iconBackgroundClassName:
        balance >= 0 ? "bg-blue-500/10" : "bg-amber-500/10",
    },
  ]

  return (
    <section className="grid gap-4 md:grid-cols-3">
      {summaryItems.map((item) => {
        const Icon = item.icon

        return (
          <Card key={item.title}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">
                  {item.title}
                </p>

                <p className="mt-2 text-2xl font-bold text-white">
                  {item.value}
                </p>
              </div>

              <div
                className={[
                  "flex size-12 items-center justify-center rounded-xl",
                  item.iconBackgroundClassName,
                ].join(" ")}
              >
                <Icon
                  size={24}
                  className={item.iconClassName}
                />
              </div>
            </div>
          </Card>
        )
      })}
    </section>
  )
}