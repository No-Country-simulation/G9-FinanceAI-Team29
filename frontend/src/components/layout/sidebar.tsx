import { NavLink } from "react-router"
import {
  BrainCircuit,
  CreditCard,
  LayoutDashboard,
  PiggyBank,
  Settings,
  Target,
} from "lucide-react"

import logo from "../../assets/images/logo.png"

const navigationItems = [
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

export default function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 border-r border-slate-800 bg-slate-900 md:flex md:flex-col">
      <div className="flex h-28 items-center justify-center border-b border-slate-800 px-4">
        <img
          src={logo}
          alt="FinSightAI"
          className="h-16 w-auto"
        />
      </div>

      <nav className="flex flex-1 flex-col gap-2 p-4">
        {navigationItems.map((item) => {
          const Icon = item.icon

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                ].join(" ")
              }
            >
              <Icon size={20} />
              {item.label}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}