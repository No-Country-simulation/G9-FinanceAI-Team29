# 🤖 FinSightAI | AI & Data Science

![Python](https://img.shields.io/badge/Python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green)
![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-ML-orange)
![Status](https://img.shields.io/badge/Status-Development-success)

---

## 📖 Descripción

Este repositorio contiene el desarrollo de la capa de Inteligencia Artificial y Ciencia de Datos de **FinSightAI**, proyecto desarrollado para el Hackathon **Oracle Next Education (ONE) + Alura Latam + No Country**.

Incluye el entrenamiento de modelos de Machine Learning, el microservicio de IA desarrollado con FastAPI, el material utilizado durante el desarrollo de Ciencia de Datos y scripts auxiliares para la carga de datos en Supabase.

---

# 📂 Estructura del repositorio

```text
.
├── AI-Service/                 # Microservicio FastAPI
│
├── DataScience (Legacy)/       # Notebook y material utilizado durante el desarrollo
│
├── scripts/
│   └── database/               # Scripts para carga de datos en Supabase
│
└── README.md
```

---

# 🤖 AI-Service

El directorio **AI-Service** contiene el microservicio desarrollado con FastAPI encargado de exponer las capacidades de Inteligencia Artificial mediante una API REST.

Entre sus funcionalidades se encuentran:

- Clasificación automática de transacciones.
- Análisis del perfil financiero.
- Generación de recomendaciones financieras mediante un agente basado en LLMs.
- Integración con modelos de Machine Learning serializados.
- Documentación mediante Swagger/OpenAPI.

La documentación técnica completa del servicio se encuentra en:

```text
AI-Service/README.md
```

---

# 📊 Ciencia de Datos

Durante el desarrollo del proyecto se construyó un pipeline completo de Ciencia de Datos que incluye:

- Exploración y limpieza de datos (EDA).
- Procesamiento de variables financieras y textuales.
- Ingeniería de atributos.
- Entrenamiento y evaluación de modelos.
- Serialización mediante Joblib.

El material utilizado durante esta etapa se conserva en:

```text
DataScience (Legacy)/
```

---

# 🗄 Dataset

El proyecto utiliza datasets sintéticos diseñados para representar distintos perfiles financieros y hábitos de consumo.

Los datos procesados utilizados por los modelos se encuentran dentro del AI-Service.

---

# ⚙ Scripts

El directorio `scripts/` contiene herramientas auxiliares utilizadas durante el desarrollo.

Actualmente incluye:

- Carga del dataset sintético en Supabase.

---

# 🛠 Tecnologías

- Python 3.12
- FastAPI
- Pandas
- NumPy
- Scikit-Learn
- Joblib
- Pydantic
- Uvicorn
- Google Colab
- Supabase

---
