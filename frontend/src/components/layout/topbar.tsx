import { Bell, UserRound } from "lucide-react"

export default function Topbar() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-800 bg-slate-900 px-6">
      <div>
        <p className="text-sm text-slate-400">Bienvenido</p>
        <p className="font-semibold text-slate-100">Panel financiero</p>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Notificaciones"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <Bell size={20} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-slate-700">
            <UserRound size={20} />
          </div>

          <div className="hidden sm:block">
            <p className="text-sm font-medium">Usuario</p>
            <p className="text-xs text-slate-400">Mi cuenta</p>
          </div>
        </div>
      </div>
    </header>
  )
}