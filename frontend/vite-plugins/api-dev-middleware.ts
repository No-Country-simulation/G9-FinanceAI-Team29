import type { IncomingMessage } from 'node:http';
import type { Plugin } from 'vite';
import { loadEnv } from 'vite';

function leerCuerpo(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Simula en `vite dev` lo que Vercel hace en producción con /api/*.ts
 * (Edge Functions): carga el módulo correspondiente y llama a su handler
 * Web-standard (Request -> Response). Así no hace falta `vercel dev` ni
 * tener acceso a Vercel para probar los endpoints en local.
 *
 * Solo corre en desarrollo (`apply: 'serve'`); en el build/deploy de
 * Vercel este plugin no interviene, Vercel usa los archivos de /api tal cual.
 */
export function apiDevMiddleware(): Plugin {
  return {
    name: 'api-dev-middleware',
    apply: 'serve',
    configureServer(server) {
      // Vite solo expone al cliente las variables VITE_*; acá cargamos TODO
      // el .env (incluidas las server-only) a process.env, igual que Vercel
      // haría con las Environment Variables del proyecto.
      const env = loadEnv(server.config.mode ?? 'development', process.cwd(), '');
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }

      // @supabase/supabase-js instancia un RealtimeClient apenas se llama
      // createClient(), aunque la función nunca use Realtime. Ese cliente
      // exige un WebSocket global nativo, que Node trae recién desde la
      // v22. En Node 20 esto hace que createClient() explote y el catch
      // de más abajo lo confunda con "la función no existe". En producción
      // (Vercel Edge Runtime) sí hay WebSocket nativo, así que este stub es
      // solo para poder correr `vite dev` en Node < 22.
      if (typeof globalThis.WebSocket === 'undefined') {
        globalThis.WebSocket = class {} as unknown as typeof WebSocket;
      }

      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) {
          return next();
        }

        const rutaLimpia = req.url.split('?')[0];
        const nombreRuta = rutaLimpia.replace(/^\/api\//, '');

        if (!nombreRuta || nombreRuta.includes('..') || nombreRuta.startsWith('_lib/')) {
          res.statusCode = 404;
          res.end(JSON.stringify({ mensaje: 'No encontrado.' }));
          return;
        }

        const modulePath = `/api/${nombreRuta}.ts`;

        try {
          const mod = await server.ssrLoadModule(modulePath);
          const handler = mod.default as ((request: Request) => Promise<Response>) | undefined;

          if (typeof handler !== 'function') {
            res.statusCode = 500;
            res.end(JSON.stringify({ mensaje: 'La función no exporta un handler válido.' }));
            return;
          }

          const cuerpo = req.method && !['GET', 'HEAD'].includes(req.method)
            ? await leerCuerpo(req)
            : undefined;

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value === undefined) continue;
            headers.set(key, Array.isArray(value) ? value.join(', ') : value);
          }

          const request = new Request(`http://${req.headers.host}${req.url}`, {
            method: req.method ?? 'GET',
            headers,
            body: cuerpo && cuerpo.length > 0 ? cuerpo : undefined,
          });

          const respuesta = await handler(request);

          res.statusCode = respuesta.status;
          respuesta.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await respuesta.arrayBuffer()));
        } catch (error) {
          console.error(`[api-dev-middleware] Error en ${modulePath}:`, error);
          res.statusCode = 404;
          res.end(JSON.stringify({ mensaje: `No se encontró la función /api/${nombreRuta}.` }));
        }
      });
    },
  };
}
