import {
  BrainCircuit,
  CreditCard,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Target,
} from "lucide-react"

export const navigationItems = [
  {
    label: "Inicio",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Movimientos",
    path: "/transactions",
    icon: CreditCard,
  },
  {
    label: "Presupuestos",
    path: "/budgets",
    icon: PiggyBank,
  },
  {
    label: "Metas",
    path: "/goals",
    icon: Target,
  },
  {
    label: "IA",
    path: "/ai",
    icon: BrainCircuit,
  },
  {
    label: "Configuración",
    path: "/settings",
    icon: Settings,
  },
]