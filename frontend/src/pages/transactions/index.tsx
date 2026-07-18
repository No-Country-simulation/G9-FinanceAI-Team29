import { useEffect, useMemo, useState } from "react"
import axios from "axios"

import TransactionDetailModal from "../../components/transactions/transaction-detail-modal"
import TransactionFilters from "../../components/transactions/transaction-filters"
import TransactionSummary from "../../components/transactions/transaction-summary"
import TransactionTable from "../../components/transactions/transaction-table"
import Button from "../../components/ui/button"
import Loader from "../../components/ui/loader"
import { getTransactions } from "../../services/transactions-service"
import type { Transaction } from "../../types/transaction"

const userId = import.meta.env.VITE_USER_ID ?? "USR0001"

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedType, setSelectedType] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("Todas")
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadTransactions() {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const data = await getTransactions(userId)

        if (isMounted) {
          setTransactions(data)
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        if (axios.isAxiosError(error) && !error.response) {
          setErrorMessage(
            "No pudimos conectarnos con el backend. Verificá que Spring Boot esté ejecutándose en el puerto 8080.",
          )
        } else {
          setErrorMessage(
            "No pudimos cargar los movimientos. Intentá nuevamente.",
          )
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadTransactions()

    return () => {
      isMounted = false
    }
  }, [reloadKey])

  const transactionCategories = useMemo(() => {
    const categories = Array.from(
      new Set(transactions.map((transaction) => transaction.category)),
    ).sort((a, b) => a.localeCompare(b, "es"))

    return ["Todas", ...categories]
  }, [transactions])

  const filteredTransactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return transactions.filter((transaction) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        transaction.description.toLowerCase().includes(normalizedSearch) ||
        transaction.category.toLowerCase().includes(normalizedSearch)

      const matchesType =
        selectedType === "all" || transaction.type === selectedType

      const matchesCategory =
        selectedCategory === "Todas" ||
        transaction.category === selectedCategory

      return matchesSearch && matchesType && matchesCategory
    })
  }, [transactions, searchTerm, selectedType, selectedCategory])

  return (
    <>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-white">
            Historial de movimientos
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Consultá las operaciones generadas automáticamente por FinSightAI.
          </p>
        </header>

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
            <Loader />
          </div>
        ) : errorMessage ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center">
            <p className="text-sm text-rose-200">{errorMessage}</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <TransactionSummary transactions={transactions} />

            <TransactionFilters
              searchTerm={searchTerm}
              selectedType={selectedType}
              selectedCategory={selectedCategory}
              categories={transactionCategories}
              onSearchChange={setSearchTerm}
              onTypeChange={setSelectedType}
              onCategoryChange={setSelectedCategory}
            />

            <p className="text-sm text-slate-400">
              {filteredTransactions.length} movimiento
              {filteredTransactions.length === 1 ? "" : "s"}
            </p>

            <TransactionTable
              transactions={filteredTransactions}
              onView={setSelectedTransaction}
            />
          </>
        )}
      </div>

      <TransactionDetailModal
        isOpen={selectedTransaction !== null}
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </>
  )
}
