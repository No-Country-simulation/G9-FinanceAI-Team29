import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import dotenv from 'dotenv';

// Servidor de producción para la VM de OCI: sirve el build estático de Vite
// (dist/) y además ejecuta las funciones de /api/*.ts con el mismo contrato
// Web-standard (Request -> Response) que usa Vercel Edge Functions. Reemplaza
// a Vercel para este deploy; en Vercel estos mismos archivos de /api corren
// tal cual, sin este servidor.
dotenv.config();

// @supabase/supabase-js instancia un RealtimeClient apenas se llama
// createClient(), aunque la función nunca use Realtime. Ese cliente exige un
// WebSocket global nativo, que Node trae recién desde la v22. Mismo stub que
// usa vite-plugins/api-dev-middleware.ts para poder correr en Node 20 en la VM.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class {} as unknown as typeof WebSocket;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const apiDir = path.resolve(__dirname, '..', 'api');

const app = express();
app.disable('x-powered-by');

app.all('/api/:name', express.raw({ type: '*/*', limit: '5mb' }), async (req, res) => {
  const { name } = req.params;

  if (!name || name.includes('..')) {
    res.status(404).json({ mensaje: 'No encontrado.' });
    return;
  }

  let mod: { default?: unknown };
  try {
    mod = await import(pathToFileURL(path.join(apiDir, `${name}.ts`)).href);
  } catch (error) {
    console.error(`[api] No se encontró /api/${name}:`, error);
    res.status(404).json({ mensaje: `No se encontró la función /api/${name}.` });
    return;
  }

  const handler = mod.default as ((request: Request) => Promise<Response>) | undefined;
  if (typeof handler !== 'function') {
    res.status(500).json({ mensaje: 'La función no exporta un handler válido.' });
    return;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const cuerpo = req.body instanceof Buffer ? req.body : undefined;

  const request = new Request(url, {
    method: req.method,
    headers,
    body: cuerpo && cuerpo.length > 0 ? cuerpo : undefined,
  });

  try {
    const respuesta = await handler(request);
    res.status(respuesta.status);
    respuesta.headers.forEach((value, key) => res.setHeader(key, value));
    res.end(Buffer.from(await respuesta.arrayBuffer()));
  } catch (error) {
    console.error(`[api] Error ejecutando /api/${name}:`, error);
    res.status(500).json({ mensaje: 'Error interno del servidor.' });
  }
});

app.use(express.static(distDir));

// SPA fallback: cualquier ruta que no sea un archivo estático ni /api/* cae
// en index.html, para que React Router maneje la navegación del lado cliente.
app.get('*', (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = Number(process.env.PORT ?? 4173);
app.listen(port, () => {
  console.log(`[server] Frontend + API escuchando en :${port}`);
});
