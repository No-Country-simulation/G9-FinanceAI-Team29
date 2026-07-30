# G9-FinanceAI-Team
<p align="center">
  <img src="logo.png" alt="FinSightAI" width="750">
</p>

<p align="center">
  <strong>Proyecto desarrollado para el Hackathon Oracle Next Education (ONE) y No Country</strong><br>
  Equipo: <strong>TwentyNine Devs</strong>
</p>

---

# 📖 Descripción

**FinSightAI** es una plataforma web que ayuda a los usuarios a comprender su situación financiera mediante técnicas de Ciencia de Datos, Machine Learning e Inteligencia Artificial.

A partir de los ingresos, deudas, hábitos de ahorro y transacciones financieras, la plataforma analiza el comportamiento económico del usuario, clasifica automáticamente sus gastos, identifica patrones de consumo y genera recomendaciones personalizadas para favorecer una mejor toma de decisiones.

---

# 🎯 Problema

Muchas personas registran sus ingresos y gastos, pero les resulta difícil transformar esos datos en información útil para comprender su situación financiera y mejorar su planificación económica.

**FinSightAI** busca convertir los datos financieros en información clara, explicable y accionable mediante modelos de Machine Learning e indicadores financieros fáciles de interpretar.

---

# 🚀 Funcionalidades

- Clasificación automática de categorías de gastos.
- Análisis del perfil financiero.
- Financial Score personalizado.
- Evaluación del nivel de riesgo financiero.
- Explicación automática del análisis realizado.
- Fortalezas y oportunidades de mejora.
- Recomendaciones financieras personalizadas.
- Dashboard interactivo.
- Historial de análisis.
- API REST para integración con aplicaciones externas.

---

# 🛠 Tecnologías utilizadas

## Frontend

- React
- TypeScript
- TailwindCSS
- Axios

## Backend

- Java 21
- Spring Boot
- Spring Validation
- SpringDoc OpenAPI (Swagger)

## Ciencia de Datos

- Python
- Pandas
- NumPy
- Scikit-Learn
- Joblib
- FastAPI

## Base de datos y autenticación

- Supabase

## Cloud y despliegue

- Render (Backend + AI-Service, contenedores Docker)
- Vercel (Frontend)
- Oracle Cloud Infrastructure (OCI)

> 📘 Guía completa de despliegue (Docker, Render Blueprint y Vercel) en
> [`DEPLOY.md`](./DEPLOY.md).

## DevOps

- Git
- GitHub
- GitHub Projects
- Docker (Backend y AI-Service contenerizados)
- Render Blueprint (`render.yaml`)

---

# 🏗 Arquitectura

```text
                  Usuario
                     │
                     ▼
          Frontend (React + TypeScript)
                     │
                     ▼
         Backend (Spring Boot API)
                     │
         POST /analysis
                     │
                     ▼
       Microservicio IA (FastAPI)
             │               │
             ▼               ▼
     Modelos ML (.joblib)   Supabase
                               │
                               ▼
                      Datos y autenticación
```

---

# 📂 Estructura del proyecto

```text
Backend/
  backend/            # Spring Boot API (pom.xml, Dockerfile, src/)
AI-Service/           # Microservicio FastAPI + agente LLM (Dockerfile)
  app/  models/  data/
frontend/             # React + Vite (se despliega en Vercel)
DataScience/          # Notebooks de EDA/entrenamiento y ml-service legacy
render.yaml           # Blueprint de Render (Backend + AI-Service)
DEPLOY.md             # Guía de despliegue (Docker / Render / Vercel)
```

---

# 📊 Flujo de funcionamiento

```text
Inicio de sesión

↓

Registro de información financiera

↓

Clasificación automática de gastos

↓

Análisis del perfil financiero

↓

Generación de Score y recomendaciones

↓

Visualización de resultados en el Dashboard
```

---

# 🤖 Ciencia de Datos

El módulo de Ciencia de Datos implementa un pipeline completo que incluye:

- Generación de datasets sintéticos.
- Análisis Exploratorio de Datos (EDA).
- Limpieza y preprocesamiento.
- Ingeniería de atributos.
- Entrenamiento de modelos de Machine Learning.
- Validación cruzada y evaluación.
- Interpretabilidad de modelos.
- Serialización mediante Joblib.
- Exposición mediante un microservicio desarrollado con FastAPI.

---

# 🔌 API

El microservicio de Machine Learning expone los siguientes endpoints:

| Método | Endpoint | Descripción |
|---------|----------|-------------|
| GET | `/health` | Estado del servicio |
| POST | `/predict/category` | Clasificación automática de gastos |
| POST | `/analysis` | Análisis financiero completo |
| GET | `/analysis/users/{usuario_id}` | Endpoint de prueba para datasets sintéticos |

---

# 📅 Estado del proyecto

- ✅ Diseño de arquitectura.
- ✅ Generación del dataset sintético.
- ✅ Análisis Exploratorio de Datos (EDA).
- ✅ Entrenamiento de modelos de Machine Learning.
- ✅ Desarrollo del microservicio FastAPI.
- ✅ Integración con Spring Boot.
- ✅ Desarrollo del Frontend.
- ✅ Integración con Supabase.
- ✅ Agente conversacional (LLM) integrado en el AI-Service.
- ✅ Contenerización con Docker (Backend + AI-Service).
- ✅ Blueprint de Render (`render.yaml`) y guía de despliegue (`DEPLOY.md`).
- 🔄 Despliegue en Render (Backend + AI-Service) y Vercel (Frontend).
- ⬜ Despliegue en Oracle Cloud Infrastructure (OCI).
- ⬜ Presentación final del proyecto.

---
# 👥 Equipo

<p align="center">
  <img src="logo_team.png" alt="TwentyNine Devs" width="500">
</p>

<h3 align="center">G9 LATAM Team 29</h3>

<p align="center">
Equipo multidisciplinario participante del Hackathon <strong>Oracle Next Education (ONE)</strong> y <strong>No Country</strong>.
</p>

<p align="center">
Desarrollo de Frontend, Backend, Ciencia de Datos, Machine Learning, UX/UI y Gestión Ágil.
</p>

# 📸 Capturas

Se incorporarán capturas del dashboard, la API y el flujo completo de la aplicación durante el desarrollo del proyecto.

---

# 📄 Licencia

Proyecto desarrollado con fines educativos para el **Hackathon Oracle Next Education (ONE)** organizado por **Alura Latam**, **Oracle** y **No Country**.

Su propósito es demostrar la integración de tecnologías de desarrollo web, Ciencia de Datos, Machine Learning e Inteligencia Artificial para resolver un problema real relacionado con la educación financiera.
# G9-FinanceAI-Team29
