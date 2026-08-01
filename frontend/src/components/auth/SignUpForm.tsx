import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import { crearUsuario } from "../../services/api";
import { supabase } from "../../services/supabase";
import { mostrarError, mostrarExito } from "../../utils/alerts";

export default function SignUpForm() {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nombreLimpio = nombre.trim();
    const apellidoLimpio = apellido.trim();
    const emailLimpio = email.trim().toLowerCase();

    const faltantes: string[] = [];
    if (!nombreLimpio) faltantes.push("Nombre");
    if (!apellidoLimpio) faltantes.push("Apellido");
    if (!emailLimpio) faltantes.push("Correo electrónico");
    if (!password) faltantes.push("Contraseña");
    if (!isChecked) faltantes.push("Aceptar los Términos y Condiciones");

    const totalCampos = 5;
    if (faltantes.length === totalCampos) {
      await mostrarError(
        "Faltan todos los campos",
        "Debes completar tu nombre, apellido, correo y contraseña, además de aceptar los Términos y Condiciones, para poder continuar.",
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

    setLoading(true);

    try {
      const { data, error: supabaseError } = await supabase.auth.signUp({
        email: emailLimpio,
        password,
        options: {
          data: {
            nombre: nombreLimpio,
            apellido: apellidoLimpio,
          },
        },
      });

      if (supabaseError) {
        throw new Error(supabaseError.message);
      }

      if (!data.user) {
        throw new Error(
          "Supabase no devolvió el usuario creado. Revisa la configuración de Auth.",
        );
      }

      // En algunos casos Supabase oculta que un email ya estaba registrado.
      if (data.user.identities && data.user.identities.length === 0) {
        throw new Error("Ya existe una cuenta registrada con ese email.");
      }

      const perfil = await crearUsuario({
        nombre: nombreLimpio,
        apellido: apellidoLimpio,
        email: emailLimpio,
        authUserId: data.user.id,
      });

      // AuthContext busca el usuario del backend usando el UUID de Supabase.
      localStorage.setItem(
        `finsight.usuarioId.${data.user.id}`,
        perfil.usuarioId,
      );

      if (data.session) {
        await mostrarExito(
          "¡Cuenta creada!",
          `Tu identificador es ${perfil.usuarioId}.`,
        );
        // Recarga la aplicación para que AuthContext lea la asociación guardada.
        window.location.assign("/");
      } else {
        await mostrarExito(
          "¡Cuenta creada!",
          "Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.",
        );
        navigate("/signin");
      }
    } catch (err) {
      const mensajeError = err instanceof Error ? err.message : String(err);
      console.error("[SignUp] Supabase auth error:", mensajeError, err);

      let texto = mensajeError;
      if (/user already registered|already registered|ya existe una cuenta/i.test(mensajeError)) {
        texto = "Ese correo ya está registrado. Intenta iniciar sesión.";
      } else if (/password should be at least/i.test(mensajeError)) {
        texto = "La contraseña es muy corta. Debe tener al menos 6 caracteres.";
      } else if (/invalid email/i.test(mensajeError)) {
        texto = "El correo ingresado no es válido.";
      }

      await mostrarError("Registro fallido", texto);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full overflow-y-auto no-scrollbar lg:px-8 xl:px-12">
      <div className="w-full max-w-md mx-auto mb-5 sm:pt-10">
        <Link
          to="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon className="size-5" />
          Volver al inicio de sesión
        </Link>
      </div>

      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Crear cuenta
            </h1>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Regístrate para comenzar a ver más allá de tus finanzas.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <Label>
                    Nombre<span className="text-error-500">*</span>
                  </Label>

                  <Input
                    type="text"
                    id="nombre"
                    name="nombre"
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    placeholder="Ingresa tu nombre"
                    disabled={loading}
                  />
                </div>

                <div className="sm:col-span-1">
                  <Label>
                    Apellido<span className="text-error-500">*</span>
                  </Label>

                  <Input
                    type="text"
                    id="apellido"
                    name="apellido"
                    value={apellido}
                    onChange={(event) => setApellido(event.target.value)}
                    placeholder="Ingresa tu apellido"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <Label>
                  Email<span className="text-error-500">*</span>
                </Label>

                <Input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nombre@correo.com"
                  disabled={loading}
                />
              </div>

              <div>
                <Label>
                  Contraseña<span className="text-error-500">*</span>
                </Label>

                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    type={showPassword ? "text" : "password"}
                    disabled={loading}
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((valor) => !valor)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    aria-label={
                      showPassword
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                    }
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  className="w-5 h-5 mt-0.5"
                  checked={isChecked}
                  onChange={setIsChecked}
                />

                <p className="inline-block text-sm font-normal text-gray-500 dark:text-gray-400">
                  Acepto los{" "}
                  <Link
                    to="/terminos"
                    state={{ from: "/signup" }}
                    className="text-gray-800 underline hover:text-brand-500 dark:text-white/90 dark:hover:text-brand-400"
                  >
                    términos y condiciones
                  </Link>{" "}
                  y la{" "}
                  <Link
                    to="/privacidad"
                    state={{ from: "/signup" }}
                    className="text-gray-800 underline hover:text-brand-500 dark:text-white dark:hover:text-brand-400"
                  >
                    política de privacidad
                  </Link>
                  .
                </p>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-start">
              ¿Ya tienes una cuenta?{" "}
              <Link
                to="/signin"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Iniciar sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
