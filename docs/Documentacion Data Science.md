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
