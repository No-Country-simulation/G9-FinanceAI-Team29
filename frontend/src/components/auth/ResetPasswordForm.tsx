import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Button from "../ui/button/Button";
import { mostrarError, mostrarExito } from "../../utils/alerts";
import { supabase } from "../../services/supabase";
import PasswordStrengthMeter from "./PasswordStrengthMeter";

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_HINT =
  "Mínimo 8 caracteres, con al menos una mayúscula, una minúscula, un número y un símbolo.";

export default function ResetPasswordForm() {
  const navigate = useNavigate();
  const [enlaceValido, setEnlaceValido] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    // Supabase intercepta el token del enlace en la URL y crea una sesión
    // temporal de tipo "recovery" antes de que este componente se monte.
    supabase.auth.getSession().then(({ data }) => {
      setEnlaceValido(Boolean(data.session));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setEnlaceValido(true);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!PASSWORD_REGEX.test(password)) {
      await mostrarError("Contraseña insegura", PASSWORD_HINT);
      return;
    }

    if (password !== confirmacion) {
      await mostrarError("Las contraseñas no coinciden", "Verifica ambos campos.");
      return;
    }

    setEnviando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        await mostrarError("No se pudo actualizar", error.message);
        return;
      }

      await mostrarExito("Contraseña actualizada", "Ya puedes iniciar sesión con tu nueva contraseña.");
      await supabase.auth.signOut();
      navigate("/signin");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
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
              Restablecer contraseña
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Define una nueva contraseña para tu cuenta.
            </p>
          </div>

          {enlaceValido === null && (
            <p className="text-sm text-gray-500 dark:text-gray-400">Verificando enlace…</p>
          )}

          {enlaceValido === false && (
            <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-800 dark:bg-error-500/10 dark:text-error-400">
              Este enlace no es válido o ya expiró. Solicita uno nuevo desde la pantalla de{" "}
              <Link to="/signin" className="font-medium underline">
                inicio de sesión
              </Link>
              .
            </div>
          )}

          {enlaceValido === true && (
            <form onSubmit={handleSubmit}>
              <div className="space-y-6">
                <div>
                  <Label>
                    Nueva contraseña <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 8, mayúscula, número y símbolo"
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

                  <PasswordStrengthMeter password={password} />
                </div>
                <div>
                  <Label>
                    Confirmar contraseña <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Repite la nueva contraseña"
                    value={confirmacion}
                    onChange={(e) => setConfirmacion(e.target.value)}
                  />
                </div>
                <div>
                  <Button type="submit" className="w-full" size="sm" disabled={enviando}>
                    {enviando ? "Actualizando…" : "Actualizar contraseña"}
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
