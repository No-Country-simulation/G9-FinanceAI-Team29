import { Outlet } from "react-router"
import Sidebar from "../components/layout/sidebar"
import Topbar from "../components/layout/topbar"

export default function MainLayout() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}