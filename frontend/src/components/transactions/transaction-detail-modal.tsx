import type { Transaction } from "../../types/transaction"
import Modal from "../ui/modal"

interface TransactionDetailModalProps {
  isOpen: boolean
  transaction: Transaction | null
  onClose: () => void
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
})

export default function TransactionDetailModal({
  isOpen,
  transaction,
  onClose,
}: TransactionDetailModalProps) {
  if (!transaction) {
    return null
  }

  const isIncome = transaction.type === "income"

  return (
    <Modal
      isOpen={isOpen}
      title="Detalle del movimiento"
      onClose={onClose}
    >
      <dl className="space-y-4">
        <DetailRow label="Descripción" value={transaction.description} />
        <DetailRow label="Categoría" value={transaction.category} />
        <DetailRow
          label="Tipo"
          value={isIncome ? "Ingreso" : "Gasto"}
        />
        <DetailRow
          label="Monto"
          value={`${isIncome ? "+" : "-"}${currencyFormatter.format(
            transaction.amount,
          )}`}
          valueClassName={
            isIncome ? "text-emerald-400" : "text-rose-400"
          }
        />
        <DetailRow
          label="Fecha"
          value={dateFormatter.format(
            new Date(`${transaction.date}T00:00:00`),
          )}
        />
        <DetailRow
          label="Medio de pago"
          value={transaction.paymentMethod ?? "No informado"}
        />
        <DetailRow
          label="Recurrente"
          value={transaction.recurring ? "Sí" : "No"}
        />
        <DetailRow label="ID de operación" value={transaction.id} />
      </dl>
    </Modal>
  )
}

interface DetailRowProps {
  label: string
  value: string
  valueClassName?: string
}

function DetailRow({ label, value, valueClassName }: DetailRowProps) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-slate-800 pb-4 last:border-0 last:pb-0">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd
        className={`text-right text-sm font-medium ${
          valueClassName ?? "text-white"
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
