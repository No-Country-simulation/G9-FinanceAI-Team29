# 🚀 Guía de Despliegue — FinanceAI (Team29)

Documentación de la infraestructura de despliegue: **Docker** para los servicios de
backend, **Render** para el Backend + AI-Service, **Vercel** para el Frontend y
**Supabase** como base de datos y autenticación.

---

## 🗺️ Dónde vive cada servicio

| Servicio | Stack | Se despliega en | Root del repo |
|---|---|---|---|
| **Frontend** | React + Vite + TS | **Vercel** | `frontend/` |
| **Backend** | Spring Boot / Java 21 | **Render** (Docker) | `Backend/backend/` |
| **AI-Service** | FastAPI / Python 3.12 | **Render** (Docker) | `AI-Service/` |
| **Base de datos + Auth** | PostgreSQL | **Supabase** | — |

> El microservicio legacy `DataScience/FinSight-ml-service` **no se despliega**: el
> `AI-Service` es su superset (clasificación + análisis + agente LLM).

---

## 🐳 Dockerización

Se contenerizaron **Backend** y **AI-Service**. El Frontend no se dockeriza (build
estático en Vercel).

### AI-Service — `AI-Service/Dockerfile`
- Base `python:3.12-slim`.
- Instala `requirements.txt`, copia `app/`, `models/`, `data/`, `storage/`.
- Escucha en el puerto dinámico del host: `uvicorn ... --port ${PORT:-8000}`.
- `.dockerignore` excluye `.env` y `.venv` → **las API keys nunca entran a la imagen**.

### Backend — `Backend/backend/Dockerfile`
- **Multi-stage**: build con `maven:3.9-eclipse-temurin-21`, runtime con
  `eclipse-temurin:21-jre` (imagen final liviana, solo el fat-jar).
- JVM consciente del contenedor: `-XX:MaxRAMPercentage=75`.
- El puerto lo toma de `${PORT:8081}` (ver `application.yml`).

### Probar las imágenes localmente

```bash
# Build
docker build -t finance-ai-service ./AI-Service
docker build -t finance-backend    ./Backend/backend

# Run (puertos de ejemplo para no chocar con el entorno local)
docker run --rm -e PORT=8010 --env-file ./AI-Service/.env -p 8010:8010 finance-ai-service
docker run --rm -e PORT=8080 -p 8091:8080 finance-backend

# Verificar
curl http://localhost:8010/health                       # AI-Service
curl http://localhost:8091/api/usuarios/USR0001          # Backend -> Supabase
```

> Verificado: el AI-Service levanta con ML+Groq+Gemini `configured` y el agente
> responde vía Groq; el Backend conecta a Supabase (Database version 17.6).

---

## ⚙️ Variables de entorno

Los `.env` **no** se versionan (están en `.gitignore`). Cada plataforma inyecta sus
valores. La app arranca con defaults locales, pero en producción se sobreescriben.

### AI-Service (Render)
| Variable | Ejemplo / valor | Nota |
|---|---|---|
| `LLM_PROVIDER` | `groq` | proveedor por defecto |
| `GROQ_API_KEY` | *(secret)* | **obligatoria** para el agente |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | |
| `GEMINI_API_KEY` | *(secret)* | fallback del agente |
| `GEMINI_MODEL` | `gemini-2.5-flash` | |
| `ALLOWED_ORIGINS` | `https://<tu-app>.vercel.app` | CORS del frontend |

### Backend (Render)
| Variable | Ejemplo / valor | Nota |
|---|---|---|
| `PORT` | *(lo asigna Render)* | ya soportado en `application.yml` |
| `ML_SERVICE_URL` | `https://finance-ai-service.onrender.com` | URL pública del AI-Service |
| `DB_PASS` | *(secret)* | password de Supabase |
| `DB_URL` / `DB_USER` | *(opcional)* | tienen default en `application.yml` |

### Frontend (Vercel)
| Variable | Ejemplo / valor |
|---|---|
| `VITE_API_URL` | `https://finance-backend.onrender.com/api` |
| `VITE_AI_URL` | `https://finance-ai-service.onrender.com` |
| `VITE_SUPABASE_URL` | `https://wfypvyfhpworindwllsz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(anon pública)* |

> ⚠️ Las `VITE_*` se "hornean" en el build → si cambian, hay que **rebuild** en Vercel.

---

## 🅰️ Render — despliegue con Blueprint

El repo incluye `render.yaml` en la raíz, que crea **los dos servicios de golpe**.

1. Render → **New → Blueprint** → conectar este repo → rama **`frontend`**.
2. Render lee `render.yaml` y pide los valores `sync: false` (las keys y URLs).
3. Esperar a que despliegue **finance-ai-service** y copiar su **URL pública**.
4. Pegar esa URL en `ML_SERVICE_URL` del **finance-backend** (y en `VITE_AI_URL` de Vercel).
5. Cuando exista la URL de Vercel, pegarla en `ALLOWED_ORIGINS` del AI-Service.

> Plan `free`: los servicios "duermen" tras inactividad; el primer request tras el
> reposo puede tardar ~30–60 s.

---

## ▲ Vercel — despliegue del Frontend

1. Vercel → **New Project** → importar el repo → **Root Directory: `frontend`**.
2. Framework: **Vite** (autodetectado). Build: `npm run build` → salida `dist/`.
3. Production Branch: **`frontend`**.
4. Cargar las variables `VITE_*` (tabla de arriba) → **Deploy**.

---

## 🔒 Notas de seguridad

- Las API keys (Groq/Gemini) y `DB_PASS` van **solo** como env vars/secrets en la
  plataforma, nunca en el repo. Los `.env` están en `.gitignore`.
- `application.yml` conserva un **default de `DB_PASS`** para poder correr en local
  sin configurar nada. **Antes de hacer público el repo**, quitá ese default y dejá
  la variable como obligatoria por entorno.
- La `VITE_SUPABASE_ANON_KEY` es pública por diseño (clave anónima de Supabase).
- Rotar las keys al finalizar el hackathon.
