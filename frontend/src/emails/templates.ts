import { buildEmailHtml } from './shell';

/**
 * El editor de Supabase no evalúa condicionales de Go-template ({{if}}/{{else}}),
 * pero sí soporta sustitución simple de subcampos del user_metadata vía {{ .Data }}.
 *
 * OJO: si .Data no tiene esa clave (cuenta creada antes de este cambio, o manual
 * desde el panel), Supabase devuelve un error 500 al intentar renderizar el correo
 * en vez de mostrar vacío. Por eso solo es seguro usarlo en "Confirm signup"
 * (la metadata siempre está recién creada en ese momento). En "Reset password"
 * puede dispararse para cualquier cuenta existente, así que ahí usamos {{ .Email }},
 * que siempre está garantizado.
 */
export const GO_GREETING_TOKEN_NOMBRE = '{{ .Data.nombre }} {{ .Data.apellido }}';
export const GO_GREETING_TOKEN_EMAIL = '{{ .Email }}';

export const GO_CONFIRMATION_URL_TOKEN = '{{ .ConfirmationURL }}';

export interface EmailTemplateParams {
  logoUrl: string;
  greetingName: string;
  ctaUrl: string;
}

export function confirmSignupEmail({ logoUrl, greetingName, ctaUrl }: EmailTemplateParams): string {
  return buildEmailHtml({
    logoUrl,
    preheader: 'Confirma tu correo para activar tu cuenta de FinSightAI.',
    title: 'Confirma tu cuenta',
    greetingName,
    bodyParagraphs: [
      '¡Gracias por registrarte en FinSightAI! Para activar tu cuenta y comenzar a organizar tus finanzas, confirma tu correo electrónico.',
      'Este paso nos ayuda a mantener tu cuenta segura.',
    ],
    ctaText: 'Confirmar mi cuenta',
    ctaUrl,
    footerNote: 'Si no creaste esta cuenta, puedes ignorar este mensaje.',
  });
}

export function resetPasswordEmail({ logoUrl, greetingName, ctaUrl }: EmailTemplateParams): string {
  return buildEmailHtml({
    logoUrl,
    preheader: 'Restablece la contraseña de tu cuenta de FinSightAI.',
    title: 'Restablece tu contraseña',
    greetingName,
    bodyParagraphs: [
      'Recibimos una solicitud para restablecer la contraseña de tu cuenta de FinSightAI.',
      'Si realizaste esta solicitud, haz clic en el botón de abajo para elegir una nueva contraseña. Por seguridad, el enlace tiene un tiempo de vencimiento limitado.',
    ],
    ctaText: 'Restablecer contraseña',
    ctaUrl,
    footerNote: 'Si no solicitaste este cambio, puedes ignorar este correo: tu contraseña actual seguirá funcionando sin cambios.',
  });
}

export const EMAIL_TEMPLATES = {
  'confirmar-registro': {
    etiqueta: 'Confirmar registro',
    asuntoSugerido: 'Confirma tu cuenta en FinSightAI',
    ubicacionSupabase: 'Authentication → Email Templates → Confirm signup',
    build: confirmSignupEmail,
    goGreetingToken: GO_GREETING_TOKEN_NOMBRE,
  },
  'restablecer-contrasena': {
    etiqueta: 'Restablecer contraseña',
    asuntoSugerido: 'Restablece tu contraseña de FinSightAI',
    ubicacionSupabase: 'Authentication → Email Templates → Reset Password',
    build: resetPasswordEmail,
    goGreetingToken: GO_GREETING_TOKEN_EMAIL,
  },
} as const;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;
