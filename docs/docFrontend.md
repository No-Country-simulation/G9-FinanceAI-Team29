# FinSightAI — Documentación técnica del Frontend

> SPA de salud financiera personal con IA — arquitectura, rutas, estado, integración con el backend/IA, gamificación, exportación de reportes y despliegue.

**Stack:** React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · React Router 7 · ApexCharts · FullCalendar · ExcelJS/jsPDF/JSZip · nginx (runtime) · Docker

|               |                                                                            |
|---------------|----------------------------------------------------------------------------|
| **Proyecto**  | G9 · FinanceAI · Team 29                                                   |
| **Versión**   | 2.3.0 · 2026-08-23                                                          |
| **Alcance**   | Solo Frontend                                                               |
| **Puerto**    | `5173` (dev, Vite) · `80` (runtime, nginx dentro del contenedor)            |
| **Deploy**    | Docker + Caddy (OCI, same-origin) — alternativa: Vercel (SPA + funciones serverless en `/api`) |

---

## 1. Resumen del sistema

El frontend es una **SPA en React + Vite + TypeScript** que sirve de interfaz única para todo el ecosistema FinSightAI: dashboard financiero, transacciones, análisis de perfil (ML), metas de ahorro, calendario financiero, un asistente conversacional con IA ("Finsi"), un sistema de gamificación completo y la gestión de cuenta del usuario. No tiene lógica de negocio propia relevante: **delega toda la persistencia y el cálculo pesado al backend (Spring Boot) y al AI-Service (FastAPI/ML)**, y se limita a orquestar el estado en cliente, cachear datos por sesión y ofrecer una capa de UX elaborada (animaciones, easter eggs, exportación de reportes, voz).

- **🔐 Sesión propia** — Ya no usa Supabase Auth: guarda el JWT que firma el backend propio en `localStorage` y lo decodifica en cliente (el claim `sub` es el `usuarioId`).
- **💰 Núcleo financiero** — Dashboard, transacciones (filtro tipo Excel + paginación), importación de CSV, análisis de perfil vía ML, recomendaciones, metas de ahorro con aportes/reservas.
- **🤖 Asistente IA "Finsi"** — Chat con streaming (SSE), voz (dictado + TTS), historial persistido, y un extenso catálogo de *easter eggs* multimedia.
- **🎮 Gamificación** — Retos semanales, trivia, ~55 logros, racha diaria/semanal, "score" de salud financiera con niveles — todo sincronizado contra el backend (nada vive solo en `localStorage`).
- **📅 Calendario financiero** — FullCalendar con eventos reales (derivados de metas/transacciones recurrentes) + eventos manuales, feed `.ics` suscribible y notificaciones Web Push.
- **📤 Exportación de reportes** — CSV, PDF (jsPDF) y Excel (ExcelJS) con gráficos capturados o, en el caso del dashboard, **gráficos nativos de Excel** inyectados sobre una plantilla `.xlsx`.
- **🎨 UI** — Basada en la plantilla **TailAdmin** (React + Tailwind, MIT) como punto de partida visual; todo el producto, las páginas de negocio y la integración están hechas por el equipo.

---

## 2. Arquitectura y stack

En producción (despliegue OCI/Docker), el frontend se compila a estático y se sirve con **nginx** detrás de un reverse proxy **Caddy** que unifica el origen (same-origin) — así el navegador nunca hace CORS cross-site contra el backend ni el AI-Service.

```
🌐 Navegador (SPA React, JS puro, sin SSR)
     │  JWT propio en localStorage → Authorization: Bearer
     ▼
🧭 Caddy — reverse proxy (:80 / :443)
     │  /api/* → backend Spring (mantiene el prefijo)
     │  /ai/*  → AI-Service FastAPI (le saca el prefijo /ai)
     │  resto  → frontend (nginx, estático)
     ▼
 ┌────────────────────────────┬───────────────────────────────┐
 │ 🐳 nginx :80 (este repo)    │  ☕ Backend Spring · 🐍 AI-Service │
 │ sirve dist/ (build de Vite) │  (ver docBackend.md)             │
 └────────────────────────────┴───────────────────────────────┘
```

### Stack técnico

| Capa                | Tecnología                                   | Detalle                                                                 |
|---------------------|-----------------------------------------------|--------------------------------------------------------------------------|
| Runtime UI          | React 19 + TypeScript 5.7                     | Componentes funcionales, hooks, sin clases                              |
| Build / dev server  | Vite 6                                        | HMR, `vite-plugin-svgr` (SVG → componente React), plugin propio de API dev |
| Estilos             | Tailwind CSS 4 (`@tailwindcss/postcss`)       | Tokens de tema en `index.css` (`@theme`), variante `dark:` custom        |
| Ruteo               | React Router 7 (`react-router`)               | `BrowserRouter`, rutas anidadas, guard de autenticación                  |
| Gráficos            | ApexCharts (`react-apexcharts`)               | Donut, barras — dashboard y export                                      |
| Calendario          | FullCalendar (`@fullcalendar/react` + plugins)| dayGrid/timeGrid/list/interaction                                       |
| Mapas               | `@react-jvectormap` (world)                   | Componente de mapa (heredado del template, uso decorativo/ecommerce)    |
| Exportación          | `jspdf` + `jspdf-autotable`, `exceljs`, `jszip`, `html2canvas-pro` | PDF, Excel con gráficos nativos, captura de charts a imagen |
| Notificaciones UI    | `sweetalert2`                                 | Modales de confirmación, cambio de password, mensajes                    |
| Drag & drop         | `react-dnd` + `react-dnd-html5-backend`, `react-dropzone` | Import de CSV, componentes de formulario                     |
| Recorte de imagen   | `react-easy-crop`                             | Avatar circular                                                         |
| Fechas              | `flatpickr`                                   | Date pickers de formularios                                             |
| Carrusel            | `swiper`                                      | Imágenes de la pantalla de auth                                         |
| Diagramas           | `mermaid`                                     | Solo en página de desarrollo `/dev/mermaid-preview`                     |
| Meta / SEO          | `react-helmet-async`                          | `<PageMeta>` por página                                                 |
| Runtime servido     | nginx (imagen `nginx:alpine`)                 | SPA fallback a `index.html`, cache largo para `/assets/*`               |

---

## 3. Estructura de carpetas

```
frontend/
├── src/
│   ├── App.tsx              # Router raíz + providers globales
│   ├── main.tsx              # Entry point (ThemeProvider + AppWrapper)
│   ├── index.css             # Tailwind + tokens de tema (@theme)
│   ├── pages/                 # Una carpeta por dominio (Dashboard, Finance, Ai, Gamificacion, AuthPages, Legal, Dev, OtherPage)
│   ├── layout/                # AppLayout, AppHeader, AppSidebar, Backdrop
│   ├── components/            # Organizados por dominio: finance/, ai/, gamificacion/, auth/, header/, common/, onboarding/, team/, charts/, ecommerce/, form/, ui/, tables/
│   ├── context/                # AuthContext, PerfilDataContext, GamificationContext, ThemeContext, SidebarContext, OnboardingContext
│   ├── services/               # api.ts (cliente HTTP), authSession.ts (JWT), errors.ts
│   ├── types/finance.ts        # Contratos TS centrales (Transaccion, Goal, AnalisisResponse, etc.)
│   ├── utils/                  # Lógica de negocio en cliente (gamification, achievements, export/*, sonido, voz, etc.)
│   ├── data/                   # Catálogos estáticos (logros, retos, trivia, equipo)
│   ├── hooks/                  # Hooks reutilizables (useModal, useGoBack, useEsModoMatrix, etc.)
│   ├── emails/                 # Plantillas HTML de email (preview en /dev/email-preview)
│   ├── icons/                  # SVGs importados como componentes React (svgr)
│   └── svg.d.ts, vite-env.d.ts # Ambient types
├── public/                     # Assets estáticos servidos tal cual (avatares del equipo, plantilla Excel, sw.js, favicons)
├── scripts/                     # Scripts Node de build-time (procesar fotos del equipo, frames de video, plantilla del dashboard)
├── vite-plugins/                 # Plugin propio: api-dev-middleware.ts
├── Dockerfile, nginx.conf         # Build multi-stage + runtime nginx
├── vite.config.ts, tsconfig*.json, eslint.config.js, postcss.config.js
└── .env.example, .env.production
```

---

## 4. Ruteo (`src/App.tsx`)

`BrowserRouter` con dos grupos de rutas: **privadas** (envueltas en `ProtectedRoute` + `AppLayout`) y **públicas**. Los providers globales (`AuthProvider` → `PerfilDataProvider` → `GamificationProvider`) envuelven todo el árbol de rutas, en ese orden porque cada uno depende del anterior (Gamification usa datos de PerfilData, que usa el `usuarioId` de Auth).

### Rutas privadas (requieren sesión — `ProtectedRoute` + `AppLayout`)

| Ruta                        | Página                          | Descripción                                                |
|------------------------------|----------------------------------|-------------------------------------------------------------|
| `/`                           | `Dashboard/Home`                | Dashboard principal                                          |
| `/calendario-financiero`      | `Calendar`                      | Calendario financiero (FullCalendar + .ics + push)           |
| `/educacion-financiera`       | `Finance/EducacionFinanciera`   | Tarjetas educativas personalizadas                            |
| `/transacciones`              | `Finance/Transacciones`         | Listado/filtro/paginación de movimientos                     |
| `/importar-csv`               | `Finance/ImportarCsv`           | Importación de CSV (3 modos)                                 |
| `/analisis`                   | `Finance/Analisis`              | Formulario + análisis de perfil (ML)                          |
| `/recomendaciones`            | `Finance/Recomendaciones`       | Recomendaciones personalizadas + lectura por voz               |
| `/metas`                      | `Finance/Metas`                 | CRUD de metas de ahorro                                       |
| `/asistente-ia`               | `Ai/AsistenteIA`                | Chat completo con Finsi (streaming, voz, easter eggs)          |
| `/modo-matrix`                | `Ai/ModoMatrix`                 | Easter egg: acceso solo vía "pastilla roja" del asistente      |
| `/juegos`                     | `Gamificacion/Juegos`           | Trivia + Retos semanales                                       |
| `/profile`                    | `UserProfiles`                  | Cuenta: datos, password, avatar, exportar, baja de cuenta       |
| `/soporte`                    | `Soporte`                       | Chat de soporte técnico (independiente del asistente financiero) |

### Rutas públicas

| Ruta                       | Página                        | Descripción                                    |
|------------------------------|--------------------------------|--------------------------------------------------|
| `/signin`                     | `AuthPages/SignIn`            | Login                                             |
| `/signup`                     | `AuthPages/SignUp`            | Registro                                          |
| `/reset-password`             | `AuthPages/ResetPassword`     | Reset con token (`?token=`) recibido por email     |
| `/terminos`                   | `Legal/Terminos`              | Términos y condiciones (estático)                  |
| `/privacidad`                 | `Legal/PoliticaPrivacidad`    | Política de privacidad (estático)                  |
| `/dev/email-preview`          | `Dev/EmailPreview`            | Ruta oculta (sin link en el menú) para previsualizar plantillas de email |
| `/dev/mermaid-preview`        | `Dev/MermaidPreview`          | Ruta oculta para previsualizar diagramas Mermaid    |
| `*`                            | `OtherPage/NotFound`          | 404 con mascota Finsi                              |

`ScrollToTop` resetea el scroll en cada navegación; `TabTitleManager` (vía `usePageVisibilityTitle`) cambia el `<title>` de la pestaña cuando pierde foco; `ConsoleBanner` imprime un banner en la consola del navegador (branding/easter egg para quien abra devtools).

---

## 5. Estado global (Context API)

No hay Redux/Zustand: todo el estado compartido vive en **6 React Contexts**, cada uno con responsabilidad acotada.

### 5.1 `AuthContext` (`context/AuthContext.tsx`)

Fuente de verdad de la sesión. **No usa `useState` async con loading inicial**: `getSession()` lee y decodifica el JWT de `localStorage` de forma síncrona, así que no hay parpadeo de "cargando sesión" al refrescar la página.

- **Estado expuesto**: `session`, `email`, `isAdmin`, `usuarioId` (el `sub` del JWT — o el perfil que esté inspeccionando un admin), `avatarIcon` (emoji, local), `avatarUrl` (foto subida a Object Storage), `cuentas` (lista demo para admins), `loading` (siempre `false`), `signIn`, `signOut`, `refreshSession`, `setUsuarioId`.
- **Rol admin** — Un set fijo de emails (`demo.admin@finsight.com`) puede *impersonar* 3 cuentas demo predefinidas (`USR0401` En Riesgo, `USR0114` En Observación, `USR0615` Saludable) vía `AccountSwitcher` en el header. Un usuario normal no puede cambiar su propio `usuarioId` (sale del token).
- **`signIn`** — `POST {API_BASE}/auth/v2/login` directo con `fetch` (no pasa por `apiFetch`). Si el `fetch` rechaza o responde 502/503/504, lanza `'SERVIDOR_INICIANDO'` (el backend recién está levantando, típico justo después de `docker compose up`); 401 → `'CREDENCIALES_INVALIDAS'`. Al obtener el token, `saveToken()` dispara un pub/sub interno que hace que `AuthProvider` vuelva a leer la sesión.
- **`signOut`** — Limpia token, emoji y URL de avatar de `localStorage` (sin esto, la próxima cuenta que loguee en ese navegador heredaría la foto de la sesión anterior, porque el avatar no está namespaced por usuario).
- **Sincronización de avatar entre pestañas/dispositivos** — Un `useEffect` escucha el evento `storage` del navegador además del pub/sub local.
- **Auto-logout por inactividad** — Timer de `VITE_INACTIVITY_MINUTES` (default 25 min) reiniciado en `mousemove/mousedown/keydown/scroll/touchstart`; al vencer, cierra sesión y muestra un SweetAlert de "sesión expirada".
- **Sync de avatar al primer render** — Como la foto de perfil (`avatarUrl`) solo se cargaba antes al visitar `/profile` (por el lazy-load de `PerfilDataContext`), un efecto separado llama `obtenerPerfilCompleto` una vez por `usuarioId` para que el header/sidebar la muestren correcta desde el arranque.

### 5.2 `PerfilDataContext` (`context/PerfilDataContext.tsx`)

Cachea **perfil completo + transacciones** del usuario mientras dura la sesión, con **carga perezosa**: no dispara ningún `fetch` hasta que algún componente llama a `usePerfilData()` por primera vez (por ejemplo, al entrar a `/profile`). Así no compite con los `fetch` propios de otras páginas (Análisis, Recomendaciones, etc., que no consumen este contexto y hacen su propia carga). El `resumen` (totales de ingreso/gasto por categoría) se **deriva en cliente** con `useMemo` a partir de las transacciones, sin pedirlo aparte al backend. Expone `actualizarPerfilLocal()` para updates optimistas sin refetch.

### 5.3 `GamificationContext` (`context/GamificationContext.tsx`)

El contexto más complejo del proyecto — orquesta todo el sistema de gamificación (ver [sección 9](#9-gamificación)). Depende de `AuthContext` (usuarioId) y `PerfilDataContext` (perfil/transacciones/resumen), y consume además `obtenerMetas` directamente. Todo el estado persiste contra el backend (tablas `gamificacion_estado`, `reto_progreso`, `logros`, `trivia`) — **no hay `localStorage`** en esta capa, así que el progreso viaja entre dispositivos.

### 5.4 `ThemeContext` / `SidebarContext` / `OnboardingContext`

- **`ThemeContext`** — Claro/oscuro, persistido en `localStorage['theme']`, aplica la clase `dark` en `<html>` (Tailwind `@custom-variant dark`). Está fuera de `<Router>` en `main.tsx` porque también gobierna la pantalla de auth.
- **`SidebarContext`** — Estado del sidebar (expandido/colapsado, hover, submenu abierto, mobile). Colapsa automáticamente en `< 768px`.
- **`OnboardingContext`** — Solo un flag `isTourActive` consumido por `OnboardingTour`. Vive dentro de `AppLayout` (solo aplica a rutas privadas).

---

## 6. Capa de servicios (`src/services/`)

### 6.1 `api.ts` — cliente HTTP

Todas las llamadas al backend/IA viven acá, sin librería HTTP externa (`fetch` nativo). Dos bases de URL, resueltas de `import.meta.env`:

```ts
API_BASE = VITE_API_URL ?? 'http://localhost:8081/api'   // Backend Spring
AI_BASE  = VITE_AI_URL  ?? 'http://localhost:8000'        // AI-Service FastAPI
```

- **`apiFetch(url, init)`** — Wrapper central para el backend: adjunta `Authorization: Bearer <jwt>` leyendo `getToken()` en cada llamada (no hay interceptor global tipo axios, es una función explícita). Tiene una **red de seguridad de reintento único**: si la respuesta es `401/502/503/504` y el método es idempotente (`GET/PUT/DELETE`, nunca `POST`), espera 350 ms, relee el token y reintenta una vez — cubre el 401 típico justo después del login (mientras el token se propaga) y el 502-504 típico de un backend recién levantado en Docker.
- **`preguntarAgente` / `preguntarAgenteStream`** — Hablan directo con el `AI_BASE` (no con `apiFetch`, no llevan JWT del backend). El streaming parsea manualmente eventos **SSE** (`data: {...}\n\n`) leyendo el `ReadableStream` del `body`, con tres tipos de evento: `step` (narración de progreso, ej. "Finsi está analizando tus gastos..."), `done` (respuesta final) y `error`.
- **Funciones de dominio** (todas con el patrón: validan `usuarioId` no vacío, hacen `apiFetch`, mapean errores a `Error`/`NotFoundError` legibles):
  - Análisis: `analizarFinanzas`
  - Usuario/perfil: `obtenerUsuario`, `obtenerPerfilCompleto`, `actualizarPerfil`, `subirAvatar`, `cambiarPassword`, `darDeBajaCuenta`
  - Transacciones: `obtenerTransacciones` (normaliza `tipo` de `"GASTO"/"INGRESO"` en BD a `"Gasto"/"Ingreso"` en UI), `obtenerResumen`, `importarCsv`, `reclasificarTransacciones`
  - Metas: `obtenerMetas`, `crearMeta`, `actualizarMeta`, `agregarAhorroMeta`, `cancelarMeta`
  - Calendario: `obtenerEventosCalendario`, `crearEventoCalendario`, `actualizarEventoCalendario`, `eliminarEventoCalendario`, `obtenerTokenCalendario`
  - Push: `suscribirNotificacionesPush`, `cancelarNotificacionesPush`
  - Gamificación: `guardarRetoProgreso`, `obtenerLogrosDesbloqueados`, `desbloquearLogroRemoto`, `registrarResultadosTrivia`, `obtenerEstadisticasTrivia`, `obtenerEstadoGamificacion`, `guardarEstadoGamificacion`
- **`importarCsv`** normaliza la respuesta del backend tolerando tanto `camelCase` como `snake_case` en cada campo (`data.movimientosInsertados ?? data.movimientos_insertados`), por si el backend cambia de convención.
- **Nota histórica** — `obtenerTokenCalendario()` llama a una ruta relativa `'/api/calendario-token'` con un comentario que dice "función serverless de Vercel"; esto es vestigio de una arquitectura previa (funciones edge en `/api/*.ts` para Vercel, ver `vite-plugins/api-dev-middleware.ts`). En el despliegue actual (Docker + Caddy), esa misma ruta relativa la resuelve el proxy hacia el **backend Spring**, que hoy expone `GET /api/calendario-token` (ver `docBackend.md`).

### 6.2 `authSession.ts` — sesión JWT en cliente

Reemplaza a Supabase Auth. Guarda el JWT del backend propio en `localStorage['finsight.token']`, lo decodifica (base64url, sin verificar firma — la firma la valida el backend) para derivar `usuarioId`/`email`/`exp`, y expone un **pub/sub minimalista** (`Set<Listener>`) para que `AuthContext` reaccione a login/logout/cambio de avatar sin pasar por Context anidados. `getToken()` borra el token solo si venció (`exp * 1000 <= Date.now()`). El avatar-emoji (`finsight.avatarIcon`) y la URL de foto (`finsight.avatarUrl`) también viven acá, en `localStorage`, porque ya no existe el `user_metadata` de Supabase.

### 6.3 `errors.ts`

Una única clase, `NotFoundError`, usada para distinguir 404 de otros errores (por ejemplo, para decidir si mostrar "no existe" vs. un error genérico).

---

## 7. Autenticación — flujo completo

1. **Registro** (`/signup` → `SignUpForm`) — `POST /auth/v2/register` directo contra el backend (bcrypt, sin Supabase). Valida regex de password fuerte en cliente antes de enviar; checklist de campos faltantes con mensajes diferenciados.
2. **Login** (`/signin` → `SignInForm`) — Llama `signIn()` de `AuthContext`. Tras guardar el token, hace **polling** (cada 100 ms, hasta 6 s) esperando a que `usuarioId` esté resuelto en el contexto antes de navegar — así el `WelcomeSplash` post-login puede mostrar el nombre completo sin pantallas intermedias en blanco.
3. **Recuperar contraseña** — Modal SweetAlert2 con input de email, llama `/auth/v2/forgot-password` directo con `fetch`. El backend siempre responde 200 (no revela si el email existe) y manda un link `/reset-password?token=...` por email (Resend).
4. **Reset** (`/reset-password` → `ResetPasswordForm`) — Lee el `token` de la query string; si el backend lo rechaza, marca `enlaceInvalido` para un aviso persistente (en vez de un toast que desaparece).
5. **Cambio de password autenticado** — Desde `/profile`, un modal SweetAlert2 con HTML custom inyectado, con medidor de fuerza inline enganchado al ciclo de vida `didOpen` (`utils/passwordSwalStrength.ts`, que reutiliza las reglas de `PasswordStrengthMeter.tsx`).
6. **Guard de rutas** — `ProtectedRoute` (`components/auth/ProtectedRoute.tsx`) redirige a `/signin` si no hay sesión; como `loading` de `AuthContext` es siempre síncrono, no hay parpadeo de spinner en el caso normal.
7. **Autorización por request** — El JWT viaja en `Authorization: Bearer` en cada llamada al backend (vía `apiFetch`); las llamadas al AI-Service para el chat **no** llevan este token — el AI-Service valida distinto (token de servicio hacia el backend, ver `docBackend.md`).

---

## 8. Layout y navegación

### `AppLayout.tsx`

Shell de todas las rutas privadas. Envuelve el contenido en `SidebarProvider` + `OnboardingProvider` (scopeados solo a rutas autenticadas) y monta, además del `<Outlet/>`: `AppSidebar`, `Backdrop` (overlay para cerrar el sidebar en mobile), `AppHeader`, footer legal, y — globalmente para toda la app logueada — `FloatingChatWidget` (oculto en `/asistente-ia` para no duplicar el chat), `SupportSuccessModal`, `OnboardingTour` y `AchievementToastHost`. Usa `useEsModoMatrix()` para teñir el fondo general cuando el usuario está en `/modo-matrix`.

### `AppHeader.tsx`

Incluye un **buscador global fuzzy** (`Ctrl/Cmd+K`) que indexa tanto los ítems del sidebar (`navItems`/`othersItems`, importados desde `AppSidebar`) como ~19 anclas manuales a secciones internas de cada página (`SECTION_ENTRIES`, con `#hash`), para que buscar por ejemplo "grafico gastos" lleve directo a esa sección del dashboard. El matching usa una regex fuzzy construida a mano (`buildFuzzyRegex`) que tolera errores de tipeo ("imprtr csv" → "Importar CSV"), con navegación por teclado (flechas + Enter) en los resultados.

### `AppSidebar.tsx`

Colapsable con expansión por hover, submenús animados por altura, y atributos `data-tour="..."` en cada ítem que usa `OnboardingTour` para el spotlight guiado. Muestra un badge "NUEVO" en Educación Financiera hasta que el usuario visita esa página (flag en `localStorage`, namespaced por `usuarioId`).

---

## 9. Gamificación

Sistema completo de retención/engagement, íntegramente sincronizado contra el backend (tablas `gamificacion_estado`, `reto_progreso`, `logros_desbloqueados`, `trivia_resultados` — ver `docBackend.md` §6). Nada crítico vive solo en `localStorage`: entrar desde otro dispositivo trae el mismo progreso.

- **Score de salud financiera** (`computeHealthScore`, `utils/gamification.ts`) — Ilustrativo, 0-100: 40% perfil de riesgo del usuario + 30% ratio ahorro/ingreso + 30% progreso de metas activas → nivel 1-10 con 10 títulos temáticos.
- **Retos semanales** — `CHALLENGE_CATALOG` (4 plantillas) + `pickWeeklyChallenges()` selecciona 3 por semana de forma **determinística** (hash de `usuarioId:weekKey`), así todos los dispositivos del mismo usuario ven los mismos retos toda la semana sin coordinarse. Rotan según semana ISO (`getIsoWeekKey`, lunes-domingo) y evalúan progreso contra datos ya cargados en cliente (transacciones, metas, perfil) sin pedir nada nuevo al backend.
- **Racha semanal** (`streak`) y **racha diaria** (`dailyStreak`, independiente) — Ambas se llevan por separado; la diaria detecta días consecutivos de actividad (`esDiaConsecutivo`).
- **Trivia** (`components/gamificacion/TriviaQuiz.tsx`) — 5 preguntas por ronda: 2 potencialmente **personalizadas** con datos reales (`preguntaTopCategoria`, `preguntaPerfilFinanciero`, de `data/gamification.ts`) + generales de un banco de ~113 preguntas. Ruleta estilo "Preguntados" con `conic-gradient`, confetti CSS en ronda perfecta, sonidos por evento, mascotas con diálogos aleatorios (solo desktop).
- **Logros** (`data/achievements.ts` → `ACHIEVEMENTS_CATALOG`, ~55 IDs) — Divididos en `hito` (uso normal: primera meta, primer CSV, etc.) y `especial` (easter eggs: rickroll, modo matrix, admin click frenzy...). Dos **logros-corona** se calculan automáticamente al completarse todos los de su categoría: `leyenda_finanzas` (todos los hitos) y `coleccionista_secretos` (todos los especiales) — se excluyen a sí mismos del cálculo para no autobloquearse.
  - `AchievementsList.tsx` oculta el nombre de logros no desbloqueados detrás de un **texto rúnico determinístico** (alfabeto Futhark, hash simple del ID) — clickear 3+ veces muestra una frase de "regaño", 6+ veces revela la pista real y desbloquea un logro meta (`logro_persistente`).
- **Celebraciones** (`AchievementToastHost.tsx`, montado global en `AppLayout`) — Cola de toasts (esquina, 4 s, sonido de entrada/salida sincronizado) para logros normales y subidas de nivel; los 2 logros-corona disparan un **video fullscreen** en vez de un toast. Coordina con easter eggs del chat y splashes de cambio de perfil (evento custom) para no solaparse.
- **Puntos** — Se otorgan por evento (`registrarEvento`: crear meta +15, aportar a meta +5, importar CSV +20, mensaje al asistente +2) y por logro desbloqueado (+25 cada uno); `computePointsRango()` los traduce a un rango textual.

---

## 10. Asistente IA "Finsi" (`pages/Ai/AsistenteIA.tsx`)

La página más grande del proyecto (~1900 líneas). Chat con streaming SSE contra el AI-Service, con historial persistido en `localStorage` (máx. 20 chats por usuario) y una capa de UX muy elaborada:

- **Streaming narrado** — `preguntarAgenteStream` recibe eventos `step` intermedios (ej. "Finsi está analizando tus gastos...") antes del `done` final, para narrar el progreso en preguntas costosas (hoy solo el resumen financiero narra pasos; el resto llega con un único evento).
- **Espera artificial mínima** (3 s) para que la respuesta nunca se sienta "instantánea" sin importar la latencia real del LLM.
- **Modo dual** — Selector Advisor (financiero) / Soporte técnico (comparte motor con `pages/Soporte.tsx`, que usa la variante sin streaming `preguntarAgente`).
- **Voz** — Dictado (Web Speech API, con fallback `webkitSpeechRecognition`) y TTS de respuestas, con visualización de onda de audio en vivo (`AudioContext` + `AnalyserNode`, 40 barras) en `components/ai/PromptComposer.tsx`.
- **Edición de mensajes** — Al estilo ChatGPT: editar un mensaje reconstruye la conversación desde ese punto (descarta lo posterior).
- **Metadata interna oculta** — El backend embebe contexto en comentarios HTML (`<!-- finsi-financial-context ... -->`, `<!-- finsi-goal-draft ... -->`) que `limpiarMetadataInterna()` extrae y nunca se renderiza al usuario.
- **Detección de logros** — `detectarLogroEnRespuesta` (`utils/achievements.ts`) matchea 21 substrings fijos de respuestas determinísticas del backend para saber qué easter egg respondió, sin que la API exponga ese dato explícitamente.
- **Catálogo de easter eggs visuales** (`detectarEasterEggVisual`) — 17 tipos (Kenobi, Yoda, Matrix, Game of Thrones, Wololo, Rickroll, Isengard, Albion, Hello World, Mongolia, dinero infinito, Ctrl+Z de gastos, Finsi caminando, Finsi cripto, Skynet, descanso), cada uno con su webp animado + audio, activados por marcadores `!audio[...]` que manda el backend.
  - **Anti-repetición de rickroll** — Si el usuario repite la misma pregunta consecutiva, responde con el rickroll **sin llamar al backend** (ahorra tokens/latencia), replicando la lógica de `easter_eggs.py` del AI-Service.
  - **Descanso automático** — Al mensaje #30 del usuario en la sesión, se inyecta el easter egg de "descanso" una única vez.
  - **Pastilla roja/azul** (easter egg Matrix) — Roja → splash fullscreen → navega a `/modo-matrix` pasando `state.pastillaRojaSplash: true` como token de acceso de un solo uso (si se entra a la URL directo sin ese state, `ModoMatrix.tsx` muestra una pantalla "Acceso denegado" — `IntrusoMatrix` — y desbloquea un logro).
  - **Logout por easter egg** — Si la respuesta incluye el marcador `[[finsi-logout]]`, reproduce un audio y cierra sesión.
- **"Explícame más"** — Botón condicional (`puedeMostrarExplicameMas`) que aparece solo cuando una heurística por regex determina que la respuesta amerita ampliación (evita saludos y contenido corto no financiero).

`components/common/FloatingChatWidget.tsx` es una versión mini del mismo chat, flotante en el resto de la app (oculta en `/asistente-ia`), sin easter eggs visuales ni historial persistido; tras la 1ª o 2ª respuesta invita a continuar en el asistente completo, pasando los mensajes ya escritos por `state`.

---

## 11. Módulos financieros clave

| Página | Función | Detalle no obvio |
|---|---|---|
| **Dashboard (`Home.tsx`)** | Vista general: perfil, gráficos de ingresos/gastos por categoría, últimas transacciones, recomendaciones | Si el usuario no tiene transacciones, muestra una landing de "cuenta nueva" con CTA a Importar CSV en vez del dashboard vacío. Emite `CustomEvent('finsight:financial-score-updated')` para que el header muestre el score circular. |
| **Transacciones** | Listado con filtro en cascada estilo Excel (tipo → categoría → subcategoría → descripción → signo) + paginación cliente (20/página) | "Tipo" y "Signo" son mutuamente excluyentes (Ingreso=Positivo); forzar la combinación imposible desbloquea un logro en vez de aplicarse. Vista cards en mobile / tabla en desktop. |
| **Análisis** | Formulario editable (ingreso, endeudamiento, frecuencia de ahorro) → `POST /analisis-financiero` | Cualquier edición invalida el resultado anterior, obligando a re-analizar. El botón final navega a Metas marcando en `sessionStorage` que la próxima meta viene "desde análisis" (desbloquea un logro específico). |
| **Recomendaciones** | Vista de solo lectura del último análisis, con lectura por voz (TTS) y botón "Preguntar a Finsi" | Reescribe literales tipo "20%" a "20 por ciento" antes de mandarlo al asistente, porque su detector de intención interpreta "número%" como operación matemática (mismo patrón replicado en 4 componentes distintos). |
| **Metas** | CRUD de `Goal` (categorías AHORRO/COMPRA/DEUDA/EMERGENCIA/VIAJE/OTRO), con aportes | Al superar el 100% de progreso muestra una mascota especial de celebración. |
| **Importar CSV** | 3 modos: CARGAR/ACTUALIZAR/SOBREESCRIBIR (bloqueados según si ya hay movimientos); validación de extensión y tamaño (≤5 MB) | Compara el perfil financiero **antes y después** de importar y dispara videos fullscreen distintos según el resultado (mejora, empeora, o cae a "en riesgo"), con textos sincronizados a tiempos exactos del video (`onTimeUpdate`). `SOBREESCRIBIR` exige un modal de confirmación adicional por ser destructivo. |
| **Educación Financiera** | 5 tarjetas de conceptos (capacidad de ahorro, deuda/ingreso, gastos fijos/variables, fondo de emergencia, metas) | La recomendación destacada se elige con un **árbol de decisión determinístico en cliente** (no LLM) según perfil/endeudamiento/ahorro. |
| **Calendario** | FullCalendar combinando eventos reales (auto-generados) + manuales (CRUD) | Eventos reales: metas activas con fecha objetivo + próxima ocurrencia estimada de transacciones recurrentes (agrupadas por tipo+categoría+descripción, +1 mes desde la última). Motor de recomendaciones por evento generado 100% en cliente. Notificaciones Web Push con Service Worker (`public/sw.js`) y clave VAPID pública. Exporta `.ics` armado a mano (sin librería) y ofrece suscripción `webcal://`. Solo los eventos manuales son arrastrables/redimensionables, con guardado optimista y rollback si falla. |
| **Mi cuenta (`UserProfiles.tsx`)** | Edición de perfil, cambio de password, avatar (recorte circular), exportar informe, cerrar sesión, baja de cuenta | La baja de cuenta exige escribir literalmente "ELIMINAR" para confirmar. Usa `PerfilDataContext` (no hace fetch propio de perfil/transacciones). |

---

## 12. Exportación de reportes (`src/utils/export/`)

Tres formatos, disponibles desde `ExportMenu` (Dashboard, Transacciones, Análisis, Mi cuenta):

- **CSV** (`exportCsv.ts`) — RFC 4180 estricto (coma, CRLF, sin BOM), pensado para consumo por otro sistema, no para abrir "bonito" en Excel.
- **PDF** (`exportPdf.ts`) — Reporte A4 apaisado con `jsPDF` + `jspdf-autotable`: membrete con logo, tarjetas de KPI con filete de color, gráfico opcional (capturado del DOM), tabla con fila de TOTAL opcional, colores semánticos por celda (verde/rojo), pie de página paginado.
- **Excel genérico** (`exportXlsx.ts`) — Con `ExcelJS`. Incluye `balancedSpans()`, un algoritmo de backtracking que reparte los KPIs entre columnas de ancho desigual minimizando la desviación visual, y un parser manual del chunk `IHDR` de PNG para leer dimensiones de imagen sin librería de imágenes.
- **Excel del Dashboard con gráficos nativos** (`exportXlsxDashboard.ts`) — El módulo más singular: en vez de generar un `.xlsx` desde cero, **descarga una plantilla** (`public/templates/dashboard-financiero-base.xlsx`, preparada con `scripts/build-dashboard-template.mjs`), la abre como ZIP con `JSZip`, y **reescribe las celdas directamente en el XML** (`sheet1.xml`/`sheet2.xml`) por regex, para preservar los gráficos nativos de Excel de la plantilla — algo que `ExcelJS` no soporta generar desde código. Limpia entradas de carpeta sintéticas del ZIP que rompían la apertura del archivo en Excel 2016.
- **Captura de gráficos** (`captureChart.ts`) — `html2canvas-pro` sobre el nodo del chart (escala 2x, fondo blanco) para incrustar la imagen en PDF/Excel.
- Exportar en cada formato desbloquea un logro distinto (`exportar_csv/excel/pdf/dashboard`).

---

## 13. Tipos centrales (`src/types/finance.ts`)

Contrato TypeScript compartido por casi toda la app: `Usuario`, `Transaccion` (con `subcategoria?`, `recurrente: boolean`), `AnalisisRequest`/`TransaccionInput`, `RecomendacionFinanciera` (con `prioridad: 'alta'|'media'|'sugerencia'`, `preguntaFinsi`, `advertencia`), `AnalisisResponse` (incluye opcionales `financialScore`/`scoreStatus`/`scoreColor`), `PerfilUsuario`, `ResumenTransacciones`, `GoalCategory`/`GoalStatus`/`Goal`/`GoalInput`, `TipoEventoCalendario`/`EventoCalendario`/`EventoCalendarioInput`.

---

## 14. Onboarding (`components/onboarding/OnboardingTour.tsx`)

Tour guiado de 9 pasos con spotlight (recorte simulado con `box-shadow` gigante sobre el elemento resaltado), narración opcional por voz, versionado (`TOUR_VERSION`) guardado en `localStorage` por usuario para no repetirlo tras cada release. Navega entre rutas reales mientras resalta ítems del sidebar, simulando un "click" antes de navegar. Botón de ayuda flotante permanente para reabrirlo (oculto durante el paso del asistente o en `/asistente-ia`). Completarlo desbloquea un logro.

---

## 15. Estilos y temas

Tailwind CSS 4 configurado íntegramente en `src/index.css` vía el bloque `@theme` (sin `tailwind.config.js` — es el modelo de configuración CSS-first de Tailwind v4): tipografía **Outfit** (Google Fonts), breakpoints extendidos (`2xsm`, `xsm`, `3xl`), escala tipográfica custom (`text-title-*`), y paletas completas `brand`, `gray`, `blue-light`, `orange`, `success`, `error` (11 tonos cada una, 25→950).

- **Dark mode** — `@custom-variant dark (&:is(.dark *))`: la clase `dark` se aplica en `<html>` desde `ThemeContext`, persistida en `localStorage['theme']`.
- **Modo Matrix** — No es un tema Tailwind, es un override puntual: `useEsModoMatrix()` (hook, chequea `pathname === '/modo-matrix'`) se usa en 6+ componentes de layout/header para forzar una paleta roja/oscura mientras el usuario está en esa ruta específica.

---

## 16. Variables de entorno

| Variable                       | Dónde se usa                          | Descripción                                                                 | Default / ejemplo |
|----------------------------------|-----------------------------------------|--------------------------------------------------------------------------------|--------------------|
| `VITE_API_URL`                    | `services/api.ts`, `AuthContext`        | Base del backend Spring                                                        | Dev: `http://localhost:8081/api` · Prod (Caddy): `/api` |
| `VITE_AI_URL`                     | `services/api.ts`                       | Base del AI-Service (chat)                                                     | Dev: `http://localhost:8000` · Prod: `/ai` |
| `VITE_SUPABASE_URL`               | Legado (funciones serverless `/api` de Vercel) | Ya no se usa para Auth de la SPA (auth propia); resto de infra Supabase | *(vacío en Docker/OCI)* |
| `VITE_SUPABASE_ANON_KEY`          | Ídem                                    | Ídem                                                                            | *(vacío en Docker/OCI)* |
| `VITE_VAPID_PUBLIC_KEY`           | `Calendar.tsx` (push)                   | Clave pública VAPID para suscripción Web Push (debe coincidir con `VAPID_PUBLIC_KEY` del backend) | — |
| `VITE_INACTIVITY_MINUTES`         | `AuthContext`                           | Minutos de inactividad antes del auto-logout                                    | `25` |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Funciones serverless `/api` (Vercel, legado) | Server-only, sin prefijo `VITE_` a propósito (Vite no las mete en el bundle) | — |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Ídem                              | Envío de emails desde funciones serverless (alternativa al backend Spring en el deploy Vercel) | — |
| `SITE_URL`                        | Ídem                                    | Base para links en emails; si falta, usa el origin de la request                | — |
| `EMAIL_LOGO_URL`                  | Ídem                                    | Logo para emails; si falta, usa uno alojado en postimg.cc                       | — |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Ídem (Vercel) | Par de claves Web Push (generadas una vez con `npx web-push generate-vapid-keys`) | — |
| `CRON_SECRET`                     | Ídem                                    | Protege el endpoint serverless de recordatorios para que solo lo dispare el Cron de Vercel | — |

> **Nota sobre `.env.production`** — Vite mergea `.env` + `.env.production` en `npm run build`. `frontend/.env.production` fija `VITE_API_URL=/api` y `VITE_AI_URL=/ai` (rutas relativas, same-origin bajo Caddy) y ya trae la `VITE_VAPID_PUBLIC_KEY` de producción; el resto de las `VITE_*` (Supabase, etc.) se toman del `.env` local no versionado.

> **Legado Vercel** — El `.env.example` documenta variables de funciones serverless (`/api/*.ts`) que corrían en Vercel Edge Functions en una arquitectura previa (antes de tener backend + auth propios). `vite-plugins/api-dev-middleware.ts` simula ese runtime en `vite dev` cargando el módulo y adaptando request/response Web-standard, para poder probar esas funciones sin `vercel dev`. En el árbol actual del repo no hay carpeta `frontend/api/`, así que esas funciones fueron migradas al backend Spring; las variables quedan documentadas por si se reactiva ese camino de despliegue (ver `render.yaml`, que asume frontend en Vercel).

---

## 17. Cómo correr en local

### Opción A — Node directo (desarrollo con HMR)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Requiere un `.env` en `frontend/` con al menos `VITE_API_URL` y `VITE_AI_URL` apuntando al backend/AI-Service corriendo (local o Docker). Si el backend expone `/api` en `localhost:8081` y el AI-Service `/api/v1`-style en `localhost:8000`, usar los defaults de `.env.example`.

### Opción B — Docker Compose (stack completo)

Desde la raíz del repo (`G9-FinanceAI-Team29/`), con Docker Compose se levanta el frontend junto al backend, AI-Service, Postgres y Caddy:

```bash
docker compose up -d --build            # stack completo
docker compose up -d --build frontend   # solo reconstruir el frontend
```

El frontend queda detrás de Caddy; internamente el contenedor `frontend` sirve estático por nginx en `:80` (no expone `:5173`). Hay también `docker-compose.dev.yml` con un target `dev` en el `Dockerfile` (Vite dev server con HMR, código montado como volumen) para iterar sin rebuild — usa `usePolling` de chokidar porque los bind mounts de Docker Desktop (Windows/Mac) no siempre propagan eventos `inotify` entre host y contenedor.

### Build de producción

```bash
npm run build      # tsc -b && vite build → genera dist/
npm run preview     # sirve dist/ localmente para smoke-test
```

### Lint

```bash
npm run lint        # eslint .
```

---

## 18. Docker y despliegue

### `Dockerfile` (multi-stage)

1. **`build`** (`node:20-alpine`) — `npm ci` + `npm run build`. Vite lee los `.env` presentes en el contexto de build (para el deploy OCI se usa `frontend/.env.production`, con `VITE_API_URL=/api` y `VITE_AI_URL=/ai`).
2. **`runtime`** (`nginx:alpine`) — Copia `dist/` y `nginx.conf`; expone `:80`.
3. **`dev`** (target alternativo) — Solo para `docker-compose.dev.yml`: corre `vite --host 0.0.0.0` con el código como volumen montado, para HMR dentro del contenedor.

### `nginx.conf`

- SPA fallback: cualquier ruta del router (`/signin`, `/transacciones`, ...) cae en `index.html` (`try_files $uri $uri/ /index.html`).
- `index.html` **nunca se cachea** (`no-cache, no-store, must-revalidate`) — sin esto, un deploy nuevo no llegaría al usuario hasta que borrara caché a mano.
- `/assets/*` (bundles con hash de Vite, cambian de nombre en cada build) → cache largo e inmutable (`1y`, `immutable`).

### Topología de despliegue (recomendada — OCI + Docker Compose)

Ver diagrama en §2. Caddy termina TLS y enruta por prefijo: `/api/*` → backend, `/ai/*` → AI-Service (le saca el prefijo), todo lo demás → este contenedor nginx. Esto hace que el frontend **nunca necesite CORS** contra sus propios servicios: todo es same-origin desde el navegador.

### Topología alternativa (`render.yaml` — Vercel + Render)

El repo documenta también un camino de despliegue separado: **frontend en Vercel** (con sus funciones serverless legado en `/api`) + **backend y AI-Service en Render** (Docker). En ese esquema sí hace falta configurar `ALLOWED_ORIGINS` en el backend/AI-Service con la URL pública de Vercel, porque frontend y APIs quedan en orígenes distintos (cross-origin real, con CORS). No es el despliegue principal documentado en `docBackend.md` (que asume OCI same-origin), pero está soportado por el código (`VITE_API_URL`/`VITE_AI_URL` son absolutas en ese caso, no relativas).

---

## 19. Particularidades a destacar (para jurado / demo de hackathon)

- **Sin CORS en producción** gracias al reverse proxy same-origin — decisión de arquitectura, no accidente.
- **Reintento transparente ante cold-start** (`apiFetch`) — la SPA tolera el arranque lento típico de `docker compose up` (backend/DB levantando) sin que el usuario vea un error, reintentando una vez en requests idempotentes.
- **Gamificación server-synced de punta a punta** — nada crítico depende de `localStorage`; probar la app desde otro navegador/dispositivo con el mismo login mantiene racha, puntos y logros.
- **Exportación con gráficos Excel nativos** vía manipulación directa del XML de una plantilla — más elaborado que generar el `.xlsx` con una librería estándar, y evita el límite de ExcelJS de no poder crear charts nativos.
- **Asistente con streaming SSE + narración de pasos**, historial local, voz bidireccional (dictado + TTS) y un sistema de easter eggs multimedia extenso, coordinado con gamificación (logros ocultos) sin acoplar ambos sistemas directamente (se comunican por `CustomEvent`s del DOM).
- **Motor de recomendaciones de calendario 100% en cliente** (sin LLM) para eventos financieros, separado del asistente basado en IA — dos enfoques distintos convivendo a propósito según el costo/latencia aceptable de cada feature.

---

*FinSightAI — Documentación del Frontend · G9 FinanceAI Team 29 · alcance: solo frontend*
