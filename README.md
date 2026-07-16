# G9-FinanceAI-Team29
# 💰 FinanceAI

> Plataforma inteligente para el análisis de salud financiera desarrollada durante el Hackathon Oracle Next Education (ONE).

---

# 📖 Descripción

FinanceAI es una plataforma web que analiza el comportamiento financiero de los usuarios a partir de sus ingresos, nivel de endeudamiento, hábitos de ahorro y transacciones financieras.

Mediante técnicas de Ciencia de Datos e Inteligencia Artificial, la aplicación clasifica automáticamente los gastos, identifica patrones de consumo, evalúa el perfil financiero del usuario y genera recomendaciones personalizadas para mejorar su salud financiera.

---

# 🎯 Problema

Muchas personas tienen acceso a la información de sus ingresos y gastos, pero les resulta difícil transformar esos datos en información útil para tomar mejores decisiones financieras.

FinanceAI busca convertir esos datos en información clara, comprensible y accionable, ayudando a los usuarios a entender mejor sus hábitos de consumo y mejorar su planificación financiera.

---

# 🚀 Funcionalidades

- Clasificación automática de transacciones.
- Análisis del perfil financiero.
- Resumen de gastos por categoría.
- Identificación de patrones de consumo.
- Recomendaciones financieras personalizadas.
- Dashboard interactivo.
- Inicio de sesión mediante autenticación.
- Historial de análisis financieros.
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
- Scikit-Learn
- Joblib

## Base de datos y autenticación

- Supabase

## Cloud y despliegue

- Vercel
- Oracle Cloud Infrastructure (OCI)

## DevOps

- Git
- GitHub
- GitHub Projects
- Docker

---

# 🏗 Arquitectura

```text
                  Usuario
                     │
                     ▼
          Frontend (React + TS)
                     │
                     ▼
         Backend (Spring Boot API)
               │              │
               ▼              ▼
     Modelo IA (Python)   Supabase
                         (Datos y Auth)
               │
               ▼
 Oracle Cloud Infrastructure (OCI)
```

---

# 📂 Estructura del proyecto

```text
backend/
frontend/
ml/
datasets/
notebooks/
docs/
```

---

# 📊 Flujo de funcionamiento

```text
Inicio de sesión

↓

Carga de información financiera

↓

Clasificación automática de transacciones

↓

Análisis del perfil financiero

↓

Generación de recomendaciones

↓

Visualización de resultados en el Dashboard
```

---

# 📌 Endpoint principal

### POST

```
/api/v1/financial-analysis
```

### Ejemplo de solicitud

```json
{
  "monthlyIncome": 4500,
  "monthlyDebt": 600,
  "savingFrequency": "MEDIUM",
  "transactions": [
    {
      "description": "Compra en supermercado",
      "amount": 420
    }
  ]
}
```

---

# 📈 Ciencia de Datos

Para este proyecto se desarrolló un conjunto de datos sintético propio, diseñado específicamente para representar distintos perfiles financieros y hábitos de consumo.

El proceso de Ciencia de Datos contempla las siguientes etapas:

- Generación de datasets sintéticos.
- Análisis exploratorio de datos (EDA).
- Preprocesamiento de datos.
- Ingeniería de atributos.
- Entrenamiento y evaluación de modelos.
- Integración del modelo con la API REST.

---

# 📅 Roadmap

- ✅ Planificación del proyecto.
- ✅ Diseño de la arquitectura.
- ✅ Generación del dataset sintético.
- ✅ Análisis Exploratorio de Datos (EDA).
- 🔄 Desarrollo del Backend.
- 🔄 Desarrollo del Frontend.
- 🔄 Integración con Supabase.
- ⬜ Entrenamiento del modelo de IA.
- ⬜ Integración con Oracle Cloud Infrastructure (OCI).
- ⬜ Despliegue de la aplicación.
- ⬜ Documentación final.
- ⬜ Presentación del proyecto.

---

# 👥 Equipo

G9 Latam Team 29

---

# 📸 Capturas de pantalla

> Se incorporarán capturas del dashboard y de la aplicación a medida que avance el desarrollo del proyecto.

---

# 📄 Licencia y propósito

Este proyecto fue desarrollado con fines educativos como parte del **Hackathon Oracle Next Education (ONE)**, organizado por **Alura Latam** y **No Country**.

Su objetivo es demostrar la aplicación de tecnologías de desarrollo web, Ciencia de Datos e Inteligencia Artificial para resolver un problema real relacionado con la educación financiera.

El código fuente y la documentación fueron desarrollados exclusivamente para esta instancia de aprendizaje y evaluación dentro del programa **Oracle Next Education (ONE)**.
