export type TransactionType = "income" | "expense"

export interface Transaction {
  id: string
  description: string
  category: string
  amount: number
  date: string
  type: TransactionType
  paymentMethod: string | null
  recurring: boolean
}

export interface TransactionResponseDTO {
  id: string
  descripcion: string
  monto: number
  categoria: string
  fecha: string
  tipo: string
  medioPago: string | null
  recurrente: boolean | null
}
