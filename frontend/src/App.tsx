import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import ResetPassword from "./pages/AuthPages/ResetPassword";
import EmailPreview from "./pages/Dev/EmailPreview";
import MermaidPreview from "./pages/Dev/MermaidPreview";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Soporte from "./pages/Soporte";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import Transacciones from "./pages/Finance/Transacciones";
import Analisis from "./pages/Finance/Analisis";
import Recomendaciones from "./pages/Finance/Recomendaciones";
import AsistenteIA from "./pages/Ai/AsistenteIA";
import Metas from "./pages/Finance/Metas";
import Juegos from "./pages/Gamificacion/Juegos";
import ImportarCsv from "./pages/Finance/ImportarCsv";
import Terminos from "./pages/Legal/Terminos";
import PoliticaPrivacidad from "./pages/Legal/PoliticaPrivacidad";
import { AuthProvider } from "./context/AuthContext";
import { PerfilDataProvider } from "./context/PerfilDataContext";
import { GamificationProvider } from "./context/GamificationContext";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import { usePageVisibilityTitle } from "./hooks/usePageVisibilityTitle";
import { ConsoleBanner } from "./components/common/ConsoleBanner";

function TabTitleManager() {
  usePageVisibilityTitle();
  return null;
}

export default function App() {
  return (
    <>
      <Router>
        <ConsoleBanner />
        <AuthProvider>
        <PerfilDataProvider>
        <GamificationProvider>
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
            <Route path="/juegos" element={<Juegos />} />

            {/* Others Page */}
            <Route path="/profile" element={<UserProfiles />} />
            <Route path="/soporte" element={<Soporte />} />
          </Route>

          {/* Auth Layout */}
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Ruta oculta sin enlace en el menú: preview de correos de Supabase */}
          <Route path="/dev/email-preview" element={<EmailPreview />} />
          <Route path="/dev/mermaid-preview" element={<MermaidPreview />} />
          <Route path="/terminos" element={<Terminos />} />
          <Route path="/privacidad" element={<PoliticaPrivacidad />} />

          {/* Fallback Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <TabTitleManager />
        </GamificationProvider>
        </PerfilDataProvider>
        </AuthProvider>
      </Router>
    </>
  );
}
