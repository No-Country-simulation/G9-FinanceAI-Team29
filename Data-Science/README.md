# FinSightAI — Data Science

> **Ver más allá de tus finanzas**

Pipeline integral de Ciencia de Datos desarrollado para **FinSightAI**, proyecto del equipo **TwentyNine Devs — G9 LATAM Team 29**, en el marco del Hackathon de Oracle Next Education (ONE) y No Country.

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/No-Country-simulation/G9-FinanceAI-Team29/blob/main/FinSightAI_DataScience_1.ipynb)

---

## 📌 ¿Qué es FinSightAI?

**FinSightAI** es una plataforma de análisis financiero asistida por Inteligencia Artificial.

Su objetivo es ayudar a los usuarios a comprender mejor:

- sus ingresos;
- sus gastos;
- su nivel de endeudamiento;
- su capacidad de ahorro;
- su comportamiento financiero;
- y posibles acciones para mejorar su situación financiera.

FinSightAI **no administra dinero ni funciona como billetera virtual**. Su alcance se centra en analizar información financiera, detectar patrones y generar recomendaciones útiles y explicables.

---

## 📓 Notebook principal

El pipeline completo de Ciencia de Datos se encuentra en:

```text
FinSightAI_DataScience_1.ipynb
```

El notebook puede ejecutarse directamente en Google Colab usando el botón:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/No-Country-simulation/G9-FinanceAI-Team29/blob/main/FinSightAI_DataScience_1.ipynb)

---

## 🚀 ¿Qué hace el notebook?

El notebook implementa un pipeline integral que incluye:

1. Importación de librerías y configuración.
2. Carga reproducible de datasets.
3. Exploración de datos (EDA).
4. Limpieza y validación estructural.
5. Estadísticas descriptivas.
6. Análisis de categorías de gastos e ingresos.
7. Análisis de perfiles financieros.
8. Análisis de montos y medios de pago.
9. Relación entre variables financieras.
10. Procesamiento financiero y textual.
11. Ingeniería de atributos.
12. Generación de variables agregadas por usuario.
13. Exportación de datasets procesados.
14. Entrenamiento del clasificador de transacciones.
15. Evaluación mediante hold-out estratificado.
16. Calibración y control de confianza.
17. Validación agrupada por descripción.
18. Interpretabilidad del clasificador.
19. Entrenamiento del clasificador de perfil financiero.
20. Validación cruzada estratificada.
21. Interpretabilidad del modelo de perfil.
22. Inferencia y recomendaciones.
23. Generación de contratos JSON.
24. Casos de uso completos por usuario.
25. Serialización de modelos.
26. Pruebas de recarga y robustez.
27. Conclusiones.
28. Limitaciones.

---

## 🤖 Capacidades principales del MVP

El pipeline de Ciencia de Datos permite cubrir cinco capacidades centrales:

- **Clasificación automática de transacciones.**
- **Análisis del comportamiento financiero.**
- **Clasificación del perfil financiero.**
- **Generación de recomendaciones personalizadas y explicables.**
- **Integración de los modelos con el AI-Service desarrollado en FastAPI.**

---

## 🧠 Modelos

### Clasificador de transacciones

El modelo utiliza principalmente la descripción normalizada de cada operación para identificar automáticamente la categoría financiera correspondiente.

Se emplean técnicas de procesamiento textual y pipelines de Scikit-learn para asegurar que el mismo preprocesamiento utilizado durante el entrenamiento pueda reutilizarse durante la inferencia.

### Clasificador de perfil financiero

El modelo de perfil combina distintos indicadores financieros, entre ellos:

- ingresos;
- gastos;
- ahorro;
- endeudamiento;
- comportamiento transaccional;
- variables agregadas por usuario.

El objetivo es caracterizar la situación financiera general de cada usuario.

---

## 🛠️ Tecnologías utilizadas

El notebook utiliza principalmente:

- Python
- Pandas
- NumPy
- Matplotlib
- Scikit-learn
- TF-IDF
- Logistic Regression
- SGDClassifier
- CalibratedClassifierCV
- Joblib
- Google Colab
- JSON

---

## 📂 Principales archivos generados

Durante la ejecución del pipeline se generan distintos datasets y artefactos:

```text
transacciones_features.csv
usuarios_features.csv
clasificador_gastos.joblib
clasificador_perfil.joblib
metricas_modelos.csv
metadata_modelos.json
ejemplos_respuesta_backend.json
```

También se utilizan como entrada:

```text
transacciones_sinteticas.csv
usuarios_sinteticos.csv
```

Los modelos serializados pueden luego ser consumidos por el **AI-Service** de FinSightAI.

---

## 🔌 Integración con FastAPI

Los pipelines completos se serializan utilizando `joblib`.

Esto permite conservar:

- el preprocesamiento;
- la transformación de variables;
- la lógica del modelo;
- y la inferencia final.

De esta forma, el backend puede cargar el mismo pipeline utilizado durante el entrenamiento y reducir inconsistencias entre el notebook y el entorno de ejecución.

El notebook también genera ejemplos de contratos JSON compatibles con la API REST.

---

# ▶️ Cómo agregar “Open in Colab”

Para que un notebook mostrado en GitHub tenga un botón que permita abrirlo directamente en Google Colab, se puede agregar un **badge de Colab**.

## Opción 1 — Agregarlo al README

Este README utiliza el siguiente código Markdown:

```markdown
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/No-Country-simulation/G9-FinanceAI-Team29/blob/main/FinSightAI_DataScience_1.ipynb)
```

GitHub lo mostrará así:

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/No-Country-simulation/G9-FinanceAI-Team29/blob/main/FinSightAI_DataScience_1.ipynb)

---

## Opción 2 — Agregarlo dentro del propio notebook

En Google Colab:

1. Ir al inicio del notebook.
2. Crear una celda nueva con **`+ Texto`**.
3. No utilizar una celda de código.
4. Pegar el siguiente HTML:

```html
<a href="https://colab.research.google.com/github/No-Country-simulation/G9-FinanceAI-Team29/blob/main/FinSightAI_DataScience_1.ipynb" target="_parent">
  <img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/>
</a>
```

Al guardar el notebook y subirlo a GitHub, el badge aparecerá dentro del propio `.ipynb`.

### Importante

La URL tiene esta estructura:

```text
https://colab.research.google.com/github/
ORGANIZACION/
REPOSITORIO/
blob/
RAMA/
RUTA_DEL_NOTEBOOK.ipynb
```

Para este proyecto:

```text
ORGANIZACION = No-Country-simulation
REPOSITORIO = G9-FinanceAI-Team29
RAMA = main
NOTEBOOK = FinSightAI_DataScience_1.ipynb
```

Si el notebook se mueve a una carpeta del repositorio, también hay que actualizar la URL.

Por ejemplo:

```text
data-science/FinSightAI_DataScience_1.ipynb
```

se convertiría en:

```text
https://colab.research.google.com/github/No-Country-simulation/G9-FinanceAI-Team29/blob/main/data-science/FinSightAI_DataScience_1.ipynb
```

---

## ▶️ Ejecución en Google Colab

1. Abrir el notebook utilizando **Open in Colab**.
2. Cargar los datasets requeridos si no se encuentran disponibles automáticamente.
3. Ejecutar las celdas en orden desde el comienzo.
4. Verificar que las dependencias estén disponibles.
5. Ejecutar el pipeline completo.
6. Descargar o conservar los artefactos generados según sea necesario.

---

## ⚠️ Limitaciones

El proyecto utiliza datos sintéticos creados para representar distintos comportamientos financieros.

Por este motivo:

- los resultados deben validarse posteriormente con datos reales e independientes;
- algunas categorías pueden presentar patrones más regulares que los encontrados en datos bancarios reales;
- el vocabulario transaccional deberá ampliarse para mejorar la generalización;
- las recomendaciones utilizadas en el MVP deberían ser revisadas por especialistas del dominio;
- el score financiero es un indicador propio del proyecto y **no constituye una calificación crediticia oficial**;
- el perfil financiero no representa un diagnóstico profesional;
- los modelos pueden reproducir sesgos presentes en los datos;
- antes de una utilización productiva será necesario incorporar monitoreo, recalibración, control de deriva y protección de datos personales.

---

## 📈 Próximas mejoras

Entre las mejoras futuras se contemplan:

- entrenamiento con datos reales y anonimizados;
- ampliación del vocabulario de transacciones;
- nuevas estrategias de calibración;
- monitoreo de desempeño;
- detección de deriva de datos;
- revisión especializada de las recomendaciones;
- evaluación continua de los modelos;
- mayor robustez para descripciones bancarias reales.

---

## 👥 Equipo

**TwentyNine Devs**

**Codear · Colaborar · Crear**

Proyecto desarrollado para el Hackathon de **Oracle Next Education (ONE)** y **No Country**.

---

## 📄 Aviso

FinSightAI es una herramienta de análisis y apoyo a la comprensión financiera.

No reemplaza asesoramiento financiero, contable, legal o profesional.
