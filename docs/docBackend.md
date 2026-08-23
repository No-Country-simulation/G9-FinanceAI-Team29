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
|--------------------|------------------------------------------|--------------------------------------------------------------------|
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
|--------------------|-------------------|----------------------------------------------------|---------------------|
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
|-----------------------------------------|-----------------------------------------------------|
| `STORAGE_S3_ENDPOINT`                   | Endpoint S3-compatible de OCI (o de MinIO en local) |
| `STORAGE_S3_REGION`                     | Región de la tenencia                               |
| `STORAGE_S3_ACCESS_KEY` / `_SECRET_KEY` | Customer Secret Keys (credenciales S3 de OCI)       |
| `STORAGE_AVATARS_BUCKET`                | Nombre del bucket de avatares (`finsight-avatars`)  |
| `STORAGE_AVATARS_PUBLIC_URL`            | Base pública desde donde se sirven las imágenes     |

### Servidor y despliegue (OCI Compute)

Además del Object Storage, la aplicación se **aloja en OCI Compute**: una máquina virtual de Oracle Cloud donde corre todo el stack con **Docker Compose**.

| Componente        | Detalle                                                                                                                             |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------|
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
|----------------------------------------|----------------|---------------------------------------------------------------|
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
|--------|----------------------|---------|------------------------------------------------------|
| POST   | `/register`          | Público | Crea la cuenta; devuelve usuarioId y email           |
| POST   | `/login`             | Público | Valida credenciales; devuelve el JWT                 |
| POST   | `/forgot-password`   | Público | Envía email con enlace de reset (respuesta genérica) |
| POST   | `/reset-password`    | Público | Fija la nueva contraseña con el token del email      |
| POST   | `/change-password`   | 🔒      | Cambia la contraseña del usuario autenticado         |

### Usuarios y perfil — `/api/usuarios`

| Método | Ruta                    | Acceso  | Descripción                                                    |
|------- |-------------------------|----------|---------------------------------------------------------------|
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
|--------|------------|---------|--------------------------------|
| GET    | `/`        | 🔒👤🔗 | Lista de transacciones         |
| GET    | `/pagina`  | 🔒👤🔗 | Lista paginada (PagedResponse) |
| GET    | `/resumen` | 🔒👤🔗 | Resumen agregado por categoría |

### Metas de ahorro — `/api/usuarios/{usuarioId}/metas`

| Método | Ruta                     | Acceso | Descripción                                 |
|--------|--------------------------|--------|---------------------------------------------|
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
|--------|------------------------|--------|-------------------------------------------|
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
|--------|------------------------------------|-----------|--------------------------------------------------------|
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
|--------|--------------------------------------|------|----------------------------------------------------------------------------------------------------------------------|
| POST   | `/analisis-financiero`               | 🔒🔗 | Perfil financiero + resumen por categoría + recomendaciones. Acepta el cuerpo en **snake_case** (`ingreso_mensual`…) o camelCase. |
| GET    | `/clasificar`                        | 🔒🔗 | Clasifica una descripción (ML, con fallback a reglas)                                                               |
| POST   | `/usuarios/{usuarioId}/importar-csv` | 🔒👤 | Importa transacciones desde un CSV (multipart)                                                                       |
| POST   | `/enviar-recordatorios`              | 🔒🔗 | Dispara el envío de recordatorios (lo llama el cron)                                                                 |

---

## 6. Modelo de datos

Entidades JPA sobre PostgreSQL. Todas las de dominio cuelgan de `Usuario` (relación por `usuario`). Se muestran los campos principales de cada entidad.

| Entidad (tabla)                                  |                                              Campos principales                                                        |
|--------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
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
|---------------------------|--------------------------------------------------------------------------------------|
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
|------------------------------|-------------------------------------------------------|-----------------------------------------------|
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
|-----------------------------------|--------------------------------------------------------------------|---------|
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
|---------------------------|---------------------------------|
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
