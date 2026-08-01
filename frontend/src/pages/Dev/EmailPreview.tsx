import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import Input from '../../components/form/input/InputField';
import Label from '../../components/form/Label';
import Button from '../../components/ui/button/Button';
import {
  EMAIL_TEMPLATES,
  EmailTemplateKey,
  GO_CONFIRMATION_URL_TOKEN,
} from '../../emails/templates';

/**
 * Página sin enlace en el menú: solo accesible escribiendo /dev/email-preview.
 * Sirve para revisar el diseño de los correos de Supabase antes de pegarlos
 * en el panel (Authentication → Email Templates) y para copiar el HTML final.
 */
export default function EmailPreview() {
  const [plantilla, setPlantilla] = useState<EmailTemplateKey>('confirmar-registro');
  const [nombreCompleto, setNombreCompleto] = useState('Nombre Apellido');
  const [correoPrueba, setCorreoPrueba] = useState('usuario@correo.com');
  const [sinNombre, setSinNombre] = useState(false);
  const [logoUrl, setLogoUrl] = useState('https://i.postimg.cc/zvCfsXbw/logo-white.png');

  const config = EMAIL_TEMPLATES[plantilla];

  const nombreMostrado = sinNombre ? correoPrueba : (nombreCompleto.trim() || correoPrueba);

  const htmlPreview = useMemo(
    () =>
      config.build({
        logoUrl,
        greetingName: nombreMostrado || 'usuario@correo.com',
        ctaUrl: '#',
      }),
    [config, logoUrl, nombreMostrado],
  );

  // Un iframe con srcDoc queda con origen "about:srcdoc", que varios bloqueadores
  // de anuncios/rastreo tratan como contenido de terceros y filtran. Usar una
  // blob: URL le da un origen "normal" y evita ese falso bloqueo en la vista previa.
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    const blob = new Blob([htmlPreview], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [htmlPreview]);

  const htmlParaSupabase = useMemo(
    () =>
      config.build({
        logoUrl: logoUrl || 'https://i.postimg.cc/zvCfsXbw/logo-white.png',
        greetingName: config.goGreetingToken,
        ctaUrl: GO_CONFIRMATION_URL_TOKEN,
      }),
    [config, logoUrl],
  );

  const copiarHtml = async () => {
    await navigator.clipboard.writeText(htmlParaSupabase);
    await Swal.fire({
      icon: 'success',
      title: 'HTML copiado',
      text: `Pégalo en Supabase → ${config.ubicacionSupabase}.`,
      timer: 2500,
      showConfirmButton: false,
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Vista previa de correos (Supabase Email Templates)
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Página interna sin enlace en el menú. Ajusta los datos de prueba, revisa el diseño y copia el HTML listo para pegar en el panel de Supabase.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div>
            <Label>Plantilla</Label>
            <select
              value={plantilla}
              onChange={(e) => setPlantilla(e.target.value as EmailTemplateKey)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none dark:border-gray-700 dark:text-white/90"
            >
              {Object.entries(EMAIL_TEMPLATES).map(([key, value]) => (
                <option key={key} value={key}>{value.etiqueta}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>Nombre y apellido de prueba</Label>
            <Input value={nombreCompleto} onChange={(e) => setNombreCompleto(e.target.value)} disabled={sinNombre} />
          </div>

          <div>
            <Label>Correo de prueba</Label>
            <Input value={correoPrueba} onChange={(e) => setCorreoPrueba(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={sinNombre} onChange={(e) => setSinNombre(e.target.checked)} />
            Simular usuario sin nombre guardado (usa el correo como saludo)
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Nota: el editor de Supabase no soporta condicionales. El HTML que se copia para Supabase usa <code>{'{{ .Data.nombre }} {{ .Data.apellido }}'}</code> en "Confirmar registro" (metadata siempre fresca ahí) y <code>{'{{ .Email }}'}</code> en "Restablecer contraseña" (puede pedirse para cuentas viejas sin esa metadata, y usar <code>.Data</code> ahí rompe el envío con error 500). Estos campos de nombre solo sirven para ilustrar en esta vista previa.
          </p>

          <div>
            <Label>URL pública del logo</Label>
            <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Los correos no pueden cargar archivos locales: debe ser una URL accesible públicamente. Por defecto apunta al logo blanco en GitHub (funciona para pruebas), pero para producción es mejor usar tu propio dominio ya desplegado + /images/logo/logo_white.png, ya que GitHub no garantiza ese hosting para tráfico externo constante.
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-xs text-gray-600 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-400">
            <p className="font-medium text-gray-800 dark:text-white/90">Dónde pegarlo en Supabase</p>
            <p className="mt-1">{config.ubicacionSupabase}</p>
            <p className="mt-2 font-medium text-gray-800 dark:text-white/90">Asunto sugerido</p>
            <p className="mt-1">{config.asuntoSugerido}</p>
          </div>

          <Button className="w-full" onClick={copiarHtml}>Copiar HTML para Supabase</Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
          <iframe
            title="Vista previa del correo"
            src={previewUrl}
            className="h-[720px] w-full rounded-xl border border-gray-200 bg-white dark:border-gray-800"
          />
        </div>
      </div>
    </div>
  );
}
