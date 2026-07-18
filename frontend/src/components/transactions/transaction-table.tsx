import { Eye } from "lucide-react"

import type { Transaction } from "../../types/transaction"
import Badge from "../ui/badge"
import Button from "../ui/button"

interface TransactionTableProps {
  transactions: Transaction[]
  onView: (transaction: Transaction) => void
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

export default function TransactionTable({
  transactions,
  onView,
}: TransactionTableProps) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="text-sm text-slate-400">
          No se encontraron movimientos.
        </p>
      </div>
    )
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px]">
          <thead className="border-b border-slate-800 bg-slate-950/60">
            <tr>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-400">
                Fecha
              </th>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-400">
                Descripción
              </th>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-400">
                Categoría
              </th>
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase text-slate-400">
                Tipo
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase text-slate-400">
                Monto
              </th>
              <th className="px-5 py-4 text-right text-xs font-semibold uppercase text-slate-400">
                Detalle
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800">
            {transactions.map((transaction) => {
              const isIncome = transaction.type === "income"

              return (
                <tr
                  key={transaction.id}
                  className="hover:bg-slate-800/40"
                >
                  <td className="px-5 py-4 text-sm text-slate-400">
                    {dateFormatter.format(
                      new Date(`${transaction.date}T00:00:00`),
                    )}
                  </td>
                  <td className="px-5 py-4 font-medium text-white">
                    {transaction.description}
                  </td>
                  <td className="px-5 py-4 text-slate-300">
                    {transaction.category}
                  </td>
                  <td className="px-5 py-4">
                    <Badge>{isIncome ? "Ingreso" : "Gasto"}</Badge>
                  </td>
                  <td
                    className={`px-5 py-4 text-right font-semibold ${
                      isIncome ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {isIncome ? "+" : "-"}
                    {currencyFormatter.format(transaction.amount)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end">
                      <Button
                        variant="secondary"
                        onClick={() => onView(transaction)}
                        aria-label={`Ver detalle de ${transaction.description}`}
                      >
                        <Eye size={16} />
                        Ver
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
