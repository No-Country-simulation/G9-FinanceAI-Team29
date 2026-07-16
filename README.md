# 📊 FinSightAI | Data Science

![Python](https://img.shields.io/badge/Python-3.12-blue)
![Pandas](https://img.shields.io/badge/Pandas-2.x-blue)
![Scikit-Learn](https://img.shields.io/badge/Scikit--Learn-Machine%20Learning-orange)
![FastAPI](https://img.shields.io/badge/FastAPI-REST%20API-009688)
![Status](https://img.shields.io/badge/Status-Data%20Science%20Completed-brightgreen)

---

# 📖 Descripción

Este repositorio contiene el desarrollo completo de la capa de **Ciencia de Datos** del proyecto **FinSightAI**, desarrollado por **TwentyNine Devs** para el **Hackathon Oracle Next Education (ONE) + Alura Latam + No Country**.

El objetivo del proyecto es analizar el comportamiento financiero de los usuarios mediante técnicas de Ciencia de Datos y Machine Learning para clasificar gastos, identificar perfiles financieros y generar recomendaciones personalizadas que ayuden a mejorar la salud financiera.

Además del desarrollo de los modelos, esta rama incluye un microservicio desarrollado con **FastAPI**, encargado de exponer las capacidades de Machine Learning mediante una API REST consumida por el backend desarrollado en Spring Boot.

---

# 🎯 Objetivos

- Explorar y limpiar datos financieros.
- Procesar variables financieras y textuales.
- Realizar ingeniería de atributos (Feature Engineering).
- Clasificar automáticamente las transacciones.
- Analizar el perfil financiero de los usuarios.
- Entrenar y evaluar modelos de Machine Learning.
- Interpretar los resultados obtenidos.
- Serializar los modelos entrenados.
- Exponer los modelos mediante FastAPI.
- Integrar el microservicio con el backend Spring Boot.

---

# 📂 Estructura del proyecto

```text
.
├── data/
│   ├── raw/
│   └── processed/
│
├── notebooks/
│
├── models/
│
├── app/
│
├── financialai-ml-service/
│
└── README.md
```

---

# 📁 Dataset

El proyecto utiliza datasets sintéticos especialmente diseñados para representar distintos perfiles financieros y hábitos de consumo.

## Usuarios

Cada usuario posee información como:

- ID
- Edad
- Ingreso mensual
- Deuda mensual
- Capacidad de ahorro
- Nivel educativo
- Situación laboral

## Transacciones

Cada transacción contiene información como:

- Usuario
- Fecha
- Categoría
- Descripción
- Método de pago
- Monto
- Movimiento
- Indicador de recurrencia

---

# 📓 Pipeline de Ciencia de Datos

## 1. Exploración y limpieza de datos (EDA)

- Estadísticas descriptivas
- Distribuciones
- Valores faltantes
- Duplicados
- Visualización de variables
- Calidad de datos

---

## 2. Procesamiento de variables

Se procesaron variables tanto financieras como textuales para construir un dataset apto para Machine Learning.

Incluye:

- Normalización
- Limpieza textual
- Tokenización
- Codificación de variables

---

## 3. Ingeniería de atributos

Se generaron variables derivadas como:

- Gasto mensual promedio
- Porcentaje de gasto
- Nivel de endeudamiento
- Capacidad de ahorro
- Frecuencia de compras
- Distribución por categorías
- Indicadores financieros

---

## 4. Clasificación automática de gastos

Entrenamiento de un modelo capaz de clasificar automáticamente la categoría de una transacción utilizando su descripción.

---

## 5. Perfil financiero

Entrenamiento de un modelo para identificar el perfil financiero del usuario.

Ejemplos:

- Saludable
- En observación
- En riesgo

---

## 6. Entrenamiento y evaluación

Se entrenaron y evaluaron distintos modelos mediante:

- Accuracy
- Precision
- Recall
- F1 Score
- Matriz de confusión
- Validación cruzada
- Evaluación agrupada para evitar fuga de información
- Interpretabilidad del modelo

---

## 7. Serialización

Los modelos entrenados fueron serializados utilizando **Joblib**, permitiendo su reutilización durante la inferencia sin necesidad de reentrenar.

---

# 🤖 Microservicio de Machine Learning

La solución incorpora un microservicio desarrollado con **FastAPI**, responsable de cargar los modelos serializados y ofrecer inferencias mediante una API REST.

Actualmente expone funcionalidades para:

- Clasificación automática de categorías.
- Análisis completo del perfil financiero.
- Generación de recomendaciones.
- Cálculo de indicadores financieros.
- Respuestas estructuradas en formato JSON.

---

# 🔗 Integración

La arquitectura implementada desacopla completamente la capa de Inteligencia Artificial del backend principal.

```text
Backend (Spring Boot)
          │
          ▼
 FastAPI (Python)
          │
          ▼
 Modelos Machine Learning (.joblib)
          │
          ▼
 Predicciones y recomendaciones
```

Durante el desarrollo del proyecto se verificó correctamente la integración entre Spring Boot y FastAPI, permitiendo consumir los modelos entrenados desde el backend mediante peticiones HTTP.

---

# 🛠 Tecnologías

- Python 3.12
- Pandas
- NumPy
- Scikit-Learn
- Joblib
- FastAPI
- Uvicorn
- Pydantic
- Matplotlib
- Google Colab

---

# 🚀 Estado del proyecto

- ✅ Organización del proyecto
- ✅ Generación del dataset sintético
- ✅ Exploración y limpieza de datos (EDA)
- ✅ Procesamiento de variables financieras y textuales
- ✅ Ingeniería de atributos (Feature Engineering)
- ✅ Clasificación automática de gastos
- ✅ Construcción del perfil financiero
- ✅ Entrenamiento de modelos
- ✅ Evaluación y validación
- ✅ Interpretabilidad del modelo
- ✅ Serialización con Joblib
- ✅ Desarrollo del microservicio FastAPI
- ✅ Integración con Spring Boot
- ⏳ Integración con Frontend
- ⏳ Despliegue en Oracle Cloud Infrastructure (OCI)

---

# 👥 Equipo

## TwentyNine Devs

**Hackathon Oracle Next Education (ONE)**  
**Alura Latam + No Country**

### Proyecto

# 💰 FinSightAI

**Ver más allá de tus finanzas**
