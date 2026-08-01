/**
 * Armazón visual compartido por todos los correos transaccionales de FinSightAI.
 * Genera HTML con estilos inline (tablas) para máxima compatibilidad con clientes de correo.
 */
export interface EmailShellOptions {
  logoUrl: string;
  preheader: string;
  title: string;
  greetingName: string;
  bodyParagraphs: string[];
  ctaText: string;
  ctaUrl: string;
  footerNote: string;
}

export function buildEmailHtml({
  logoUrl,
  preheader,
  title,
  greetingName,
  bodyParagraphs,
  ctaText,
  ctaUrl,
  footerNote,
}: EmailShellOptions): string {
  const parrafos = bodyParagraphs
    .map(
      (parrafo) =>
        `<p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#344054;">${parrafo}</p>`,
    )
    .join('');

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f2f4f7;font-family:Arial,Helvetica,sans-serif;">
    <span style="display:none;font-size:1px;color:#f2f4f7;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f4f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="background-color:#161950;padding:28px 32px;text-align:center;">
                <img src="${logoUrl}" alt="FinSightAI" width="140" style="display:block;margin:0 auto;max-width:140px;height:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 12px;">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:28px;color:#101828;">${title}</h1>
                <p style="margin:0 0 16px;font-size:14px;line-height:22px;color:#344054;">Hola, <strong>${greetingName}</strong>:</p>
                ${parrafos}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;text-align:center;">
                <a href="${ctaUrl}" target="_blank" style="display:inline-block;background-color:#465fff;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">${ctaText}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0;font-size:12px;line-height:18px;color:#98a2b3;">${footerNote}</p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #eaecf0;">
                <p style="margin:0;font-size:12px;color:#98a2b3;">&copy; ${new Date().getFullYear()} FinSightAI &middot; Tu asistente financiero inteligente</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
