import type { LucideIcon } from "lucide-react"

export interface SummaryCard {
  title: string
  value: string
  change: string
  trend: "up" | "down"
  icon: LucideIcon
}

export interface MonthlyData {
  month: string
  ingresos: number
  gastos: number
}

export interface CategoryData {
  name: string
  value: number
}

export interface Insight {
  id: number
  message: string
  type: "info" | "success" | "warning"
}