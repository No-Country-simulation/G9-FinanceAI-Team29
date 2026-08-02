import { CheckLineIcon, CloseLineIcon } from "../../icons";

interface Regla {
  etiqueta: string;
  cumple: boolean;
}

interface PasswordStrengthMeterProps {
  password: string;
}

export function evaluarReglas(password: string): Regla[] {
  return [
    { etiqueta: "Al menos 8 caracteres", cumple: password.length >= 8 },
    { etiqueta: "Una mayúscula (A-Z)", cumple: /[A-Z]/.test(password) },
    { etiqueta: "Una minúscula (a-z)", cumple: /[a-z]/.test(password) },
    { etiqueta: "Un número (0-9)", cumple: /\d/.test(password) },
    { etiqueta: "Un símbolo (!@#$...)", cumple: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const reglas = evaluarReglas(password);
  const cumplidas = reglas.filter((r) => r.cumple).length;

  const niveles = [
    { texto: "Muy débil", color: "bg-error-500", textColor: "text-error-500" },
    { texto: "Débil", color: "bg-error-500", textColor: "text-error-500" },
    { texto: "Media", color: "bg-warning-500", textColor: "text-warning-500" },
    { texto: "Fuerte", color: "bg-success-500", textColor: "text-success-500" },
    { texto: "Muy fuerte", color: "bg-success-500", textColor: "text-success-500" },
    { texto: "Muy fuerte", color: "bg-success-500", textColor: "text-success-500" },
  ];

  const nivel = niveles[cumplidas];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {reglas.map((_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index < cumplidas ? nivel.color : "bg-gray-200 dark:bg-gray-700"
            }`}
          />
        ))}
      </div>

      <p className={`text-xs font-medium ${nivel.textColor}`}>
        Seguridad: {nivel.texto}
      </p>

      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {reglas.map((regla) => (
          <li
            key={regla.etiqueta}
            className={`flex items-center gap-1.5 text-xs ${
              regla.cumple
                ? "text-success-600 dark:text-success-400"
                : "text-gray-400 dark:text-gray-500"
            }`}
          >
            {regla.cumple ? (
              <CheckLineIcon className="size-3.5 shrink-0" />
            ) : (
              <CloseLineIcon className="size-3.5 shrink-0" />
            )}
            {regla.etiqueta}
          </li>
        ))}
      </ul>
    </div>
  );
}
