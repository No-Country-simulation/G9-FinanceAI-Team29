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
