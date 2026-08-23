import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import Swal from "sweetalert2";
import { mostrarError, mostrarExito } from "../../utils/alerts";

const API_BASE =
  import.meta.env.VITE_API_URL ?? "http://localhost:8081/api";

type Estado = "cargando" | "ok" | "error";

// Toma el token de /confirmar?token=XXXX y confirma la cuenta al montar la página.
export default function ConfirmarCuentaForm() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get("token")?.trim() ?? "", [searchParams]);

  const [estado, setEstado] = useState<Estado>("cargando");
  const [mensaje, setMensaje] = useState("Confirmando tu cuenta…");

  useEffect(() => {
    let cancelado = false;

    async function confirmar() {
      if (!token) {
        if (!cancelado) {
          setEstado("error");
          setMensaje("El enlace de confirmación no es válido.");
        }
        return;
      }
      try {
        const response = await fetch(`${API_BASE}/auth/v2/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await response.json().catch(() => ({}));
        if (cancelado) return;

        if (response.ok) {
          setEstado("ok");
          setMensaje(data?.mensaje ?? "¡Cuenta confirmada! Ya podés iniciar sesión.");
        } else {
          setEstado("error");
          setMensaje(data?.mensaje ?? "No se pudo confirmar la cuenta.");
        }
      } catch {
        if (!cancelado) {
          setEstado("error");
          setMensaje("Ocurrió un problema al conectar. Intentá nuevamente.");
        }
      }
    }

    confirmar();
    return () => {
      cancelado = true;
    };
  }, [token]);

  const reenviar = async () => {
    const r = await Swal.fire({
      title: "Reenviar confirmación",
      input: "email",
      inputLabel: "Tu correo electrónico",
      inputPlaceholder: "nombre@correo.com",
      showCancelButton: true,
      confirmButtonText: "Reenviar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#465fff",
      inputValidator: (value) => (!value ? "Ingresá tu correo." : undefined),
    });
    if (!r.isConfirmed || !r.value) return;

    try {
      await fetch(`${API_BASE}/auth/v2/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(r.value).trim().toLowerCase() }),
      });
      await mostrarExito(
        "Correo reenviado",
        "Si tu cuenta está pendiente de confirmación, te reenviamos el enlace. Revisá tu casilla (y el spam)."
      );
    } catch {
      await mostrarError("No se pudo reenviar", "Ocurrió un error de red. Intentá nuevamente.");
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
              Confirmación de cuenta
            </h1>
          </div>

          {estado === "cargando" && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{mensaje}</p>
          )}

          {estado === "ok" && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-500/10 dark:text-green-400">
              {mensaje}{" "}
              <Link to="/signin" className="font-medium underline">
                Iniciar sesión
              </Link>
              .
            </div>
          )}

          {estado === "error" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-800 dark:bg-error-500/10 dark:text-error-400">
                {mensaje}
              </div>
              <button
                type="button"
                onClick={reenviar}
                className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-brand-600"
              >
                Reenviar correo de confirmación
              </button>
              <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                <Link to="/signin" className="font-medium text-brand-500 underline">
                  Volver a iniciar sesión
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
