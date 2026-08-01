// Helper compartido para las funciones serverless de /api. No es una ruta:
// Vercel ignora carpetas/archivos que empiezan con "_" dentro de /api.
export async function enviarCorreo({
  apiKey,
  from,
  to,
  subject,
  html,
}: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; detalle?: string }> {
  const respuesta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    return { ok: false, detalle };
  }

  return { ok: true };
}
