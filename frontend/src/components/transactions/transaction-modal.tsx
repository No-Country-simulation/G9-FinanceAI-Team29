import type { Transaction } from "../../types/transaction"

import Modal from "../ui/modal"
import TransactionForm from "./transaction-form"

interface TransactionModalProps {
  isOpen: boolean
  transaction?: Transaction
  onClose: () => void
  onSave: (transaction: Omit<Transaction, "id">) => void
}

export default function TransactionModal({
  isOpen,
  transaction,
  onClose,
  onSave,
}: TransactionModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      title={transaction ? "Editar transacción" : "Nueva transacción"}
      onClose={onClose}
    >
      <TransactionForm
        key={transaction?.id ?? "new-transaction"}
        transaction={transaction}
        onCancel={onClose}
        onSave={onSave}
      />
    </Modal>
  )
}