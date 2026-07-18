import type { Transaction } from "../../types/transaction"

interface TransactionListProps {
  transactions: Transaction[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value)
}

export default function TransactionList({
  transactions,
}: TransactionListProps) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6 xl:col-span-2">
      <h2 className="text-lg font-semibold text-slate-100">
        Últimos movimientos
      </h2>

      <p className="mt-1 text-sm text-slate-400">
        Tus operaciones más recientes.
      </p>

      <div className="mt-5 divide-y divide-slate-800">
        {transactions.map((transaction) => {
          const isIncome = transaction.type === "income"

          return (
            <div
              key={transaction.id}
              className="flex items-center justify-between py-4"
            >
              <div>
                <p className="font-medium text-slate-100">
                  {transaction.description}
                </p>

                <p className="text-sm text-slate-400">
                  {transaction.category} · {transaction.date}
                </p>
              </div>

              <p
                className={
                  isIncome
                    ? "font-semibold text-emerald-400"
                    : "font-semibold text-rose-400"
                }
              >
                {isIncome ? "+" : "-"}
                {formatCurrency(Math.abs(transaction.amount))}
              </p>
            </div>
          )
        })}
      </div>
    </article>
  )
}