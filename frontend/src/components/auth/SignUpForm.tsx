import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { mostrarError, mostrarExito } from "../../utils/alerts";
import { useAuth } from "../../context/AuthContext";

export default function SignUpForm() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const faltantes: string[] = [];
    if (!nombre) faltantes.push("Nombre");
    if (!apellido) faltantes.push("Apellido");
    if (!email) faltantes.push("Correo electrónico");
    if (!password) faltantes.push("Contraseña");
    if (!isChecked) faltantes.push("Aceptar los Términos y Condiciones");

    const TOTAL_CAMPOS = 5;
    if (faltantes.length === TOTAL_CAMPOS) {
      await mostrarError(
        "Faltan todos los campos",
        "Debes completar tu nombre, apellido, correo y contraseña, además de aceptar los Términos y Condiciones, para poder continuar."
      );
      return;
    }

    if (faltantes.length > 0) {
      const texto =
        faltantes.length === 1
          ? `Falta completar: ${faltantes[0]}.`
          : `Faltan completar los siguientes campos: ${faltantes.join(", ")}.`;
      await mostrarError("Faltan datos", texto);
      return;
    }

    setEnviando(true);
    try {
      await signUp(email.trim(), password, { nombre, apellido });
      await mostrarExito(
        "¡Cuenta creada!",
        "Revisa tu correo para confirmar tu cuenta antes de iniciar sesión."
      );
      navigate("/signin");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[SignUp] Supabase auth error:", msg, err);
      let texto = msg;
      if (/user already registered|already registered/i.test(msg)) {
        texto = "Ese correo ya está registrado. Intenta iniciar sesión.";
      } else if (/password should be at least/i.test(msg)) {
        texto = "La contraseña es muy corta. Debe tener al menos 6 caracteres.";
      } else if (/invalid email/i.test(msg)) {
        texto = "El correo ingresado no es válido.";
      }
      await mostrarError("Registro fallido", texto);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="w-full max-w-md pt-4 sm:pb-6 mx-auto sm:hidden">
        <Link
          to="/signin"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          Volver a inicio de sesión
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <Link
              to="/signin"
              className="hidden sm:inline-flex items-center mb-4 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <ChevronLeftIcon className="size-5" />
              Volver a inicio de sesión
            </Link>
            <Link to="/" className="inline-block">
              <img
                width={231}
                height={60}
                src="/images/logo/logo.png"
                alt="FinSightAI"
                className="h-auto w-[231px] object-contain dark:hidden"
              />
              <img
                width={231}
                height={60}
                src="/images/logo/logo_white.png"
                alt="FinSightAI"
                className="hidden h-auto w-[231px] object-contain dark:block"
              />
            </Link>
            <div
              className="my-5 h-0.5 w-full rounded-full bg-brand-500 dark:bg-brand-400"
              aria-hidden="true"
            />
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Crear Cuenta
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Completa tus datos para crear una cuenta.
            </p>
          </div>
          <div>
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-1">
                    <Label>
                      Nombre <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      id="fname"
                      name="fname"
                      placeholder="Ingresa tu nombre"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <Label>
                      Apellido <span className="text-error-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      id="lname"
                      name="lname"
                      placeholder="Ingresa tu apellido"
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label>
                    Correo electrónico <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input
                    type="email"
                    id="email"
                    name="email"
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
                <div className="flex items-center gap-3">
                  <Checkbox checked={isChecked} onChange={setIsChecked} />
                  <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    Acepto los{" "}
                    <span className="text-gray-800 dark:text-white/90">
                      Términos y Condiciones
                    </span>{" "}
                    y la{" "}
                    <span className="text-gray-800 dark:text-white/90">
                      Política de Privacidad
                    </span>
                  </span>
                </div>
                <div>
                  <Button className="w-full" size="sm" disabled={enviando}>
                    {enviando ? "Creando…" : "Crear cuenta"}
                  </Button>
                </div>
              </div>
            </form>

            <div className="mt-5">
              <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
                ¿Ya tienes una cuenta? {""}
                <Link
                  to="/signin"
                  className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  Inicia sesión
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
