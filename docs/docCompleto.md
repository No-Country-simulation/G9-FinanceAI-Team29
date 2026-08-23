# FinSightAI — Documentación Técnica Completa

> Documento único que reúne, íntegras y sin resumir, las cuatro documentaciones técnicas del proyecto: **Frontend**, **Backend**, **AI-Service** y **Data Science**. Cada parte conserva su numeración, estilo y contenido originales tal como viven en sus archivos independientes dentro de `docs/`.

**Hackathon ONE - Proyectos G9 · G9 Team 29 · TwentyNine Devs · Alura · Oracle · No Country**

|                    |                                                                                     |
|--------------------|-------------------------------------------------------------------------------------|
| **Proyecto**        | G9 · FinanceAI · Team 29                                                            |
| **Documento**       | Compilado completo (Frontend + Backend + AI-Service + Data Science)                 |
| **Fuentes**         | `docs/docFrontend.md` · `docs/docBackend.md` · `docs/Documentacion AI-Service.md` · `docs/Documentacion Data Science.md` |
| **Alcance**         | Sistema completo — cuatro capas del stack FinSightAI                                |

---

## Índice general

1. [Parte I — Frontend](#parte-i--frontend)
2. [Parte II — Backend](#parte-ii--backend)
3. [Parte III — AI-Service](#parte-iii--ai-service)
4. [Parte IV — Data Science](#parte-iv--data-science)

---

# Parte I — Frontend

---

# FinSightAI — Documentación técnica del Frontend

> SPA de salud financiera personal con IA — arquitectura, rutas, estado, integración con el backend/IA, gamificación, exportación de reportes y despliegue.

**Stack:** React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · React Router 7 · ApexCharts · FullCalendar · ExcelJS/jsPDF/JSZip · nginx (runtime) · Docker

|               |                                                                            |
|---------------|----------------------------------------------------------------------------|
| **Proyecto**  | G9 · FinanceAI · Team 29                                                   |
| **Versión**   | 2.3.0 · 2026-08-23                                                          |
| **Alcance**   | Solo Frontend                                                               |
| **Puerto**    | `5173` (dev, Vite) · `80` (runtime, nginx dentro del contenedor)            |
| **Deploy**    | Docker + Caddy (OCI, same-origin), CI/CD workflows — alternativa: Vercel (SPA + funciones serverless en `/api`) |

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

---

# Parte II — Backend

---

# FinSightAI — Documentación técnica del Backend

> API REST de análisis de salud financiera con IA — arquitectura, seguridad, endpoints, modelo de datos y casos de uso.

**Stack:** Spring Boot 3.4 · Java 21 · PostgreSQL 17 · JWT propio (RS256) · OCI Object Storage · OCI Compute (Ubuntu 20.04 ARM64) · AI-Service (FastAPI/ML) · Docker Compose

|               |                                                                            |
|---------------|----------------------------------------------------------------------------|
| **Proyecto**  | G9 · FinanceAI · Team 29                                                   |
| **Versión**   | 1.3 · 2026-08-21                                                           |
| **Alcance**   | Solo Backend                                                               |
| **Base path** | `/api`                                                                     |
| **Deploy**    | OCI Compute (VM) — `http://148.116.105.209` (HTTPS por dominio en proceso) |

---

## 1. Resumen del sistema

El backend es una API REST en **Spring Boot** que centraliza autenticación, datos financieros del usuario y la orquestación de la inteligencia artificial. **Firma sus propios tokens**, persiste los datos en **PostgreSQL** y guarda los avatares y modelos en **Object Storage**. Un microservicio de IA (FastAPI) resuelve la clasificación y el análisis con modelos de ML.

- **🔐 Autenticación propia** — Registro y login con `JWT RS256` firmado por el backend. El `sub` del token ES el usuarioId (USR####).
- **💰 Núcleo financiero** — Transacciones, metas de ahorro, perfil financiero, resumen de gastos y recomendaciones personalizadas.
- **🤖 IA + ML** — Delegación al AI-Service para clasificar transacciones y predecir el perfil, con `fallback` a reglas internas.
- **🎮 Gamificación** — Retos semanales, trivia, logros y estado (racha, puntos, nivel) con `upsert atómico`.
- **📅 Calendario + Push** — Eventos, feed `.ics` suscribible y recordatorios por `email (Resend)` y `Web Push (VAPID)`.
- **📎 Almacenamiento** — Avatares e imágenes en `OCI Object Storage` (S3-compatible); MinIO como equivalente local.

---

## 2. Arquitectura y stack

Todo corre en contenedores orquestados por Docker Compose detrás de un reverse proxy **Caddy** que unifica el origen (same-origin) y termina TLS en producción.

```
🌐 Navegador (SPA React)
     │  Guarda el JWT en localStorage → Authorization: Bearer
     ▼
🧭 Caddy — reverse proxy (:80 / :443)
     │  /api/* → backend   ·   /ai/* → ai-service   ·   resto → frontend (nginx)
     ▼
 ┌─────────────────────────────┬───────────────────────────────────┐
 │ ☕ Backend — Spring Boot :8081 │ 🐍 AI-Service — FastAPI :8000 │
 │ API REST, auth, negocio, seg. │ ML (.joblib) + chat LLM         │
 └─────────────────────────────┴───────────────────────────────────┘
     ▼
 ┌───────────────────┬──────────────────────────┬─────────────────┐
 │ 🐘 PostgreSQL 17  │ 📦 OCI Object Storage   │ ✉️ Resend      │
 │ Datos (Hibernate) │ Avatares + modelos ML    │ Emails          │
 └───────────────────┴──────────────────────────┴─────────────────┘
```

### Comunicación entre servicios

- **Usuario → Backend:** JWT propio en el header `Authorization`; el backend lo valida con su clave pública RSA.
- **Backend → AI-Service:** llamadas HTTP para clasificar/analizar; si el AI-Service no responde, el backend cae a sus reglas internas.
- **AI-Service → Backend:** lee datos del usuario con el header `X-Service-Token` (rol de servicio, sin token de usuario).

### Stack técnico

| Capa               | Tecnología                               | Detalle                                                            |
|--------------------|-------------------------------------------|---------------------------------------------------------------------|
| Runtime            | Java 21 · Spring Boot 3.4.1              | Maven; empaquetado en imagen Docker                                |
| Persistencia       | Spring Data JPA / Hibernate              | PostgreSQL 17; `ddl-auto=update`; UPSERT nativo en puntos críticos |
| Seguridad          | Spring Security · OAuth2 Resource Server | JWT RS256 con Nimbus JOSE; filtros y ownership propios             |
| Almacenamiento     | AWS SDK for Java v2 (S3)                 | `forcePathStyle` contra OCI / MinIO                                |
| Email              | Resend API                               | Reset de contraseña y recordatorios                                |
| Web Push           | web-push (VAPID) + BouncyCastle          | Notificaciones de recordatorios en el navegador                    |
| Tareas             | Spring `@Scheduled`                      | Job diario de recordatorios                                        |
| Docs               | springdoc-openapi (Swagger UI)           | `/swagger-ui.html` · `/v3/api-docs`                                |

---

## 3. Object Storage & buckets (OCI)

El backend guarda los archivos binarios (las fotos de perfil) fuera de la base de datos, en **OCI Object Storage** a través de su **API compatible con S3**. Al hablar S3 estándar, el mismo código funciona contra OCI en la nube o contra un MinIO local en desarrollo: solo cambian las variables de entorno.

### Cómo se conecta OCI con el backend

- **Cliente S3** — `ObjectStorageService` crea un `S3Client` (AWS SDK for Java v2) apuntando al endpoint S3-compatible de OCI (`https://<namespace>.compat.objectstorage.<región>.oraclecloud.com`).
- **Credenciales** — autentica con un par **Access Key / Secret Key** (las *Customer Secret Keys* de OCI), inyectadas por variables de entorno; nunca van en el código.
- **Path-style** — usa `forcePathStyle(true)` (URL `endpoint/bucket/objeto`), que es como OCI y MinIO exponen los objetos.
- **Región + namespace** — apuntan al Object Storage de la tenencia; el `S3Client` se construye una sola vez al arrancar.

### Nuestros dos buckets

| Bucket             | Quién lo usa      | Para qué                                           | Acceso              |
|--------------------|-------------------|-----------------------------------------------------|---------------------|
| `finsight-avatars` | Backend (escribe) | Fotos de perfil de los usuarios                    | **Lectura pública** |
| `finsight-models`  | AI-Service (lee)  | Modelos de ML (`.joblib`) que descarga al arrancar | Privado             |

El bucket de **avatares** tiene **lectura pública**: la URL de la imagen se muestra directo en el navegador (en un `<img src>`) sin firmar cada pedido, y se sirve desde OCI, no desde el backend. El de **modelos** es **privado**: solo el AI-Service, con sus credenciales, lo lee.

### Flujo de subida de un avatar

1. **El usuario sube la foto** — `POST /api/usuarios/{id}/avatar` (multipart/form-data, campo `archivo`).
2. **El backend arma la _key_** — `avatars/{usuarioId}/{uuid}.{ext}`: nombre único por UUID para no pisar archivos previos.
3. **PutObject al bucket** — sube el binario a `finsight-avatars` con su `Content-Type`.
4. **Devuelve la URL pública** — `{public-base-url}/{key}`; el backend la guarda en `avatarUrl` del usuario.
5. **El frontend la muestra** — usa esa URL directamente; la imagen viaja desde OCI, aliviando al backend.

### Configuración (variables de entorno)

| Variable                                | Qué es                                              |
|-------------------------------------------|-------------------------------------------------------|
| `STORAGE_S3_ENDPOINT`                   | Endpoint S3-compatible de OCI (o de MinIO en local) |
| `STORAGE_S3_REGION`                     | Región de la tenencia                               |
| `STORAGE_S3_ACCESS_KEY` / `_SECRET_KEY` | Customer Secret Keys (credenciales S3 de OCI)       |
| `STORAGE_AVATARS_BUCKET`                | Nombre del bucket de avatares (`finsight-avatars`)  |
| `STORAGE_AVATARS_PUBLIC_URL`            | Base pública desde donde se sirven las imágenes     |

### Servidor y despliegue (OCI Compute)

Además del Object Storage, la aplicación se **aloja en OCI Compute**: una máquina virtual de Oracle Cloud donde corre todo el stack con **Docker Compose**.

| Componente        | Detalle                                                                                                                             |
|--------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| Servicio OCI      | OCI Compute (Virtual Machine, familia Ampere **ARM**)                                                                               |
| Sistema operativo | Canonical **Ubuntu 20.04 LTS** (*focal*)                                                                                            |
| Arquitectura      | **aarch64 / ARM64**                                                                                                                 |
| Imagen de la VM   | `Canonical-Ubuntu-20.04-aarch64-2025.07.23-0`                                                                                       |
| Orquestación      | **Docker Compose** — 6 contenedores: frontend (nginx), backend (Spring), ai-service (FastAPI), postgres, minio, caddy (proxy + TLS) |
| Acceso            |  (HTTPS por dominio `finsight.ai.sppa.cl`)                                                                                          |

> Con esto OCI se usa por **partida doble**: **Object Storage** (avatares + modelos) y **Compute** (la VM que hospeda la app).

---

## 4. Seguridad y autenticación

API **stateless** (sin sesión de servidor ni CSRF). Cada request se autentica por sí mismo con un JWT de usuario o con el token de servicio. La autorización combina reglas por ruta (Spring Security) con un chequeo de propiedad por recurso.

- **🎫 JWT propio (RS256)** — `JwtService` firma con una clave **RSA 2048** y verifica con la pública. Claims: `sub`=usuarioId, `email`, `iat`, `exp` (1 h por defecto). `JwtDecoderConfig` registra esa clave pública como decoder del resource server.
- **🛡️ Chequeo de propiedad** — `OwnershipInterceptor` protege `/api/usuarios/{usuarioId}/**`: el usuarioId del path debe coincidir con el `sub` del token. Excepciones con acceso total: rol de servicio (AI) y emails admin.
- **🔗 Token de servicio** — `ServiceTokenAuthFilter`: si llega `X-Service-Token` igual al configurado, autentica como `ROLE_SERVICE`. Así el AI-Service lee datos sin token de usuario.
- **🧱 Cabeceras + CORS** — CSP, HSTS, X-Frame-Options (sameOrigin) y Referrer-Policy. CORS con orígenes configurables (`ALLOWED_ORIGINS`) y credenciales habilitadas.

### Reglas de acceso por ruta

| Ruta                                   | Acceso         | Motivo                                                        |
|------------------------------------------|------------------|------------------------------------------------------------------|
| `/api/auth/**` (salvo change-password) | Público        | Registro, login y reset de contraseña                         | 
| `/api/auth/v2/change-password`         | 🔒 Autenticado | Requiere token válido (usa el sub)                            |
| `/api/calendario-ics`                  | Público*       | Feed .ics; *protegido por un token secreto en la URL          |
| `/swagger-ui/**` · `/v3/api-docs/**`   | Público        | Documentación de la API                                       |
| `/actuator/health`                     | Público        | Health-check                                                  |
| cualquier otra                         | 🔒 Autenticado | JWT de usuario o X-Service-Token; + ownership en /usuarios/** |

### Flujo de autenticación

1. **Registro** — `POST /api/auth/v2/register`: valida que el email no exista, hashea la contraseña (BCrypt) y crea el usuario con id secuencial `USR####`.
2. **Login** — `POST /api/auth/v2/login`: verifica email + contraseña y devuelve el **JWT** firmado.
3. **Uso** — el frontend guarda el token y lo manda en `Authorization: Bearer <jwt>` en cada request.
4. **Olvidé mi contraseña** — `forgot-password` genera un token (se guarda **hasheado**, SHA-256) y envía por email un enlace `/reset-password?token=…`. Responde siempre 200 (no revela si el email existe).
5. **Reset / cambio** — `reset-password` fija la nueva clave con el token; `change-password` la cambia con la contraseña actual para el usuario autenticado.

> **⚠️ Nota de producción — clave de firma del JWT (PENDIENTE).** Hoy `JwtService` genera un par RSA 2048 **nuevo en memoria cada vez que arranca**: firma con la privada y verifica con la pública de esa misma instancia. Esto trae dos límites. **(1) Reinicios:** al reiniciar se genera otra clave, así que todos los tokens emitidos antes dejan de validar (firma inválida) y los usuarios quedan deslogueados. **(2) Escalado horizontal:** con dos o más instancias detrás de un balanceador, cada una tiene su propia clave, entonces un token firmado por la instancia A es rechazado por la B (401 intermitentes). **Solución:** montar una **clave RSA fija** como secreto (archivo/variable/vault), compartida por todas las instancias y estable entre reinicios; así los tokens sobreviven a los reinicios y cualquier instancia puede verificar cualquier token.

---

## 5. Referencia de la API

Base path `/api`. 🔒 = requiere autenticación · 👤 = además chequeo de propiedad (solo tus datos) · 🔗 = accesible por el AI-Service con token de servicio.

### Autenticación — `/api/auth/v2`

| Método | Ruta                 | Acceso  | Descripción                                          |
|--------|----------------------|---------|--------------------------------------------------------|
| POST   | `/register`          | Público | Crea la cuenta; devuelve usuarioId y email           |
| POST   | `/login`             | Público | Valida credenciales; devuelve el JWT                 |
| POST   | `/forgot-password`   | Público | Envía email con enlace de reset (respuesta genérica) |
| POST   | `/reset-password`    | Público | Fija la nueva contraseña con el token del email      |
| POST   | `/change-password`   | 🔒      | Cambia la contraseña del usuario autenticado         |

### Usuarios y perfil — `/api/usuarios`

| Método | Ruta                    | Acceso  | Descripción                                                    |
|------- |-------------------------|----------|-------------------------------------------------------------------|
| GET    | `/{id}`                 | 🔒👤🔗  | Datos básicos del usuario                                     |
| PUT    | `/{id}`                 | 🔒👤    | Actualiza el usuario completo                                  |
| PATCH  | `/{id}/perfil`          | 🔒👤    | Actualiza campos del perfil                                    | 
| POST   | `/{id}/avatar`          | 🔒👤    | Sube la foto (multipart, campo `archivo`) a OCI Object Storage |
| DELETE | `/{id}`                 | 🔒👤    | Baja **lógica** del usuario (preserva sus datos)               |
| GET    | `/{id}/perfil`          | 🔒👤🔗 | Perfil completo (incluye avatarUrl)                             |
| GET    | `/{id}/recomendaciones` | 🔒👤🔗 | Recomendaciones generadas para el usuario                      |

> **Baja lógica de usuarios.** La eliminación de una cuenta es lógica: el usuario se marca con `estado = ELIMINADO`, `activo = false` y una `fecha_eliminacion`, conservando todos sus datos. El login rechaza las cuentas en estado `ELIMINADO`. Reactivar una cuenta consiste en volver esos campos a `estado = ACTIVO`, `activo = true` y `fecha_eliminacion = NULL`.

### Transacciones — `/api/usuarios/{usuarioId}/transacciones`

| Método | Ruta       | Acceso  | Descripción                    |
|--------|------------|---------|----------------------------------|
| GET    | `/`        | 🔒👤🔗 | Lista de transacciones         |
| GET    | `/pagina`  | 🔒👤🔗 | Lista paginada (PagedResponse) |
| GET    | `/resumen` | 🔒👤🔗 | Resumen agregado por categoría |

### Metas de ahorro — `/api/usuarios/{usuarioId}/metas`

| Método | Ruta                     | Acceso | Descripción                                 |
|--------|--------------------------|--------|-----------------------------------------------|
| GET    | `/`                      | 🔒👤   | Lista de metas (filtro opcional por estado) |
| GET    | `/{goalId}`              | 🔒👤   | Detalle de una meta                         |
| POST   | `/`                      | 🔒👤   | Crea una meta                               |
| PATCH  | `/{goalId}`              | 🔒👤   | Edita una meta                              |
| POST   | `/{goalId}/aportes`      | 🔒👤   | Suma ahorro a la meta                       |
| POST   | `/{goalId}/reservas`     | 🔒👤   | Reserva (hold) un monto para la meta        |
| POST   | `/{goalId}/liberaciones` | 🔒👤   | Libera un monto reservado                   |
| DELETE | `/{goalId}`              | 🔒👤   | Cancela la meta                             |
| GET    | `/resumen`               | 🔒👤   | Resumen de todas las metas                  |

### Gamificación — `/api/usuarios/{usuarioId}/gamificacion`

| Método | Ruta                   | Acceso | Descripción |
|--------|------------------------|--------|-----------------------------------------------|
| GET    | `/retos`               | 🔒👤   | Retos semanales y su progreso             |
| PUT    | `/retos/{retoId}`      | 🔒👤   | Actualiza el progreso de un reto (upsert) |
| GET    | `/trivia/estadisticas` | 🔒👤   | Estadísticas de trivia                    |
| POST   | `/trivia`              | 🔒👤   | Registra una respuesta de trivia          |
| GET    | `/logros`              | 🔒👤   | Logros desbloqueados                      |
| POST   | `/logros/{logroId}`    | 🔒👤   | Desbloquea un logro                       |
| GET    | `/estado`              | 🔒👤   | Estado (racha, puntos, nivel, mensajes)   |
| PUT    | `/estado`              | 🔒👤   | Guarda el estado (upsert atómico)         |

### Calendario, feed .ics y Push — `/api/usuarios/{usuarioId}/eventos-calendario` · `/api`

| Método | Ruta                               | Acceso    | Descripción                                            |
|--------|--------------------------------------|-----------|------------------------------------------------------------|
| GET    | `/…/eventos-calendario`            | 🔒👤     | Lista de eventos del usuario                            |
| POST   | `/…/eventos-calendario`            | 🔒👤     | Crea un evento                                          |
| PATCH  | `/…/eventos-calendario/{eventoId}` | 🔒👤     | Edita un evento                                         |
| DELETE | `/…/eventos-calendario/{eventoId}` | 🔒👤     | Borra un evento                                         |
| GET    | `/calendario-token`                | 🔒       | Genera/devuelve el token del feed .ics del usuario      |
| GET    | `/calendario-ics`                  | Público* | Feed .ics suscribible (autenticado por token en la URL) |
| POST   | `/push-subscribe`                  | 🔒       | Registra una suscripción Web Push                       |
| POST   | `/push-unsubscribe`                | 🔒       | Elimina la suscripción                                  |

### Análisis, ML, CSV y recordatorios — `/api`

| Método | Ruta                                 | Acceso | Descripción                                                                                                        |
|--------|----------------------------------------|------|------------------------------------------------------------------------------------------------------------------------|
| POST   | `/analisis-financiero`               | 🔒🔗 | Perfil financiero + resumen por categoría + recomendaciones. Acepta el cuerpo en **snake_case** (`ingreso_mensual`…) o camelCase. |
| GET    | `/clasificar`                        | 🔒🔗 | Clasifica una descripción (ML, con fallback a reglas)                                                               |
| POST   | `/usuarios/{usuarioId}/importar-csv` | 🔒👤 | Importa transacciones desde un CSV (multipart)                                                                       |
| POST   | `/enviar-recordatorios`              | 🔒🔗 | Dispara el envío de recordatorios (lo llama el cron)                                                                 |

---

## 6. Modelo de datos

Entidades JPA sobre PostgreSQL. Todas las de dominio cuelgan de `Usuario` (relación por `usuario`). Se muestran los campos principales de cada entidad.

| Entidad (tabla)                                  |                                              Campos principales                                                        |
|-----------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| **Usuario** (`usuarios`)                         | Identidad + perfil financiero. id (USR####), nombre, apellido, email, passwordHash, icsToken, avatarUrl, ingresoMensual, deudaMensual, nivelEndeudamiento, gastoMensualPromedio, ahorroMensualEstimado, porcentajeGastosIngreso, frecuenciaAhorro, perfilFinanciero, fechaRegistro, ultimaActividad, fechaEliminacion |
| **Transaccion** (`transacciones`)                | categoria, subcategoria, descripcion, monto, moneda, recurrente, medioPago, fecha, tipo (ingreso/gasto), origen, timestamps |
| **Goal / Meta** (`metas`)                        | nombre, descripcion, montoObjetivo, fechaObjetivo, timestamps. Soporta aportes, reservas (holds) y liberaciones       |
| **ResumenGastos** (`resumen_gastos`)             | categoria, total, porcentaje, cantidadTransacciones, periodoInicio, periodoFin                                        |
| **PerfilHistorial** (`perfiles_historial`)       | perfilPredicho, perfilReal, probabilidad, fechaAnalisis, detalles — traza de cada análisis del perfil                 |
| **Recomendacion** (`recomendaciones`)            | texto, prioridad, categoriaRecomendada, fechaCreacion                                                                 |
| **EventoCalendario** (`eventos_calendario`)      | titulo, tipo, fechaInicio, fechaFin, timestamps. Alimenta el feed .ics                                                |
| **PushSubscription** (`push_subscriptions`)      | endpoint, p256dh, auth, creadoAt — datos VAPID del navegador                                                          |
| **EstadoGamificacion** (`gamificacion_estado`)   | weekKey, challengesBaseline, streak, bestStreak, dailyStreak, puntos, bestLevelSeen, mensajesAsistente, actualizadoAt |
| **RetoProgreso** (`reto_progreso`)               | retoId, semanaIso, progreso — con constraint único por usuario/semana + upsert                                        |
| **Logro / Trivia** (`logros` · `trivia`)         | LogroDesbloqueado (logroId, desbloqueadoAt); TriviaResultado (preguntaId, correcta, respondidoAt)                     |
| **PasswordResetToken** (`password_reset_tokens`) | tokenHash (SHA-256), expiraAt, creadoAt — nunca se guarda el token en claro                                           |

---

## 7. Capa de servicios

La lógica de negocio vive en servicios; los controllers son finos. Estos son los principales:

| Servicio                  | Responsabilidad                                                                      |
|-----------------------------|-----------------------------------------------------------------------------------------|
| `AuthService`             | Registro, login, hash de contraseñas, reset y cambio; emisión del JWT vía JwtService |
| `JwtService`              | Firma (RS256) y verificación de los tokens propios del backend                       |
| `AnalisisService`         | Orquesta el análisis: perfil financiero, resumen de gastos y recomendaciones         |
| `MlService`               | Cliente del AI-Service: predice categoría y analiza; expone `estaDisponible()`       |
| `ClasificacionService`    | Reglas internas de clasificación (fallback cuando el ML no está disponible)          |
| `RecomendacionService`    | Genera recomendaciones a partir del perfil y los gastos                              |
| `GoalService`             | Metas: aportes, reservas/holds, liberaciones, resumen                                |
| `GamificacionService`     | Retos, trivia, logros y estado con upsert atómico                                    |
| `CalendarioFeedService`   | Token del feed y generación del .ics                                                 |
| `EventoCalendarioService` | CRUD de eventos del usuario                                                          |
| `RecordatoriosService`    | Job diario: detecta metas/eventos que vencen y notifica                              |
| `EmailService`            | Envío de emails vía Resend (reset y recordatorios)                                   |
| `PushService`             | Envío de Web Push (VAPID) a las suscripciones registradas                            |
| `ObjectStorageService`    | Subida de avatares a OCI/MinIO (S3-compatible); se autodeshabilita sin config        |
| `CsvImportService`        | Parseo e importación de transacciones desde CSV                                      |

---

## 8. Casos de uso (flujos)

### A · Análisis de salud financiera

1. **El usuario pide el análisis** — `POST /api/analisis-financiero` con ingresos, endeudamiento, frecuencia de ahorro y transacciones.
2. **Clasificación de transacciones** — `AnalisisService` pide a `MlService` la categoría; si el AI-Service no responde, usa `ClasificacionService` (reglas).
3. **Perfil + resumen** — se predice el **perfil financiero** y se arma el resumen de gastos por categoría; se guarda en `PerfilHistorial` y `ResumenGastos`.
4. **Recomendaciones** — `RecomendacionService` genera consejos priorizados según el perfil.
5. **Respuesta** — `AnalisisResponse`: perfil, resumen y recomendaciones para pintar el dashboard.

### B · Meta de ahorro con reservas (holds)

1. **Crear meta** — `POST /metas` con nombre, monto objetivo y fecha.
2. **Aportar** — `POST /metas/{id}/aportes` suma ahorro real a la meta.
3. **Reservar** — `POST /metas/{id}/reservas` aparta un monto (hold) sin gastarlo todavía.
4. **Liberar** — `POST /metas/{id}/liberaciones` devuelve un monto reservado si cambió el plan.
5. **Seguir el avance** — `GET /metas/resumen` muestra progreso total y por meta.

### C · Recordatorios (email + push)

1. **Suscripción a notificaciones push** — el navegador pide permiso al usuario y registra su **suscripción de Web Push** (permiso para recibir avisos en el navegador; **no es un plan de pago**) con `POST /push-subscribe`, usando la clave VAPID pública.
2. **Cron diario** — un `@Scheduled` (9:00 por defecto) dispara `RecordatoriosService`.
3. **Detección** — busca metas/eventos que vencen en los próximos días.
4. **Notificación** — envía **email** (Resend) y **Web Push** (VAPID) a cada usuario afectado.

### D · Calendario suscribible (.ics)

1. **Obtener token** — `GET /calendario-token` devuelve un token secreto propio del usuario.
2. **Suscribir** — el usuario agrega `/api/calendario-ics?token=…` a Google/Apple Calendar.
3. **Feed vivo** — el endpoint (público pero protegido por el token) devuelve los eventos en formato `text/calendar`.

### E · Avatar en Object Storage · F · Import CSV

- **Avatar (OCI):** `POST /usuarios/{id}/avatar` (multipart, campo `archivo`) → `ObjectStorageService` sube la imagen a OCI (S3-compatible) y guarda la **URL pública** en `avatarUrl`. Sin config de storage, el servicio se autodeshabilita.
- **Import CSV:** `POST /usuarios/{id}/importar-csv` (multipart) → `CsvImportService` parsea el archivo, clasifica y crea las transacciones; responde con un resumen (importadas / errores).

> 📎 **Ejemplos reales de request/response** (3 casos: Saludable / En riesgo / Clasificación) están en el documento aparte **`FinSightAI-Ejemplos-de-Uso.md`**.

---

## 9. Cómo correr el backend

### Opción A — Con Docker (recomendado)
Desde la raíz del repo (necesita los `.env`; ver sección 10):
```bash
docker compose up -d --build         
docker compose up -d --build backend  
```
La app queda detrás de Caddy. El backend escucha internamente en `:8081`.

### Opción B — Local con Maven (desarrollo)
Requisitos: **Java 21**, **Maven**, un **PostgreSQL** accesible.
```bash
cd Backend/backend
# definí las variables de entorno (al menos DB_URL, DB_USER, DB_PASS)
mvn spring-boot:run
mvn clean package
java -jar target/financeai-backend-0.0.1-SNAPSHOT.jar
```

### Documentación viva (Swagger)
Con el backend arriba: **`/swagger-ui.html`** (UI) y **`/v3/api-docs`** (OpenAPI JSON).

---

## 10. Variables de entorno

Todas se inyectan por entorno (en Docker vía `env_file` / `environment`). Los valores sensibles nunca van en el código.

| Variable                     | Qué es                                                | Default                                       |
|--------------------------------|----------------------------------------------------------|--------------------------------------------------|
| `PORT`                       | Puerto del backend                                    | `8081`                                        |
| `DB_URL`                     | JDBC de PostgreSQL                                    | En Docker: `jdbc:postgresql://postgres:5432/finsight` |
| `DB_USER`                    | Usuario de la base                                    | En Docker: `finsight`                         |
| `DB_PASS`                    | Contraseña de la base                                 | *(obligatoria)*                               |
| `ALLOWED_ORIGINS`            | Orígenes permitidos por CORS (coma-separados)         | `http://localhost:5173,http://localhost:3000` |
| `SERVICE_TOKEN`              | Token para auth service-to-service (AI-Service)       | *(vacío)*                                     |
| `ML_SERVICE_URL`             | URL del AI-Service                                    | `http://127.0.0.1:8000`                       |
| `ML_SERVICE_ENABLED`         | Habilita/deshabilita el ML (fallback a reglas si off) | `true`                                        |
| `SITE_URL`                   | URL pública del sitio (para links en emails)          | `http://localhost`                            |
| `RESEND_API_KEY`             | API key de Resend (emails)                            | *(vacío)*                                     |
| `EMAIL_FROM`                 | Remitente de los emails                               | `FinSightAI <onboarding@resend.dev>`          |
| `EMAIL_LOGO_URL`             | Logo para los emails                                  | *(vacío)*                                     |
| `VAPID_PUBLIC_KEY`           | Clave pública Web Push                                | *(vacío)*                                     |
| `VAPID_PRIVATE_KEY`          | Clave privada Web Push                                | *(vacío)*                                     |
| `VAPID_SUBJECT`              | Contacto VAPID (mailto:)                              | `mailto:soporte@finsightai.com`               |
| `RECORDATORIOS_CRON`         | Cron del job de recordatorios                         | `0 0 9 * * *` (9:00 diario)                   |
| `RECORDATORIOS_ZONE`         | Zona horaria del cron                                 | `America/Argentina/Buenos_Aires`              |
| `ADMIN_EMAILS`               | Emails con acceso admin                               | `demo.admin@finsight.com`                     |
| `STORAGE_S3_ENDPOINT`        | Endpoint S3-compatible (OCI o MinIO)                  | *(vacío → storage off)*                       |
| `STORAGE_S3_REGION`          | Región del Object Storage                             | `us-east-1`                                   |
| `STORAGE_S3_ACCESS_KEY`      | Access Key (Customer Secret Key de OCI)               | *(vacío)*                                     |
| `STORAGE_S3_SECRET_KEY`      | Secret Key                                            | *(vacío)*                                     |
| `STORAGE_AVATARS_BUCKET`     | Bucket de avatares                                    | `finsight-avatars`                            |
| `STORAGE_AVATARS_PUBLIC_URL` | URL pública base de los avatares                      | *(vacío)*                                     |

> Si faltan las de `STORAGE_S3_*`, el `ObjectStorageService` **se autodeshabilita** y el backend arranca igual (solo se inactiva la subida de avatares).

> `DB_URL` y `DB_USER` se inyectan en el deploy con Docker apuntando al contenedor `postgres` (usuario `finsight`).

---

## 11. Manejo de errores

Todas las excepciones se centralizan en `GlobalExceptionHandler` (`@RestControllerAdvice`) y devuelven un **JSON uniforme**:

```json
{
  "timestamp": "2026-08-20T23:57:41.02",
  "status": 400,
  "error": "Bad Request",
  "message": "La solicitud contiene datos inválidos",
  "path": "/api/auth/v2/register",
  "validationErrors": { "apellido": "El apellido es obligatorio." }
}
```
`validationErrors` solo aparece en errores de validación (mapa campo → mensaje).

| Situación                         | Excepción                                                          | Código |
|--------------------------------------|------------------------------------------------------------------------|---------|
| Datos inválidos (Bean Validation) | `MethodArgumentNotValidException` / `ConstraintViolationException` | **400** |
| Argumento inválido de negocio     | `IllegalArgumentException`                                         | **400** |
| Archivo subido demasiado grande   | `MaxUploadSizeExceededException`                                   | **413** |
| Método HTTP no permitido          | `HttpRequestMethodNotSupportedException`                           | **405** |
| Ruta/recurso no encontrado        | `NoResourceFoundException`                                         | **404** |
| Error inesperado                  | `Exception` (catch-all)                                            | **500** |

---

## 12. Tests (pruebas automatizadas)

El backend incluye una suite con `spring-boot-starter-test` (JUnit 5 + Mockito + MockMvc):

| Clase                      | Cubre                          |
|-----------------------------|-----------------------------------|
| `AuthServiceTest`         | Registro y login                |
| `JwtServiceTest`          | Firma y verificación de tokens  |
| `SecurityIntegrationTest` | Reglas de seguridad por ruta    |
| `ValidationTest`          | Bean Validation de los DTOs     |
| `DtoNullToleranceTest`    | Tolerancia a valores nulos      |
| `PagedResponseTest`       | Paginación                      |

Correrlas:
```bash
cd Backend/backend
mvn test
```

---

*FinSightAI — Documentación del Backend · G9 FinanceAI Team 29 ·  alcance: solo backend*

---

# Parte III — AI-Service

---

# FinSightAI AI-Service

**FastAPI · Python · Machine Learning · Finsi**\
Microservicio de inteligencia, análisis financiero y asistencia
conversacional

**Hackathon ONE - Proyectos G9**\
G9 Team 29 · TwentyNine Devs\
Alura · Oracle · No Country\
Versión del servicio 1.0.0 · Modelos ML v10.0.0 · Agosto 2026

------------------------------------------------------------------------

## 1. Resumen ejecutivo

El **AI-Service** es el microservicio inteligente de FinSightAI.
Centraliza la clasificación automática de transacciones, el análisis del
perfil financiero, el procesamiento de archivos CSV, la generación de
recomendaciones estructuradas, la consulta conversacional mediante
**Finsi** y la gestión de metas financieras expuesta al resto de la
plataforma.

La API está implementada con **FastAPI** y **Pydantic**. Los modelos de
Machine Learning se serializan con **Joblib** y fueron entrenados con
**scikit-learn**. El asistente integra proveedores LLM y construye
contexto financiero específico según la intención de la consulta.

### Objetivos principales

-   Transformar datos financieros y transacciones en información
    estructurada y accionable.
-   Clasificar gastos e ingresos y asignar categoría y subcategoría.
-   Estimar perfil financiero, riesgo, Financial Score y métricas
    derivadas.
-   Generar recomendaciones explicables con diagnóstico, acción,
    objetivo y evidencia.
-   Permitir consultas financieras conversacionales sin delegar al LLM
    los cálculos determinísticos.
-   Procesar movimientos importados por CSV y normalizarlos para la
    plataforma.

### Alcance

Este documento cubre exclusivamente el AI-Service y sus interfaces con
los consumidores externos. El Frontend y el Backend Spring Boot se
consideran sistemas externos y cuentan con documentación independiente.

### Principios de diseño

  ---------------------------------------------------------------------
  Principio                          Aplicación en AI-Service
  ---------------------------------- ----------------------------------
  Separación de responsabilidades    Routers, schemas, servicios,
                                     modelos ML y agente se mantienen
                                     en módulos diferenciados.

  Validación temprana                Pydantic y validadores de dominio
                                     rechazan entradas incoherentes
                                     antes del análisis.

  Resultados explicables             Score, riesgo, métricas,
                                     fortalezas, oportunidades y
                                     evidencia acompañan las
                                     recomendaciones.

  Contexto mínimo                    Finsi selecciona los datos
                                     financieros necesarios según la
                                     intención detectada.

  Contrato API                       FastAPI expone OpenAPI y Swagger
                                     UI automáticamente.
  ---------------------------------------------------------------------

## 2. Arquitectura del AI-Service

El AI-Service recibe solicitudes HTTP desde el Backend o consumidores
autorizados. Los routers FastAPI delegan la lógica a módulos
especializados: predicción, análisis de perfil, procesamiento CSV,
agente conversacional y metas.

### Flujo de componentes

``` text
Cliente / Backend
       |
FastAPI / OpenAPI
       |
Pydantic Validation
       |
       +--> Clasificación de transacciones --> Modelos ML
       +--> Análisis financiero -----------> Modelos ML
       +--> Finsi / Agente ----------------> Capa LLM
       +--> Procesamiento CSV
       +--> Metas financieras
```

### Estructura interna relevante

  ---------------------------------------------------------------------
  Módulo                             Responsabilidad
  ---------------------------------- ----------------------------------
  `app/api`                          Endpoints: health, category,
                                     csv_import, analysis, agent y
                                     goals.

  `app/schemas`                      Contratos Pydantic de
                                     request/response.

  `app/prediction.py`                Carga y ejecución del clasificador
                                     de transacciones.

  `app/profile.py`                   Análisis financiero, score, perfil
                                     y recomendaciones.

  `app/services/csv_processor.py`    Validación y transformación de
                                     CSV.

  `app/services/agent`               Orquestación de Finsi, intención,
                                     contexto, reglas y consultas.

  `app/services/llm`                 Integraciones con proveedores LLM
                                     (Groq, Gemini, OpenAI).

  `app/services/goals`               Lógica de metas, reservas,
                                     liberaciones y resumen.

  `models / artefactos`              Modelos serializados, metadata y
                                     métricas.

  `tests`                            Pruebas automatizadas de rutas,
                                     agente, contexto, CSV y
                                     recomendaciones.
  ---------------------------------------------------------------------

## 3. Stack tecnológico y ejecución

  Capa               Tecnología / versión
  ------------------ ----------------------------------------------------
  API                FastAPI 0.141.1 · Uvicorn 0.52.1
  Validación         Pydantic 2.13.4 · pydantic-settings 2.14.2
  Datos              Pandas 2.2.3 · NumPy 2.5.1
  Machine Learning   scikit-learn 1.6.1 · Joblib 1.4.2
  LLM                Groq 1.6.0 · Google GenAI 2.16.0 · cliente OpenAI
  RAG / vectores     FAISS CPU 1.15.0
  Testing            Pytest 9.1.1 · HTTPX 0.28.1 · pytest-asyncio 1.4.0
  Containerización   Docker · `python:3.12-slim`

### Ejecución local

``` bash
python -m uvicorn app.main:app --reload
```

Swagger UI: `http://127.0.0.1:8000/docs`\
OpenAPI: `http://127.0.0.1:8000/openapi.json`

### Containerización y seguridad

El Dockerfile instala dependencias, copia `app`, `models` y `data`,
expone el puerto 8000 y ejecuta Uvicorn. Las credenciales se administran
mediante variables de entorno y CORS mediante settings.

### Estado del servicio

`GET /health` → `200 OK`

``` json
{
  "status": "ok",
  "service": "FinSightAI AI Service",
  "version": "1.0.0",
  "environment": "development",
  "components": {
    "machine_learning": {
      "status": "configured",
      "configured": true
    },
    "groq": {
      "status": "configured",
      "configured": true
    },
    "gemini": {
      "status": "configured",
      "configured": true
    }
  }
}
```

## 4. Machine Learning

Dos modelos principales y un clasificador complementario de subcategorías serializados con Joblib (`random_state = 42`).
Fueron entrenados con datos sintéticos para el MVP; en producción se
recomienda reentrenar y validar con datos reales.

### 4.1 Clasificador de transacciones

Feature principal: `descripcion_limpia`.

16 clases: Alimentación, Compras, Deudas, Educación, Entretenimiento,
Impuestos, Otros, Otros ingresos, Reintegro, Salario, Salud, Servicios,
Transferencia recibida, Transporte, Venta y Vivienda.

  Evaluación      Accuracy   Precision macro   Recall macro   F1 macro
  ------------- ---------- ----------------- -------------- ----------
  Hold-Out          1.0000            1.0000         1.0000     1.0000
  CV agrupada       0.9967            0.9858         0.9771     0.9767

### 4.2 Clasificador complementario de subcategorías

FinSightAI incorpora un tercer artefacto de Machine Learning para refinar la clasificación de gastos. Una vez determinada la categoría principal, el clasificador de subcategorías utiliza la descripción de la transacción junto con esa categoría para estimar una subcategoría más específica.

``` text
descripción → categoría → subcategoría
```

El AI-Service conserva una estrategia híbrida de inferencia. Las reglas exactas y coincidencias conocidas pueden resolver categoría y subcategoría directamente; cuando corresponde utilizar Machine Learning, `clasificador_subcategoria.joblib` complementa a `clasificador_gastos.joblib`.

Los artefactos utilizados por los modelos `v10.0.0` son:

``` text
clasificador_gastos.joblib
clasificador_subcategoria.joblib
clasificador_perfil.joblib
```

### 4.3 Clasificador de perfil financiero

Perfiles: **Saludable**, **En observación** y **En riesgo**.

Features: endeudamiento, porcentaje gastos/ingresos, cantidad de
transacciones, recurrencias, transacciones grandes, diversidad de
categorías y ratios de deuda, gasto y ahorro.

  Evaluación             Accuracy   Precision macro   Recall macro   F1 macro
  -------------------- ---------- ----------------- -------------- ----------
  Hold-Out                 0.8840            0.8888         0.8937     0.8895
  Validación cruzada       0.9000            0.8991         0.9121     0.9031

Las métricas son adecuadas para el MVP. El rendimiento perfecto del
clasificador transaccional en hold-out debe interpretarse considerando
el diseño sintético del dataset.

## 5. Contrato de API

Contrato OpenAPI con Swagger UI.

  -----------------------------------------------------------------------
  Método           Endpoint                              Descripción
  ---------------- ------------------------------------- ----------------
  GET              `/`                                   Estado básico y
                                                         acceso a
                                                         documentación.

  GET              `/health`                             Salud del
                                                         servicio y
                                                         componentes
                                                         configurados.

  POST             `/predict/category`                   Clasifica una
                                                         transacción.

  POST             `/csv/procesar`                       Valida y
                                                         transforma un
                                                         CSV de
                                                         movimientos.

  POST             `/analysis`                           Ejecuta un
                                                         análisis
                                                         financiero con
                                                         datos provistos.

  GET              `/analysis/users/{usuario_id}`        Obtiene o genera
                                                         análisis de un
                                                         usuario
                                                         existente.

  POST             `/agent/chat`                         Consulta
                                                         conversacional a
                                                         Finsi.

  POST             `/agent/chat/stream`                  Consulta Finsi
                                                         mediante
                                                         Server-Sent
                                                         Events.

  GET              `/goals/users/{usuario_id}`           Lista metas;
                                                         admite filtro
                                                         por estado.

  GET              `/goals/{goal_id}`                    Consulta una
                                                         meta individual.

  POST             `/goals`                              Crea una meta
                                                         financiera.

  PATCH            `/goals/{goal_id}`                    Actualiza una
                                                         meta.

  POST             `/goals/{goal_id}/reserve`            Reserva dinero
                                                         para una meta.

  POST             `/goals/{goal_id}/release`            Libera dinero
                                                         reservado.

  DELETE           `/goals/{goal_id}`                    Cancela una meta
                                                         financiera.

  GET              `/goals/users/{usuario_id}/summary`   Obtiene resumen
                                                         agregado de
                                                         metas.
  -----------------------------------------------------------------------

### Compatibilidad con el contrato del Hackathon

El desafío utiliza nombres de campos en `snake_case`. El contrato
público de análisis debe mantener compatibilidad con campos como:

``` json
{
  "ingreso_mensual": 4500,
  "nivel_endeudamiento": 25,
  "frecuencia_ahorro": "Media",
  "transacciones": [
    {
      "descripcion": "Supermercado",
      "valor": 420
    }
  ]
}
```

y respuestas estructuradas con campos como `perfil_financiero`,
`resumen_gastos` y `recomendaciones`.

### Códigos de respuesta

-   `200`: operación exitosa.
-   `400`: regla de negocio, incoherencia o solicitud inválida.
-   `404`: usuario o meta no encontrada.
-   `422`: error de validación de schema o CSV.

### Compatibilidad con `snake_case` mediante aliases

El esquema de entrada mantiene compatibilidad con los nombres utilizados por frontend y consumidores de la API mediante aliases. Por ejemplo, `medio_pago` puede utilizarse en `POST /predict/category` y es mapeado correctamente por el modelo de entrada. Esta compatibilidad ya está implementada y no constituye una limitación pendiente.

## 6. Ejemplos de Request / Response

### 6.1 Clasificación automática

`POST /predict/category`

``` json
{
  "descripcion": "Pago de alquiler",
  "monto": 850,
  "fecha": "2026-07-21",
  "medio_pago": "Transferencia bancaria",
  "recurrente": "Sí"
}
```

`200 OK`

``` json
{
  "tipo_transaccion": "GASTO",
  "categoria_predicha": "Vivienda",
  "subcategoria_predicha": "Alquiler",
  "confianza": 0.99,
  "metodo_clasificacion": "regla_exacta",
  "advertencias": [],
  "modelo_version": "10.0.0"
}
```

### 6.2 Análisis financiero - escenario saludable

Usuario de demo: `USR0615`

Datos del dataset final:

-   Ingreso mensual: \$3.390,19
-   Gasto mensual promedio: \$975,43
-   Deuda mensual: \$165,18
-   Capacidad de ahorro estimada: \$2.414,75
-   Gastos / ingresos: 28,77 %
-   Nivel de endeudamiento: 4,87 %
-   Porcentaje de ahorro: 71,23 %
-   Frecuencia de ahorro: Alta
-   Perfil financiero: **Saludable**
-   Transacciones disponibles: 76

El caso representa a un usuario con amplio margen entre ingresos y
gastos, bajo nivel de endeudamiento y alta capacidad de ahorro.

### 6.3 Análisis por usuario - escenario en observación

`GET /analysis/users/USR0114`

Datos del dataset final:

-   Ingreso mensual: \$2.409,18
-   Gasto mensual promedio: \$1.801,33
-   Deuda mensual: \$116,18
-   Capacidad de ahorro estimada: \$607,85
-   Gastos / ingresos: 74,77 %
-   Nivel de endeudamiento: 4,82 %
-   Porcentaje de ahorro: 25,23 %
-   Frecuencia de ahorro: Alta
-   Perfil financiero: **En observación**
-   Transacciones disponibles: 74

El caso representa una situación intermedia: el endeudamiento es bajo y
existe capacidad de ahorro, pero los gastos absorben una proporción
considerable de los ingresos.

### 6.4 Análisis por usuario - escenario en riesgo

`GET /analysis/users/USR0401`

Datos del dataset final:

-   Ingreso mensual: \$4.658,05
-   Gasto mensual promedio: \$4.287,88
-   Deuda mensual: \$1.858,17
-   Capacidad de ahorro estimada: \$370,17
-   Gastos / ingresos: 92,05 %
-   Nivel de endeudamiento: 39,89 %
-   Porcentaje de ahorro: 7,95 %
-   Frecuencia de ahorro: Baja
-   Perfil financiero: **En riesgo**
-   Transacciones disponibles: 74

El caso representa un usuario con gastos muy próximos a sus ingresos,
bajo margen de ahorro y un nivel de endeudamiento elevado.

## 7. CSV y normalización de movimientos

### Plantilla de importación actual

La plantilla destinada al usuario requiere únicamente:

``` text
fecha, descripcion, monto, tipo, medio_pago, recurrente
```

El usuario no necesita completar `categoria` ni `subcategoria`. Para los movimientos de tipo `GASTO`, FinSightAI determina automáticamente ambos valores durante el procesamiento.

Ejemplo:

``` csv
fecha,descripcion,monto,tipo,medio_pago,recurrente
2026-08-01,Sueldo mensual,3200.00,INGRESO,Transferencia bancaria,Sí
2026-08-02,Compra en supermercado,120.50,GASTO,Tarjeta de débito,No
2026-08-03,Pago de internet del hogar,55.00,GASTO,Débito automático,Sí
```


`POST /csv/procesar` recibe `usuario_id` y un archivo multipart.

La respuesta se organiza en tres bloques:

-   `usuario`: métricas financieras.
-   `transacciones`: movimientos normalizados.
-   `resumen`: valores agregados.

Ejemplo documentado de validación: 33 transacciones en 3 meses, \$10,300
de ingresos y \$6,328.29 de gastos.

## 8. Finsi - agente financiero conversacional

Finsi funciona como una capa conversacional sobre datos estructurados.
Utiliza detección de intención, consultas determinísticas, reglas,
contexto mínimo y proveedores LLM.

`FinancialContextBuilder` selecciona únicamente los campos necesarios
según la intención. Los cálculos financieros críticos permanecen fuera
del LLM.

### Chat tradicional

`POST /agent/chat`

``` json
{
  "usuario_id": "USR0401",
  "question": "¿Cómo están mis finanzas actualmente?"
}
```

`200 OK`

``` json
{
  "answer": "**Resumen**\nTus indicadores actuales corresponden a un perfil En riesgo...",
  "provider": "groq"
}
```

### Streaming SSE

`POST /agent/chat/stream`\
`Content-Type: text/event-stream`

``` text
data: { "status": "step", "message": "Finsi está revisando tus datos financieros..." }
data: { "status": "done", "answer": "La situación financiera muestra...", "provider": "groq" }
```

## 9. Recomendaciones financieras

Las recomendaciones son objetos estructurados para que el Frontend
represente prioridad, diagnóstico y próximos pasos.

  ---------------------------------------------------------------------
  Campo                              Función
  ---------------------------------- ----------------------------------
  `id`                               Identificador estable de la
                                     recomendación.

  `tipo`                             Familia de recomendación
                                     financiera.

  `perfil`                           Perfil financiero asociado.

  `prioridad`                        `alta`, `media` o `sugerencia`.

  `titulo`                           Nombre legible para UI.

  `diagnostico`                      Explicación basada en los datos.

  `accion`                           Acción sugerida.

  `objetivo`                         Meta cuantificable cuando
                                     corresponde.

  `evidencia`                        Valores numéricos o categóricos
                                     que justifican la recomendación.

  `pregunta_finsi`                   Prompt contextual para continuar
                                     el análisis con Finsi.

  `advertencia`                      Límite de alcance y recomendación
                                     de asesoramiento profesional.
  ---------------------------------------------------------------------

## 10. Metas financieras

CRUD de metas, reservas y liberaciones. Expone monto objetivo,
reservado, restante, progreso, fecha objetivo, reserva mensual sugerida,
estado y timestamps.

`GET /goals/users/USR0001`

``` json
{
  "nombre": "Saldar Deuda de Credito",
  "categoria": "DEUDA",
  "monto_objetivo": 40000,
  "monto_reservado": 10000,
  "monto_restante": 30000,
  "progreso": 25,
  "reserva_mensual_sugerida": 6000,
  "estado": "ACTIVA"
}
```

`DELETE /goals/{goal_id}` cancela una meta. `/reserve` y `/release`
modifican el monto reservado.

## 11. Casos de uso

  -------------------------------------------------------------------------
  ID             Caso de uso    Actor          Interfaz
  -------------- -------------- -------------- ----------------------------
  UC-01          Verificar      Backend / ops  `GET /health`
                 salud del                     
                 servicio                      

  UC-02          Clasificar una Backend        `POST /predict/category`
                 transacción                   

  UC-03          Analizar       Backend        `POST /analysis`
                 información                   
                 financiera                    

  UC-04          Analizar un    Backend        `GET /analysis/users/{id}`
                 usuario por ID                

  UC-05          Procesar       Backend /      `POST /csv/procesar`
                 movimientos    usuario        
                 CSV                           

  UC-06          Consultar a    Backend /      `POST /agent/chat`
                 Finsi          usuario        

  UC-07          Consultar a    Frontend /     `POST /agent/chat/stream`
                 Finsi en       Backend        
                 streaming                     

  UC-08          Gestionar      Backend        `/goals...`
                 metas                         
                 financieras                   
  -------------------------------------------------------------------------

### Tres ejemplos representativos para el Hackathon

Los siguientes casos corresponden a respuestas reales del endpoint
`GET /analysis/users/{usuario_id}` utilizando tres usuarios del dataset
sintético final, uno por cada perfil financiero reconocido por
FinSightAI.

#### Caso 1 --- Perfil En riesgo (`USR0401`)

`GET /analysis/users/USR0401`

  Code   Details
  ------ ---------
  200    

##### Response body

``` json
{
  "usuario_id": "USR0401",
  "financial_score": 20,
  "score_status": "Crítico",
  "score_color": "red",
  "nivel_riesgo": "Crítico",
  "perfil_financiero": "En riesgo",
  "confianza_perfil": 0.9999,
  "probabilidades_perfil": {
    "En observación": 0.0001,
    "En riesgo": 0.9999,
    "Saludable": 0
  },
  "explicacion": "Los gastos mensuales representan aproximadamente el 92.1% de los ingresos. El nivel de endeudamiento equivale al 39.9% y la capacidad de ahorro estimada es del 7.9%. Las principales categorías de consumo son Vivienda y Deudas.",
  "fortalezas": [
    "Existe información suficiente para definir un plan de mejora."
  ],
  "oportunidades_mejora": [
    "Reducir el porcentaje de ingresos destinado a gastos.",
    "Priorizar la reducción progresiva de deuda.",
    "Construir un hábito de ahorro mensual.",
    "Revisar suscripciones y pagos recurrentes."
  ],
  "metricas": {
    "ingreso_mensual": 4658.05,
    "gasto_mensual_promedio": 4287.88,
    "deuda_mensual": 1858.17,
    "ahorro_mensual_estimado": 370.17,
    "ratio_gasto_ingreso": 0.9205,
    "ratio_deuda_ingreso": 0.3989,
    "ratio_ahorro_ingreso": 0.0795
  },
  "categorias_principales": [
    {"categoria": "Vivienda", "monto": 17166.37, "porcentaje": 33.36},
    {"categoria": "Deudas", "monto": 14161.93, "porcentaje": 27.52},
    {"categoria": "Compras", "monto": 8245.31, "porcentaje": 16.02}
  ],
  "recomendaciones": [
    {
      "id": "gastos-altos-vivienda",
      "tipo": "gastos_altos",
      "perfil": "En riesgo",
      "prioridad": "alta",
      "titulo": "Reducir el peso de los gastos",
      "diagnostico": "Los gastos representan el 92.1% de los ingresos. Vivienda es la categoría de mayor consumo, con $17,166.37.",
      "accion": "Revisar primero los movimientos de Vivienda y buscar una reducción gradual del 5% al 10%, sin afectar necesidades esenciales.",
      "objetivo": "Llevar gradualmente los gastos totales por debajo del 75% de los ingresos.",
      "evidencia": {"ratio_gasto_ingreso": 0.9205, "categoria_principal": "Vivienda", "monto_categoria_usd": 17166.37, "porcentaje_categoria": 33.36},
      "pregunta_finsi": "Vengo de la recomendación 'Reducir el peso de los gastos'. Analiza conmigo los gastos de Vivienda, explica por qué son prioritarios y ayúdame a armar un plan concreto para reducirlos.",
      "advertencia": "Esta orientación se basa en los datos registrados en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero."
    },
    {
      "id": "reducir-deuda-prioritaria",
      "tipo": "deuda_alta",
      "perfil": "En riesgo",
      "prioridad": "alta",
      "titulo": "Priorizar la reducción de deuda",
      "diagnostico": "Las obligaciones mensuales representan el 39.9% de los ingresos.",
      "accion": "Ordenar las deudas por costo financiero, evitar nuevas obligaciones y dirigir el excedente a la deuda más costosa.",
      "objetivo": "Reducir gradualmente las cuotas mensuales por debajo del 30% de los ingresos.",
      "evidencia": {"ratio_deuda_ingreso": 0.3989},
      "pregunta_finsi": "Vengo de la recomendación sobre reducir deuda. Ayúdame a priorizar pagos y crear un plan realista con mis datos.",
      "advertencia": "Esta orientación se basa en los datos registrados en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero."
    },
    {
      "id": "construir-capacidad-ahorro",
      "tipo": "ahorro_bajo",
      "perfil": "En riesgo",
      "prioridad": "alta",
      "titulo": "Construir capacidad de ahorro",
      "diagnostico": "La capacidad de ahorro estimada es del 7.9% de los ingresos.",
      "accion": "Separar una parte de cada ingreso apenas se recibe y automatizar el ahorro cuando sea posible.",
      "objetivo": "Alcanzar primero un ahorro mensual equivalente al 10% de los ingresos.",
      "evidencia": {"ratio_ahorro_ingreso": 0.0795},
      "pregunta_finsi": "Vengo de la recomendación sobre construir capacidad de ahorro. Ayúdame a definir un plan mensual paso a paso.",
      "advertencia": "Esta orientación se basa en los datos registrados en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero."
    },
    {
      "id": "auditar-gastos-recurrentes",
      "tipo": "recurrentes_altos",
      "perfil": "En riesgo",
      "prioridad": "media",
      "titulo": "Auditar pagos recurrentes",
      "diagnostico": "Hay 30 movimientos recurrentes registrados.",
      "accion": "Revisar suscripciones, membresías y débitos automáticos y cancelar los que ya no aportan valor.",
      "objetivo": "Eliminar cargos recurrentes innecesarios y liberar margen mensual.",
      "evidencia": {"cantidad_recurrentes": 30},
      "pregunta_finsi": "Ayúdame a revisar la recomendación sobre pagos recurrentes y a decidir cuáles debería analizar primero.",
      "advertencia": "Esta orientación se basa en los datos registrados en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero."
    }
  ],
  "modelo_version": "10.0.0"
}
```

Este caso demuestra un perfil crítico con gastos muy elevados respecto
de los ingresos, endeudamiento alto y baja capacidad de ahorro. El
endpoint devuelve además las categorías de mayor consumo y
recomendaciones estructuradas para reducir gastos, deuda y pagos
recurrentes.

#### Caso 2 --- Perfil En observación (`USR0114`)

`GET /analysis/users/USR0114`

  Code   Details
  ------ ---------
  200    

##### Response body

``` json
{
  "usuario_id": "USR0114",
  "financial_score": 70,
  "score_status": "En observación",
  "score_color": "yellow",
  "nivel_riesgo": "Moderado",
  "perfil_financiero": "En observación",
  "confianza_perfil": 0.9939,
  "probabilidades_perfil": {"En observación": 0.9939, "En riesgo": 0.0055, "Saludable": 0.0006},
  "explicacion": "Los gastos mensuales representan aproximadamente el 74.8% de los ingresos. El nivel de endeudamiento equivale al 4.8% y la capacidad de ahorro estimada es del 25.2%. Las principales categorías de consumo son Vivienda y Salud.",
  "fortalezas": ["El endeudamiento se encuentra dentro de un rango saludable.", "La capacidad de ahorro mensual es sólida."],
  "oportunidades_mejora": ["Reducir el porcentaje de ingresos destinado a gastos.", "Revisar suscripciones y pagos recurrentes."],
  "metricas": {"ingreso_mensual": 2409.18, "gasto_mensual_promedio": 1801.33, "deuda_mensual": 116.18, "ahorro_mensual_estimado": 607.85, "ratio_gasto_ingreso": 0.7477, "ratio_deuda_ingreso": 0.0482, "ratio_ahorro_ingreso": 0.2523},
  "categorias_principales": [
    {"categoria": "Vivienda", "monto": 13914.3, "porcentaje": 64.37},
    {"categoria": "Salud", "monto": 1817.49, "porcentaje": 8.41},
    {"categoria": "Deudas", "monto": 1707.17, "porcentaje": 7.9}
  ],
  "recomendaciones": [
    {
      "id": "optimizar-gastos-vivienda", "tipo": "optimizacion_gastos", "perfil": "En observación", "prioridad": "media", "titulo": "Optimizar las categorías de mayor consumo",
      "diagnostico": "Los gastos utilizan el 74.8% de los ingresos. La mayor concentración está en Vivienda.",
      "accion": "Comparar los movimientos de Vivienda e identificar ajustes posibles sin afectar gastos esenciales.",
      "objetivo": "Liberar al menos un 5% adicional de los ingresos para ahorro o imprevistos.",
      "evidencia": {"ratio_gasto_ingreso": 0.7477, "categoria_principal": "Vivienda"},
      "pregunta_finsi": "Ayúdame a revisar la recomendación sobre optimizar mis gastos de Vivienda y proponme acciones concretas.",
      "advertencia": "Esta orientación se basa en los datos registrados en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero."
    },
    {
      "id": "auditar-gastos-recurrentes", "tipo": "recurrentes_altos", "perfil": "En observación", "prioridad": "media", "titulo": "Auditar pagos recurrentes",
      "diagnostico": "Hay 32 movimientos recurrentes registrados.",
      "accion": "Revisar suscripciones, membresías y débitos automáticos y cancelar los que ya no aportan valor.",
      "objetivo": "Eliminar cargos recurrentes innecesarios y liberar margen mensual.",
      "evidencia": {"cantidad_recurrentes": 32},
      "pregunta_finsi": "Ayúdame a revisar la recomendación sobre pagos recurrentes y a decidir cuáles debería analizar primero.",
      "advertencia": "Esta orientación se basa en los datos registrados en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero."
    },
    {
      "id": "proteger-ahorro", "tipo": "ahorro_saludable", "perfil": "En observación", "prioridad": "sugerencia", "titulo": "Proteger y organizar el ahorro",
      "diagnostico": "La capacidad de ahorro estimada es del 25.2% de los ingresos.",
      "accion": "Separar el ahorro destinado a emergencias del ahorro para metas de mediano o largo plazo.",
      "objetivo": "Construir o mantener un fondo de emergencia equivalente a entre 3 y 6 meses de gastos esenciales.",
      "evidencia": {"ratio_ahorro_ingreso": 0.2523},
      "pregunta_finsi": "Vengo de la recomendación sobre proteger mi ahorro. Ayúdame a separar fondo de emergencia y metas.",
      "advertencia": "Esta orientación se basa en los datos registrados en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero."
    }
  ],
  "modelo_version": "10.0.0"
}
```

Este caso demuestra un escenario intermedio: el endeudamiento es bajo y
existe una capacidad de ahorro sólida, pero el porcentaje de ingresos
destinado a gastos mantiene al usuario en observación.

#### Caso 3 --- Perfil Saludable (`USR0615`)

`GET /analysis/users/USR0615`

  Code   Details
  ------ ---------
  200    

##### Response body

``` json
{
  "usuario_id": "USR0615",
  "financial_score": 90,
  "score_status": "Excelente",
  "score_color": "green",
  "nivel_riesgo": "Bajo",
  "perfil_financiero": "Saludable",
  "confianza_perfil": 1,
  "probabilidades_perfil": {"En observación": 0, "En riesgo": 0, "Saludable": 1},
  "explicacion": "Los gastos mensuales representan aproximadamente el 28.8% de los ingresos. El nivel de endeudamiento equivale al 4.9% y la capacidad de ahorro estimada es del 71.2%. Las principales categorías de consumo son Vivienda y Servicios.",
  "fortalezas": ["El nivel de gasto se mantiene controlado.", "El endeudamiento se encuentra dentro de un rango saludable.", "La capacidad de ahorro mensual es sólida."],
  "oportunidades_mejora": ["Revisar suscripciones y pagos recurrentes."],
  "metricas": {"ingreso_mensual": 3390.19, "gasto_mensual_promedio": 975.43, "deuda_mensual": 165.18, "ahorro_mensual_estimado": 2414.75, "ratio_gasto_ingreso": 0.2877, "ratio_deuda_ingreso": 0.0487, "ratio_ahorro_ingreso": 0.7123},
  "categorias_principales": [
    {"categoria": "Vivienda", "monto": 7721.35, "porcentaje": 65.97},
    {"categoria": "Servicios", "monto": 982.68, "porcentaje": 8.4},
    {"categoria": "Educación", "monto": 980.15, "porcentaje": 8.37}
  ],
  "recomendaciones": [
    {
      "id": "auditar-gastos-recurrentes", "tipo": "recurrentes_altos", "perfil": "Saludable", "prioridad": "media", "titulo": "Auditar pagos recurrentes",
      "diagnostico": "Hay 27 movimientos recurrentes registrados.",
      "accion": "Revisar suscripciones, membresías y débitos automáticos y cancelar los que ya no aportan valor.",
      "objetivo": "Eliminar cargos recurrentes innecesarios y liberar margen mensual.",
      "evidencia": {"cantidad_recurrentes": 27},
      "pregunta_finsi": "Ayúdame a revisar la recomendación sobre pagos recurrentes y a decidir cuáles debería analizar primero.",
      "advertencia": "Esta orientación se basa en los datos registrados en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero."
    },
    {
      "id": "proteger-ahorro", "tipo": "ahorro_saludable", "perfil": "Saludable", "prioridad": "sugerencia", "titulo": "Proteger y organizar el ahorro",
      "diagnostico": "La capacidad de ahorro estimada es del 71.2% de los ingresos.",
      "accion": "Separar el ahorro destinado a emergencias del ahorro para metas de mediano o largo plazo.",
      "objetivo": "Construir o mantener un fondo de emergencia equivalente a entre 3 y 6 meses de gastos esenciales.",
      "evidencia": {"ratio_ahorro_ingreso": 0.7123},
      "pregunta_finsi": "Vengo de la recomendación sobre proteger mi ahorro. Ayúdame a separar fondo de emergencia y metas.",
      "advertencia": "Esta orientación se basa en los datos registrados en FinSightAI. Antes de tomar una decisión financiera importante, es recomendable consultar con un asesor financiero."
    }
  ],
  "modelo_version": "10.0.0"
}
```

Este caso demuestra un perfil saludable con gastos controlados, bajo
endeudamiento y una capacidad de ahorro elevada. El análisis conserva
recomendaciones de optimización aun cuando el perfil general es
favorable.

Los tres casos reproducen respuestas reales del endpoint de análisis por
usuario y muestran cómo FinSightAI diferencia los perfiles **En
riesgo**, **En observación** y **Saludable** utilizando el mismo
contrato de respuesta.

## 12. Validación, errores y calidad

Se aplican controles de coherencia matemática:

-   `nivel_endeudamiento ≈ deuda / ingreso`
-   `porcentaje_gastos_ingreso ≈ gasto / ingreso`
-   `ahorro_mensual_estimado ≈ ingreso - gasto`
-   `Ahorro` no se admite como categoría de gasto.

La suite Pytest cubre agente, intents, CSV, contexto, recomendaciones,
seguridad y timezone. Los artefactos Joblib requieren la versión de
scikit-learn definida en `requirements.txt`.

## 13. Limitaciones y consideraciones

-   Los modelos fueron entrenados con datos sintéticos; producción
    requiere validación con datos reales y monitoreo.
-   Las recomendaciones tienen fines educativos y no sustituyen
    asesoramiento financiero profesional.
-   Los modelos pueden requerir recalibración y monitoreo ante cambios
    en los datos.
-   Se debe mantener versionado unificado de los modelos de categoría y
    perfil (`v10.0.0`).

## 14. Trazabilidad con los requisitos del Hackathon

  ---------------------------------------------------------------------
  Requisito                          Cobertura en AI-Service
  ---------------------------------- ----------------------------------
  Clasificación automática de gastos `/predict/category` + clasificador
                                     de transacciones

  Análisis del comportamiento        `/analysis` y
  financiero                         `/analysis/users/{usuario_id}`

  Perfil financiero                  Saludable / En observación / En
                                     riesgo

  Indicadores financieros            Financial Score, riesgo, ratios,
                                     categorías principales

  Recomendaciones personalizadas     Diagnóstico, acción, objetivo y
                                     evidencia

  API REST                           FastAPI + OpenAPI + Swagger

  Procesamiento CSV                  `/csv/procesar`

  Asistente inteligente              Finsi: chat y SSE

  Metas financieras                  CRUD, reservas, liberaciones y
                                     resumen

  Pruebas automatizadas              Suite Pytest incluida en el
                                     repositorio

  Containerización                   Dockerfile incluido
  ---------------------------------------------------------------------

## 15. Conclusión

El AI-Service es la capa de inteligencia de FinSightAI: combina Machine
Learning, reglas financieras, validación, procesamiento de datos,
recomendaciones explicables e interfaz conversacional contextual. La
separación modular permite que el Backend consuma capacidades sin
acoplarse a modelos o proveedores LLM.

------------------------------------------------------------------------

**FinSightAI · TwentyNine Devs · G9 Team 29**\
Hackathon ONE - Proyectos G9 · Alura + Oracle + No Country

---

# Parte IV — Data Science

---

# FinSightAI Data Science

**Python · Pandas · Scikit-learn · Machine Learning**\
Pipeline de análisis, entrenamiento y evaluación de modelos financieros

**Hackathon ONE - Proyectos G9**\
G9 Team 29 · TwentyNine Devs\
Alura · Oracle · No Country\
Versión de documentación 1.0.0 · Modelos ML v10.0.0 · Agosto 2026

------------------------------------------------------------------------

## 1. Resumen ejecutivo

El módulo de **Data Science** de FinSightAI constituye la base analítica
y predictiva del MVP. Transforma información financiera y transaccional
en variables estructuradas para clasificar movimientos, caracterizar el
comportamiento económico del usuario y generar artefactos reutilizables
por el AI-Service.

El pipeline cubre generación y validación de datos sintéticos, EDA,
limpieza, ingeniería de atributos, entrenamiento, optimización,
evaluación, validación cruzada, calibración, interpretabilidad,
serialización y pruebas de recarga.

## 2. Generación y validación de datos sintéticos

El generador propio produce **1.000 usuarios** (`USR0001`-`USR1000`) y
**74.532 transacciones**, con actividad comprendida entre el
**27/08/2025 y el 27/08/2026**.

Utiliza semilla `29` para favorecer la reproducibilidad e incorpora
categorías, descripciones, recurrencia, rangos de monto, reglas de
coherencia y controles de integridad.

  -------------------------------------------------------------------------
  Perfil                  Peso        Ingreso    Ratio gasto    Ratio deuda
  sintético                      mensual (\$)                
  ------------- -------------- -------------- -------------- --------------
  Ahorrador                20%    1.800-7.000      0.38-0.58      0.00-0.15

  Equilibrado              35%    1.500-6.500      0.55-0.72      0.04-0.22

  Ajustado                 25%    1.200-5.000      0.68-0.84      0.10-0.30

  Consumista               10%    1.600-7.000      0.78-0.96      0.10-0.32

  Endeudado                10%    1.200-5.200      0.72-0.92      0.32-0.55
  -------------------------------------------------------------------------

> Estos perfiles introducen diversidad sintética; no son las etiquetas
> finales del modelo, que son **Saludable**, **En observación** y **En
> riesgo**.

## 3. Datasets resultantes

  ------------------------------------------------------------------------------------------
  Dataset                                     Registros             Columnas Propósito
  -------------------------------- -------------------- -------------------- ---------------
  `usuarios_sinteticos.csv`                       1.000                   11 Información
                                                                             financiera por
                                                                             usuario

  `transacciones_sinteticas.csv`                 74.532                   11 Historial de
                                                                             movimientos

  `usuarios_features.csv`                         1.000                   27 Variables
                                                                             consolidadas
                                                                             para perfil
                                                                             financiero

  `transacciones_features.csv`                   74.532                   22 Atributos
                                                                             textuales,
                                                                             temporales y
                                                                             monetarios
  ------------------------------------------------------------------------------------------

## 4. Exploración de datos (EDA)

El EDA inspecciona estructura, tipos, nulos, duplicados, distribuciones
e inconsistencias. Se controlan identificadores, fechas, montos,
categorías admitidas e integridad referencial entre usuarios y
transacciones.

  Perfil objetivo     Cantidad   Participación
  ----------------- ---------- ---------------
  En observación           457           45,7%
  En riesgo                276           27,6%
  Saludable                267           26,7%

## 5. Procesamiento e ingeniería de atributos

### Transacciones

-   Normalización de descripción.
-   Variables temporales.
-   Logaritmo del monto.
-   Indicador de transacción grande.
-   Longitud de descripción.
-   Cantidad de palabras.
-   Recurrencia.

### Usuarios

-   Agregaciones de movimientos.
-   Estadísticas de monto.
-   Recurrencia.
-   Diversidad de categorías.
-   Ratios financieros.

## 6. Modelos de Machine Learning

### Clasificador de transacciones

Utiliza principalmente `descripcion_limpia` y combina **TF-IDF de
palabras y caracteres**.

El pipeline emplea `SGDClassifier` con `loss='log_loss'`; la selección
de hiperparámetros se realiza mediante `GridSearchCV` y la validación
cruzada utiliza `StratifiedGroupKFold`, agrupando por descripción
normalizada para reducir fuga de información entre folds.

El modelo final incorpora calibración de probabilidades.

**16 clases:** Alimentación, Compras, Deudas, Educación,
Entretenimiento, Impuestos, Otros, Otros ingresos, Reintegro, Salario,
Salud, Servicios, Transferencia recibida, Transporte, Venta y Vivienda.

### Clasificador complementario de subcategorías

Como segundo nivel de la clasificación transaccional, FinSightAI incorpora un modelo complementario que utiliza la descripción de la transacción y la categoría principal para estimar una subcategoría.

``` text
descripción → categoría → subcategoría
```

El modelo se serializa como `clasificador_subcategoria.joblib` y se consume desde AI-Service junto con `clasificador_gastos.joblib` y `clasificador_perfil.joblib`.

El dataset actual contempla **88 subcategorías**. Su evaluación incluye separación agrupada por usuario y una comprobación adicional sobre descripciones no vistas, con el objetivo de reducir fuga de información y observar generalización fuera de coincidencias exactas.

| Evaluación | Accuracy | F1 macro |
|---|---:|---:|
| Hold-Out agrupado por usuario | 0.9990 | 0.9914 |
| Descripciones no vistas | 0.9847 | 0.9632 |

Como ocurre con el clasificador de categorías, estas métricas deben interpretarse considerando la naturaleza sintética y regular del vocabulario generado.

### Clasificador de perfil financiero

Utiliza diez variables financieras y conductuales: nueve numéricas y
frecuencia de ahorro como variable categórica.

El pipeline aplica imputación, escalado, `OneHotEncoder` y
`LogisticRegression` balanceada para clasificar al usuario en:

-   Saludable
-   En observación
-   En riesgo

## 7. Evaluación y validación

  -----------------------------------------------------------------------------
  Modelo /                Accuracy      Precision   Recall macro       F1 macro
  evaluación                                macro                
  ----------------- -------------- -------------- -------------- --------------
  Transacciones -           1.0000         1.0000         1.0000         1.0000
  Hold-Out                                                       

  Transacciones -           0.9967         0.9858         0.9771         0.9767
  CV agrupada                                                    

  Perfil - Hold-Out         0.8840         0.8888         0.8937         0.8895

  Perfil -                  0.9000         0.8991         0.9121         0.9031
  Validación                                                     
  cruzada                                                        
  -----------------------------------------------------------------------------

El Hold-Out del perfil utiliza una división estratificada de **750
usuarios para entrenamiento y 250 para prueba**.

La Accuracy de entrenamiento es `0.9093` frente a `0.8840` en prueba,
con una brecha de `0.0253`, por lo que el notebook no identifica
overfitting significativo.

El Hold-Out perfecto del clasificador transaccional debe interpretarse
considerando la naturaleza sintética de los datos. La CV agrupada aporta
una comprobación adicional al separar descripciones equivalentes entre
folds, pero la validación definitiva requiere datos reales e
independientes.

## 8. Inferencia, calibración e interpretabilidad

El notebook conecta experimentación e inferencia mediante normalización,
construcción de features, `predict`, `predict_proba`, confianza y
advertencias.

La calibración del clasificador transaccional busca que las
probabilidades reportadas sean más representativas, sin alterar la
separación entre la lógica de entrenamiento y el consumo posterior desde
AI-Service.

  -----------------------------------------------------------------------
  Entrada                 Procesamiento           Salida
  ----------------------- ----------------------- -----------------------
  Descripción de          Normalización +         Categoría, confianza y
  transacción             TF-IDF + clasificador   probabilidades
                          calibrado               

  Datos financieros       Features + clasificador Perfil, probabilidades
                          de perfil               y métricas

  Usuario + historial     Análisis + reglas       Categorías y
                                                  recomendaciones
  -----------------------------------------------------------------------

La interpretabilidad aprovecha los coeficientes de los modelos lineales
para identificar términos y variables con mayor influencia positiva por
categoría o perfil.

## 9. Serialización y artefactos

Los modelos `v10.0.0` se serializan con Joblib dentro de
`artefactos_financeai_v10` y se validan mediante recarga y predicciones
de prueba.

  ------------------------------------------------------------------------
  Artefacto                            Propósito
  ------------------------------------ -----------------------------------
  `FinSightAI_DataScience_1.0.ipynb`   Pipeline integral (notebook
                                       v10.0.0)

  `clasificador_gastos.joblib`         Clasificador calibrado de 16
                                       categorías

  `clasificador_subcategoria.joblib`   Clasificador complementario de 88
                                       subcategorías

`clasificador_perfil.joblib`         Clasificador de perfil financiero

  `metadata_modelos.json`              Versión 10.0.0, features, clases y
                                       contrato

  `metricas_modelos.csv`               Resultados de Hold-Out, CV y
                                       diagnóstico

  `ejemplos_respuesta_backend.json`    Ejemplos estructurados para
                                       integración

  `*_features.csv`                     Datasets procesados
  ------------------------------------------------------------------------

## 10. Integración con AI-Service

  Data Science                  Artefactos              AI-Service
  ----------------------------- ----------------------- ---------------------------
  Generación / EDA / features   CSV procesados          Carga de datos
  Entrenamiento                 Tres modelos `.joblib`  Predicción
  Evaluación                    Métricas + metadata     Versionado / trazabilidad

## 11. Casos de uso de Data Science

  -----------------------------------------------------------------------
  ID                      Caso de uso             Actor / resultado
  ----------------------- ----------------------- -----------------------
  UC-DS01                 Preparar datos          Data Scientist -
                          transaccionales         dataset limpio

  UC-DS02                 Generar atributos       Data Scientist -
                          financieros             variables derivadas

  UC-DS03                 Entrenar clasificador   Data Scientist - modelo
                          transaccional           de categorías

  UC-DS04                 Entrenar clasificador   Data Scientist - modelo
                          de perfil               de perfil

  UC-DS05                 Evaluar, validar y      Data Scientist -
                          calibrar modelos        métricas, CV y
                                                  probabilidades

  UC-DS06                 Serializar modelos      Data Scientist -
                                                  artefactos Joblib v10

  UC-DS07                 Ejecutar inferencia     AI-Service - predicción
                                                  y confianza
  -----------------------------------------------------------------------

## 12. Reproducibilidad y controles

El generador fija semilla `29` y el entrenamiento utiliza
`random_state = 42`.

El pipeline:

-   exporta datasets procesados, métricas y metadata;
-   ejecuta pruebas de recarga de los modelos serializados;
-   conserva la versión de notebook y modelos como `10.0.0`;
-   utiliza agrupamiento por descripción para validar el clasificador
    transaccional;
-   utiliza Hold-Out estratificado y validación cruzada de 5 folds para
    el modelo de perfil.

## 13. Limitaciones y trabajo futuro

-   Los datos sintéticos requieren validación con datos reales e
    independientes.
-   El vocabulario deberá ampliarse para descripciones bancarias reales.
-   Los patrones sintéticos regulares pueden elevar algunas métricas.
-   Score y recomendaciones no constituyen calificación crediticia ni
    asesoramiento profesional.
-   Los modelos pueden reproducir sesgos.
-   Producción requiere monitoreo, recalibración, detección de drift y
    protección de datos.

### Trabajo futuro

Datos reales anonimizados, vocabulario ampliado, monitoreo, detección de
deriva, evaluación continua de calibración y revisión con especialistas.

## 14. Trazabilidad con los requisitos del Hackathon

  -----------------------------------------------------------------------
  Requisito                           Cobertura Data Science
  ----------------------------------- -----------------------------------
  EDA                                 Exploración, calidad y
                                      distribuciones

  Limpieza y validación               Controles estructurales e
                                      integridad referencial

  Ingeniería de atributos             Variables textuales, temporales,
                                      monetarias y agregadas

  Clasificación de movimientos        Clasificador calibrado de 16
                                      categorías + clasificación de
                                      subcategorías

  Perfil financiero                   Saludable / En observación / En
                                      riesgo

  Evaluación / validación             Accuracy, Precision, Recall, F1,
                                      Hold-Out y CV

  Calibración                         Probabilidades del clasificador
                                      transaccional

  Serialización                       Joblib v10.0.0 + metadata +
                                      métricas

  Integración                         Artefactos consumidos por
                                      AI-Service
  -----------------------------------------------------------------------

## 15. Conclusión

FinSightAI Data Science implementa un pipeline integral alineado con el
MVP: generación y validación de datos, EDA, ingeniería de atributos,
clasificación de transacciones por categoría y subcategoría, análisis de perfil, optimización,
evaluación, calibración, serialización e inferencia.

La versión `10.0.0` mantiene **1.000 usuarios y 74.532 transacciones**,
actualiza la distribución de perfiles y mejora las métricas del
clasificador de perfil. Los resultados demuestran la viabilidad técnica
del enfoque, documentando a la vez las limitaciones del uso de datos
sintéticos y la necesidad de validación real, monitoreo y control de
sesgos.

------------------------------------------------------------------------

**FinSightAI · TwentyNine Devs · G9 Team 29**\
Hackathon ONE - Proyectos G9 · Alura + Oracle + No Country

---

*FinSightAI — Documentación Técnica Completa · G9 FinanceAI Team 29 · Frontend + Backend + AI-Service + Data Science · Hackathon ONE - Proyectos G9 · Alura + Oracle + No Country*
