# FinSightAI — Documentación de cambios (sesión 24-jul-2026)

> Documento único que explica **todo lo que se integró y arregló** en esta sesión:
> consolidación del proyecto, integración del **AI-Service** (agente LLM), conexión del
> **frontend** a datos reales, **autenticación con Supabase Auth** y los bugs corregidos
> en **backend** y **frontend**.
>

---

## 1. Resumen ejecutivo

Al inicio de la sesión el frontend "no mostraba datos" y no había integración de IA ni login.
Al final, la app funciona de punta a punta:

- ✅ **Frontend conectado a datos reales** de Supabase (vía el backend).
- ✅ **AI-Service (agente LLM con Groq)** integrado y respondiendo con datos del usuario.
- ✅ **Login real con Supabase Auth** + mapeo de cada cuenta demo a su perfil de datos.
- ✅ **Admin** puede cambiar entre todos los perfiles con un selector.
- ✅ Varios **bugs de mayúsculas** (`GASTO`/`Gasto`) corregidos en backend y frontend.

**Servicios (todos levantados y verificados):**

| Servicio | Puerto | Swagger / URL |
|---|---|---|
| Backend (Spring Boot, Java 21) | 8081 | `http://localhost:8081/swagger-ui/index.html` |
| AI-Service (FastAPI, Python 3.13) | 8000 | `http://127.0.0.1:8000/docs` |
| Frontend (Vite + React + TS) | 5173 | `http://localhost:5173` |
| Base de datos | — | Supabase (Postgres 17.6) |

---

## 2. Consolidación del proyecto

Estructura final del proyecto 

```text
G9-FinanceAI-Team29/
├── Backend/backend/     # Spring Boot (Java 21)  → :8081
├── AI-Service/          # FastAPI (Python 3.13)  → :8000   
├── DataScience/         # notebooks + ml-service viejo
└── frontend/            # Vite + React + TS      → :5173
```

---

## 3. AI-Service (microservicio de IA) — INTEGRADO

Es **autónomo**: lee los datos del usuario de CSVs locales (`data/processed/*.csv`) y modelos
`.joblib` (`models/`, clasificador v9.0.0). **No necesita Supabase** para funcionar.

Reemplaza y amplía al `ml-service` viejo (mismos endpoints de ML **+** un agente LLM).

### Endpoints (`http://127.0.0.1:8000`)

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/health` | Estado del servicio |
| POST | `/predict/category` | Clasificación de una transacción |
| POST | `/analysis` | Análisis financiero completo |
| GET | `/analysis/users/{usuario_id}` | Análisis de un usuario del dataset |
| POST | `/agent/chat` | **Agente LLM** — body `{usuario_id, question}` → `{answer, provider}` |

### Puesta en marcha (ya hecha)

- Se creó `.venv` con **Python 3.13** (única versión instalada; el README pedía 3.12 pero 3.13
  instala e importa OK: faiss-cpu 1.14.3, groq 1.5.0, scikit-learn 1.6.1, pandas 2.2.3).
- Config vía `AI-Service/.env` (pydantic-settings):
  - `LLM_PROVIDER=groq`, `GROQ_API_KEY=...`, `GROQ_MODEL=llama-3.3-70b-versatile`
  - Alternativa Gemini (`GEMINI_API_KEY`, `GEMINI_MODEL=gemini-2.5-flash`).
  - Hay **fallback automático** groq → gemini si el proveedor primario falla.

**Arrancar:**
```powershell
cd AI-Service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Verificado en vivo:** `/health` = ok, `/analysis/users/USR0001` devuelve análisis real, y
`/agent/chat` responde con `provider: "groq"` una recomendación personalizada según los datos
del usuario.

---

## 4. Backend (Spring Boot) — CAMBIOS

Puerto **8081**. Conectado a **Supabase** (datasource hardcodeado en `application.yml`, pooler
transaction `:6543`). ML habilitado apuntando a `http://127.0.0.1:8000`. CORS abierto para
`:5173` y `:3000` (`config/WebConfig.java`).

### Bug corregido — `/transacciones/resumen` daba totales en 0

- **Archivo:** `Backend/backend/src/main/java/com/financeai/controller/TransaccionController.java`
- **Causa:** filtraba `"Gasto".equals(t.getTipo())` / `"Ingreso"` (capitalizado), pero Supabase
  guarda el tipo en **MAYÚSCULAS** (`"GASTO"`/`"INGRESO"`) → totales 0 y `porCategoria` vacío.
- **Fix:** `"GASTO".equalsIgnoreCase(t.getTipo())` y `"INGRESO".equalsIgnoreCase(...)` (literal
  como receptor para evitar NPE), en las 3 comparaciones.
- **Verificado:** USR0001 → totalGastos 34.228,32 · totalIngresos 39.933,50 · `porCategoria` completo.

---

## 5. Frontend (Vite + React + TS) — CAMBIOS

### 5.1. Conexión de datos (el "no mostraba datos")

- **Causa raíz:** no existía `frontend/.env` (solo `.env.example`) → `services/api.ts` caía al
  fallback `http://localhost:8080/api`, pero el backend está en **8081**. Todas las llamadas fallaban.
- **Fix:** se creó `frontend/.env` con `VITE_API_URL=http://localhost:8081/api` y se corrigió el
  fallback de `api.ts` a 8081.

### 5.2. Normalización de `tipo` (mayúsculas) — fix DRY

Varios componentes esperaban `"Gasto"`/`"Ingreso"` (Title Case) pero la BD manda mayúsculas.
En vez de parchear cada archivo, se normaliza **en la frontera de datos**:

- **Archivo:** `services/api.ts` → `obtenerTransacciones` mapea cada `tipo` con `normalizarTipo`
  (`GASTO→Gasto`, `INGRESO→Ingreso`). Así funcionan sin tocarse: `MonthlyExpensesChart`,
  `MonthlyStatsCard`, `RecentTransactions`, `Finance/Transacciones`.

### 5.3. Bug 400 en `POST /analisis-financiero`

- **Causa:** `utils/construirAnalisisRequest.ts` filtraba `t.tipo === 'Gasto'` → lista de
  transacciones vacía → el DTO backend (`AnalisisRequest`) tiene `@NotEmpty` → **400**.
- **Fix:** filtro case-insensitive `t.tipo?.toUpperCase() === 'GASTO'`.
- **Verificado:** el endpoint responde **200** con perfil + score + recomendaciones.

### 5.4. Asistente IA — cableado al AI-Service (antes era mock)

- **`services/api.ts`:** nueva función `preguntarAgente(question, usuarioId)` → `POST` a
  `VITE_AI_URL/agent/chat`.
- **`pages/Ai/AsistenteIA.tsx`:** se quitó el `respuestaDemo` (mock). Ahora llama al agente real,
  con indicador "Escribiendo…" y manejo de error.

---

## 6. Autenticación (Supabase Auth) — NUEVO

Antes el `usuarioId` estaba **fijo** en `VITE_USER_ID`, por eso siempre se veía USR0001.
Ahora hay login real y cada cuenta ve **sus** datos.

### Archivos nuevos

| Archivo | Rol |
|---|---|
| `services/supabase.ts` | Cliente Supabase (usa `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`) |
| `context/AuthContext.tsx` | Sesión, mapeo **email→USR**, detección admin, `usuarioId` activo, `useAuth()` |
| `components/auth/ProtectedRoute.tsx` | Redirige a `/signin` si no hay sesión |
| `components/header/AccountSwitcher.tsx` | Email + selector de perfiles (solo admin) + botón **Salir** |

### Archivos modificados

- `components/auth/SignInForm.tsx` → login real con `signInWithPassword` (+ errores traducidos).
- `App.tsx` → `AuthProvider` dentro de `<Router>` y `AppLayout` envuelto en `ProtectedRoute`.
- `layout/AppHeader.tsx` → monta el `AccountSwitcher`.
- `Home` / `Transacciones` / `Recomendaciones` / `AsistenteIA` → usan `useAuth().usuarioId`
  (en lugar del env) y lo incluyen en las dependencias del `useEffect` para **refrescar al
  cambiar de perfil**.

### Mapeo de cuentas demo → datos (en `AuthContext.tsx`)

| Cuenta (Supabase Auth) | → Usuario de datos | Perfil |
|---|---|---|
| `demo.critico@finsight.com` | USR0001 | En riesgo |
| `demo.intermedio@finsight.com` | USR0002 | En observación |
| `demo.saludable@finsight.com` | USR0009 | Saludable |
| `demo.admin@finsight.com` | **admin** → selector entre los 3 | — |

> El mapeo es **por email** (no por uid), así que se pueden borrar/recrear las cuentas sin romper nada.

### Cómo funciona

1. Sin sesión → cualquier ruta privada redirige a `/signin`.
2. Login → Supabase valida email+password → se guarda la sesión.
3. `AuthContext` traduce el email al `USRxxxx` y todas las páginas consumen ese id.
4. Si el email es admin, aparece un `<select>` en la cabecera para cambiar de perfil; el dashboard
   se actualiza solo.
5. Botón **Salir** cierra sesión y vuelve al login.

---

## 7. Configuración (.env) y seguridad

### `frontend/.env`
```env
VITE_API_URL=http://localhost:8081/api
VITE_USER_ID=USR0001            # fallback si no hay sesión
VITE_AI_URL=http://localhost:8000
VITE_SUPABASE_URL=https://wfypvyfhpworindwllsz.supabase.co
VITE_SUPABASE_ANON_KEY=...      # anon key (pública, segura en el front)
```

### `AI-Service/.env`
```env
LLM_PROVIDER=groq
GROQ_API_KEY=...                # secreta — NO subir a git
GROQ_MODEL=llama-3.3-70b-versatile
GEMINI_API_KEY=...              # secreta — NO subir a git
```

### Seguridad
- Se creó **`AI-Service/.gitignore`** (ignora `.env`, `.venv`, `__pycache__`, `storage/`).
  Sin él, `git add AI-Service/` habría subido las **API keys reales** a GitHub.
- El `frontend/.env` ya lo cubre el `.gitignore` del frontend.
- La **anon key** de Supabase es pública (segura en el front). La **GROQ/GEMINI key** son
  secretas → rotar al terminar el hackathon.
- ⚠️ La contraseña de Supabase está en **texto plano** en `application.yml` del backend → rotar
  al final y pasar a variables de entorno.

---

## 8. Bugs corregidos (resumen)

| # | Dónde | Síntoma | Causa | Fix |
|---|---|---|---|---|
| 1 | Frontend | No mostraba datos | Sin `.env` → puerto 8080 ≠ 8081 | Crear `.env` con 8081 |
| 2 | Backend | `/resumen` totales 0 | `"Gasto"` vs `"GASTO"` | `equalsIgnoreCase` |
| 3 | Frontend | 400 en `/analisis-financiero` | filtro `=== 'Gasto'` → lista vacía | filtro case-insensitive |
| 4 | Frontend | Tablas/gráficos vacíos | `tipo === 'Gasto'` en 4 componentes | normalizar `tipo` en `api.ts` |
| 5 | Frontend | Asistente IA no respondía | página en modo mock | cablear a `/agent/chat` |
| 6 | Frontend | Siempre USR0001 | `usuarioId` fijo en env | login Supabase + mapeo email→USR |
| 7 | Front/Back | Análisis daba 400 con el formulario | `frecuenciaAhorro:'Mensual'` + `<select>` inválido + `valor` negativos | opciones = enum real + datos reales (gastos positivos) |
| 8 | AI-Service | "mi estado" respondía genérico | el intent no reconocía "estado" | agregar términos a `FULL_ANALYSIS` |

---

## 9. Cómo levantar (o relanzar) los 3 servicios

Desde la raíz `G9-FinanceAI-Team29/`, cada servicio en su propia terminal.
Orden recomendado: Backend y AI-Service primero, frontend al final.

```powershell
# 1) Backend — Spring Boot (:8081). Supabase ya está en application.yml
cd "Backend\backend"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21.0.10"
mvn spring-boot:run
#   Si no hay Maven instalado, usar el portable:
#   & "$HOME\tools\apache-maven-3.9.9\bin\mvn.cmd" spring-boot:run

# 2) AI-Service — FastAPI (:8000)
cd "AI-Service"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
#   Agregar --reload solo si vas a editar el código (ojo: a veces deja
#   procesos colgados en el puerto, ver nota abajo).

# 3) Frontend — Vite (:5173)
cd "frontend"
npm run dev
```

Luego abrir `http://localhost:5173`, iniciar sesión con una cuenta demo y navegar.

> **Si el puerto 8000 queda ocupado** (un uvicorn viejo que no cerró bien),
> liberarlo antes de relanzar:
> ```powershell
> Get-NetTCPConnection -LocalPort 8000 -State Listen | Select-Object OwningProcess
> Stop-Process -Id <PID> -Force
> ```

---

## 10. Continuación — Análisis por cuenta y agente

Bloque de cambios hecho después de tener la app funcionando, para pulir el
flujo de análisis y el asistente.

### 10.1. Página "Análisis" — usa los datos reales de cada cuenta

Antes el formulario arrancaba con valores de ejemplo escritos a mano (5000 / 25 /
transacciones inventadas), iguales para todos, y encima esos datos rompían el backend.

- **Archivo:** `pages/Finance/Analisis.tsx`
- Se quitaron los datos de ejemplo. Al entrar se pide el perfil y las transacciones
  reales del usuario activo (`obtenerUsuario` + `obtenerTransacciones`) y se arma el
  request con `construirAnalisisRequest`.
- El formulario parte en "Cargando tus datos…" y solo se muestra con datos reales;
  si el backend falla, avisa en vez de rellenar con valores falsos.
- Al cambiar de cuenta en el selector se recarga con el perfil correspondiente
  (`usuarioId` en las dependencias del `useEffect`).
- Se pasa el `usuarioId` real al analizar (`analizarFinanzas(formData, usuarioId)`);
  antes caía al fallback USR0001.
- **Verificado:** USR0001 (En riesgo · 3229.87 · 72 tx), USR0002 (En observación ·
  1626.20 · 73 tx), USR0009 (Saludable · 2712.00 · 75 tx) — cada cuenta con lo suyo.

### 10.2. Bug 400 en el formulario de Análisis (otra causa, distinta de la 5.3)

El form tenía defaults que no pasaban la validación del DTO:

- `frecuenciaAhorro: 'Mensual'` — el backend valida `@Pattern(^(Alta|Media|Baja|Nunca)$)`.
- El `<select>` ofrecía `Diaria/Semanal/Mensual/Nunca`, opciones que no existen en el backend.
- Transacciones con `valor` negativo — `TransaccionDTO` exige `@DecimalMin(0.01)` y el
  backend suma cada transacción como gasto.
- **Fix:** opciones del `<select>` = enum real, y al pasar a datos reales las
  transacciones ya salen como gastos positivos.

### 10.3. Asistente IA — conversación mucho más fluida

- **Archivo:** `AI-Service/app/services/agent/intent.py`
- **Problema:** frases naturales ("decime como estoy", "cuanto estoy gastando",
  "cuanto debo", "que me conviene mejorar") caían en `UNKNOWN` → respuesta genérica
  sin usar los datos del usuario.
- **Fix:** se reemplazó `intent.py` por la versión mejorada de **AI-Service2**, que
  trae mucho más vocabulario por intención y **patrones regex** (`_FULL_ANALYSIS_PATTERNS`)
  para entender variantes que no coinciden palabra por palabra. El `_contains_any` ahora
  usa límites de palabra (evita falsos positivos tipo "estados unidos").
- **Nota de despliegue:** el `--reload` de uvicorn no tomó el archivo nuevo (quedó un
  proceso viejo sirviendo el código anterior); hubo que matar el proceso del puerto 8000
  y relanzar limpio.
- **Verificado:** "decime como estoy", "como ando con mis finanzas", "cuanto estoy
  gastando", "cuanto debo", "que me conviene mejorar" y "cual es mi puntaje" ahora
  responden con los datos reales del usuario vía Groq; "hola" sigue siendo saludo.

### 10.4. Limpieza menor de comentarios (frontend)

Un par de comentarios reescritos para que se lean más naturales (`api.ts`,
`construirAnalisisRequest.ts`). Sin cambios de lógica. No se tocaron comentarios de
AI-Service ni de DataScience.

---

## 11. Pendientes

- [ ] `POST /analisis-financiero` cae a `motorAnalisis: "reglas"` en vez de `"ML"` — revisar por
      qué el backend no usa el AI-Service en ese path (posible contrato distinto).
- [ ] Reentrenar el clasificador de gastos (baja confianza en algunas descripciones).
- [ ] OCI Object Storage (requisito obligatorio del hackathon) — hoy desactivado.
- [ ] Rotar la contraseña de Supabase del backend (texto plano) y pasar a env vars.
- [ ] Rotar las API keys (Groq/Gemini) al finalizar.
- [ ] Endpoints de Presupuestos y Metas (no existen).

---

_Última actualización: 24-jul-2026 (incluye continuación: análisis por cuenta y agente)._
