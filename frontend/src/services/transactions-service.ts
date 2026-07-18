import type {
  Transaction,
  TransactionResponseDTO,
  TransactionType,
} from "../types/transaction"
import api from "./api"

function mapTransactionType(type: string): TransactionType {
  return type.trim().toLowerCase() === "ingreso" ? "income" : "expense"
}

function mapTransaction(dto: TransactionResponseDTO): Transaction {
  return {
    id: dto.id,
    description: dto.descripcion,
    category: dto.categoria,
    amount: Number(dto.monto),
    date: dto.fecha,
    type: mapTransactionType(dto.tipo),
    paymentMethod: dto.medioPago,
    recurring: dto.recurrente ?? false,
  }
}

export async function getTransactions(
  userId: string,
): Promise<Transaction[]> {
  const { data } = await api.get<TransactionResponseDTO[]>(
    `/usuarios/${encodeURIComponent(userId)}/transacciones`,
  )

  return data.map(mapTransaction)
}
