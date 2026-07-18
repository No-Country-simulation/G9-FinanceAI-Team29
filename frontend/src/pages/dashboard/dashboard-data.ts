import {
  ArrowDownCircle,
  ArrowUpCircle,
  PiggyBank,
  WalletCards,
} from "lucide-react"

import { transactions } from "../transactions/transactions-data"

export { transactions }

export const summaryCards = [
  {
    title: "Balance total",
    value: "$1,856.16",
    change: "+8.4% respecto al mes anterior",
    trend: "up" as const,
    icon: WalletCards,
  },
  {
    title: "Ingresos",
    value: "$3,135.50",
    change: "+5.2% respecto al mes anterior",
    trend: "up" as const,
    icon: ArrowUpCircle,
  },
  {
    title: "Gastos",
    value: "$1,279.34",
    change: "-3.1% respecto al mes anterior",
    trend: "down" as const,
    icon: ArrowDownCircle,
  },
  {
    title: "Ahorro mensual",
    value: "$1,856.16",
    change: "59.2% de tus ingresos",
    trend: "up" as const,
    icon: PiggyBank,
  },
]

export const monthlyData = [
  {
    month: "Feb",
    ingresos: 2450,
    gastos: 1380,
  },
  {
    month: "Mar",
    ingresos: 2680,
    gastos: 1490,
  },
  {
    month: "Abr",
    ingresos: 2590,
    gastos: 1420,
  },
  {
    month: "May",
    ingresos: 2810,
    gastos: 1360,
  },
  {
    month: "Jun",
    ingresos: 2980,
    gastos: 1320,
  },
  {
    month: "Jul",
    ingresos: 3135.5,
    gastos: 1279.34,
  },
]

export const categoryData = [
  {
    name: "Vivienda",
    value: 650,
  },
  {
    name: "Alimentación",
    value: 138.45,
  },
  {
    name: "Compras",
    value: 95,
  },
  {
    name: "Servicios",
    value: 154.79,
  },
  {
    name: "Salud",
    value: 74.65,
  },
  {
    name: "Otros",
    value: 58.2,
  },
  {
    name: "Educación",
    value: 22.4,
  },
  {
    name: "Transporte",
    value: 18.5,
  },
  {
    name: "Ocio",
    value: 15.49,
  },
]

export const insights = [
  {
    id: 1,
    title: "Buen nivel de ahorro",
    message:
      "Este mes ahorraste más de la mitad de tus ingresos. Mantené este ritmo para alcanzar tus metas financieras.",
    type: "success" as const,
  },
  {
    id: 2,
    title: "Vivienda concentra tus gastos",
    message:
      "La categoría Vivienda representa la mayor parte de tus egresos del mes.",
    type: "warning" as const,
  },
  {
    id: 3,
    title: "Gastos en alimentación controlados",
    message:
      "Tus gastos de alimentación se mantienen dentro de un rango estable respecto de los meses anteriores.",
    type: "info" as const,
  },
]