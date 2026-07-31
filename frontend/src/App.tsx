import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import Transacciones from "./pages/Finance/Transacciones";
import Analisis from "./pages/Finance/Analisis";
import Recomendaciones from "./pages/Finance/Recomendaciones";
import AsistenteIA from "./pages/Ai/AsistenteIA";
import Metas from "./pages/Finance/Metas";
import ImportarCsv from "./pages/Finance/ImportarCsv";
import Terminos from "./pages/Legal/Terminos";
import PoliticaPrivacidad from "./pages/Legal/PoliticaPrivacidad";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { usePageVisibilityTitle } from "./hooks/usePageVisibilityTitle";
import { ConsoleBanner } from "./components/common/ConsoleBanner";

export default function App() {
  usePageVisibilityTitle();

  return (
    <>
      <Router>
        <ConsoleBanner />
        <AuthProvider>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout (rutas privadas) */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index path="/" element={<Home />} />
            
            {/* Finance Pages */}
            <Route path="/transacciones" element={<Transacciones />} />
            <Route path="/importar-csv" element={<ImportarCsv />} />
            <Route path="/analisis" element={<Analisis />} />
            <Route path="/recomendaciones" element={<Recomendaciones />} />
            <Route path="/metas" element={<Metas />} />
            <Route path="/asistente-ia" element={<AsistenteIA />} />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
          </Route>

          {/* Auth Layout */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<PoliticaPrivacidad />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AuthProvider>
      </Router>
    </>
  );
}
