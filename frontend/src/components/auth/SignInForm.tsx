import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { Link, useLocation, useNavigate } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { mostrarError, mostrarExito } from "../../utils/alerts";
import { useAuth } from "../../context/AuthContext";
import { obtenerPerfilCompleto } from "../../services/api";
import AuthLegalFooter from "./AuthLegalFooter";
import AuthBrandWithMascot from "./AuthBrandWithMascot";

const ESPERA_USUARIO_MS = 6000;
const INTERVALO_POLL_MS = 100;

const API_BASE =
  import.meta.env.VITE_API_URL ?? "http://localhost:8081/api";

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SignInForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const vieneDeCerrarSesion = Boolean(
    (location.state as { loggedOut?: boolean } | null)?.loggedOut
  );
  const { signIn, usuarioId, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Referencia siempre al día con el estado de auth más reciente, para
  // poder "esperarlo" desde dentro del handler async sin depender de
  // closures viejas.
  const authRef = useRef({ usuarioId, authLoading });
  useEffect(() => {
    authRef.current = { usuarioId, authLoading };
  }, [usuarioId, authLoading]);

  /**
   * Tras autenticar, esperamos a que el usuarioId (USRxxxx) y el nombre
   * completo del perfil estén resueltos ANTES de navegar al dashboard.
   * Así el botón se queda con su animación de carga y el splash de
   * bienvenida aparece ya con el nombre listo, sin pantallas intermedias.
   */
  const prepararBienvenidaYNavegar = async () => {
    const limite = Date.now() + ESPERA_USUARIO_MS;
    let idResuelto = authRef.current.usuarioId;

    while (
      (authRef.current.authLoading || !authRef.current.usuarioId) &&
      Date.now() < limite
    ) {
      await esperar(INTERVALO_POLL_MS);
      idResuelto = authRef.current.usuarioId;
    }

    let nombreCompleto = "";

    if (idResuelto) {
      try {
        const perfilCompleto = await obtenerPerfilCompleto(idResuelto);
        nombreCompleto = `${perfilCompleto.nombre ?? ""} ${perfilCompleto.apellido ?? ""}`.trim();
      } catch {
        // Si falla, el splash cae de vuelta a un saludo genérico.
      }
    }

    sessionStorage.setItem("finsight.showWelcomeSplash", "1");
    sessionStorage.setItem("finsight.welcomeNombre", nombreCompleto);
    navigate("/");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      await mostrarError(
        "Inicio de sesión fallido",
        "Por favor completa tu correo y contraseña."
      );
      return;
    }

    setEnviando(true);
    try {
      await signIn(email.trim(), password);
      await prepararBienvenidaYNavegar();
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Login] Error de autenticación:", msg, err);

      // Cuenta sin confirmar: ofrecemos reenviar el correo.
      if (/email_no_confirmado/i.test(msg)) {
        const r = await Swal.fire({
          icon: "info",
          title: "Confirmá tu correo",
          text: "Tenés que confirmar tu cuenta antes de ingresar. Revisá tu casilla (y el spam).",
          showCancelButton: true,
          confirmButtonText: "Reenviar correo",
          cancelButtonText: "Cerrar",
          confirmButtonColor: "#465fff",
        });
        if (r.isConfirmed) await reenviarConfirmacion(email.trim());
        return;
      }

      let titulo = "Inicio de sesión fallido";
      let texto = msg;
      if (/servidor_iniciando/i.test(msg)) {
        titulo = "El servidor esta en frio";
        texto = "volvé a intentar y veras que esta todo bons :)";
      } else if (/credenciales_invalidas|invalid login credentials/i.test(msg)) {
        texto = "Correo o contraseña incorrectos.";
      }
      await mostrarError(titulo, texto);
    } finally {
      setEnviando(false);
    }
  };

  const reenviarConfirmacion = async (correo: string) => {
    try {
      await fetch(`${API_BASE}/auth/v2/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: correo.trim().toLowerCase() }),
      });
      await mostrarExito(
        "Correo reenviado",
        "Si tu cuenta está pendiente de confirmación, te reenviamos el enlace. Revisá tu casilla (y el spam)."
      );
    } catch {
      await mostrarError("No se pudo reenviar", "Ocurrió un error de red. Intenta nuevamente.");
    }
  };

  const solicitarRecuperacion = async () => {
    const resultado = await Swal.fire({
      title: "Recuperar contraseña",
      input: "email",
      inputLabel: "Correo electrónico",
      inputPlaceholder: "info@gmail.com",
      inputValue: email,
      showCancelButton: true,
      confirmButtonText: "Enviar enlace",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#465fff",
      inputValidator: (value) => (!value ? "Ingresa tu correo electrónico." : undefined),
    });

    if (!resultado.isConfirmed || !resultado.value) return;

    try {
      const response = await fetch(`${API_BASE}/auth/v2/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resultado.value.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        await mostrarError("No se pudo enviar el enlace", data?.mensaje ?? "Intenta nuevamente.");
        return;
      }

      await mostrarExito(
        "Revisa tu correo",
        data?.mensaje ?? "Si el correo existe en nuestro sistema, te enviamos un enlace para restablecer tu contraseña."
      );
    } catch {
      await mostrarError("No se pudo enviar el enlace", "Ocurrió un error de red. Intenta nuevamente.");
    }
  };

  return (
    <div className="flex flex-col flex-1">
      {vieneDeCerrarSesion && (
        <div className="w-full max-w-md pt-10 mx-auto">
          <Link
            to="/"
            className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            <ChevronLeftIcon className="size-5" />
            Volver al panel
          </Link>
        </div>
      )}
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <AuthBrandWithMascot />
            <div
              className="my-5 h-0.5 w-full rounded-full bg-brand-500 dark:bg-brand-400"
              aria-hidden="true"
            />
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Iniciar Sesión
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ingresa tu correo y contraseña para iniciar sesión.
            </p>
          </div>
          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    Correo electrónico <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input
                    placeholder="info@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label>
                    Contraseña <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Ingresa tu contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox checked={isChecked} onChange={setIsChecked} />
                    <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                      Mantener sesión iniciada
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={solicitarRecuperacion}
                    className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <div>
                  <Button type="submit" className="w-full" size="sm" disabled={enviando}>
                    {enviando ? "Iniciando…" : "Iniciar sesión"}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
                ¿No tienes una cuenta? {""}
                <Link
                  to="/signup"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Regístrate
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      <AuthLegalFooter />
    </div>
  );
}
