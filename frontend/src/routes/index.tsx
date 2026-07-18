import { BrowserRouter, Route, Routes } from "react-router"

import MainLayout from "../layouts/main-layout"
import AiPage from "../pages/ai"
import BudgetsPage from "../pages/budgets"
import DashboardPage from "../pages/dashboard"
import GoalsPage from "../pages/goals"
import LoginPage from "../pages/login"
import RegisterPage from "../pages/register"
import SettingsPage from "../pages/settings"
import TransactionsPage from "../pages/transactions"

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="ai" element={<AiPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}