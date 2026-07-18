import { useState } from "react"

import Button from "../ui/button"
import Input from "../ui/input"

import { expenseCategories } from "../../pages/transactions/transactions-data"

import type { FormEvent } from "react"
import type { Transaction } from "../../types/transaction"

interface TransactionFormProps {
  transaction?: Transaction
  onCancel: () => void
  onSave: (transaction: Omit<Transaction, "id">) => void
}

export default function TransactionForm({
  transaction,
  onCancel,
  onSave,
}: TransactionFormProps) {
  const [description, setDescription] = useState(
    transaction?.description ?? "",
  )

  const [amount, setAmount] = useState(
    transaction?.amount.toString() ?? "",
  )

  const [type, setType] = useState<Transaction["type"]>(
    transaction?.type ?? "expense",
  )

  const [category, setCategory] = useState(
    transaction?.category ?? expenseCategories[0],
  )

  const [date, setDate] = useState(
    transaction?.date ?? new Date().toISOString().split("T")[0],
  )

  const [error, setError] = useState("")

  function handleTypeChange(newType: Transaction["type"]) {
    setType(newType)

    if (newType === "income") {
      setCategory("Ingresos")
      return
    }

    if (
      category === "Ingresos" ||
      !expenseCategories.includes(category)
    ) {
      setCategory(expenseCategories[0])
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedDescription = description.trim()
    const parsedAmount = Number(amount)

    if (!normalizedDescription) {
      setError("Ingresá una descripción.")
      return
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Ingresá un monto válido mayor que cero.")
      return
    }

    if (!date) {
      setError("Seleccioná una fecha.")
      return
    }

    setError("")

    onSave({
      description: normalizedDescription,
      amount: parsedAmount,
      category: type === "income" ? "Ingresos" : category,
      date,
      type,
    })
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Input
        label="Descripción"
        type="text"
        value={description}
        placeholder="Ejemplo: Supermercado"
        onChange={(event) => setDescription(event.target.value)}
      />

      <Input
        label="Monto en USD"
        type="number"
        min="0.01"
        step="0.01"
        value={amount}
        placeholder="0.00"
        onChange={(event) => setAmount(event.target.value)}
      />

      <div className="space-y-2">
        <label
          htmlFor="transaction-type"
          className="block text-sm font-medium text-slate-300"
        >
          Tipo de movimiento
        </label>

        <select
          id="transaction-type"
          value={type}
          onChange={(event) =>
            handleTypeChange(
              event.target.value as Transaction["type"],
            )
          }
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500"
        >
          <option value="expense">Gasto</option>
          <option value="income">Ingreso</option>
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="transaction-category"
          className="block text-sm font-medium text-slate-300"
        >
          Categoría
        </label>

        <select
          id="transaction-category"
          value={category}
          disabled={type === "income"}
          onChange={(event) => setCategory(event.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {type === "income" ? (
            <option value="Ingresos">Ingresos</option>
          ) : (
            expenseCategories.map((expenseCategory) => (
              <option
                key={expenseCategory}
                value={expenseCategory}
              >
                {expenseCategory}
              </option>
            ))
          )}
        </select>

        {type === "expense" && (
          <p className="text-xs text-slate-500">
            Cuando se conecte el backend, esta categoría podrá ser
            sugerida automáticamente por el clasificador.
          </p>
        )}
      </div>

      <Input
        label="Fecha"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="w-full sm:w-auto"
        >
          Cancelar
        </Button>

        <Button
          type="submit"
          className="w-full sm:w-auto"
        >
          {transaction ? "Guardar cambios" : "Crear transacción"}
        </Button>
      </div>
    </form>
  )
}