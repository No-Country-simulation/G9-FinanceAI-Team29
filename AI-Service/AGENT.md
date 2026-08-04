\# FinSightAI Agent



\## Descripción



Finsi es el asistente inteligente de FinSightAI.



Su objetivo es responder consultas financieras utilizando datos reales del usuario y brindar soporte sobre el funcionamiento de la aplicación, priorizando respuestas determinísticas antes de recurrir a un modelo de lenguaje (LLM).



\---



\# Arquitectura



```

Usuario

&#x20;   │

&#x20;   ▼

Frontend (React)

&#x20;   │

&#x20;   ▼

POST /agent/chat

&#x20;   │

&#x20;   ▼

FastAPI

&#x20;   │

&#x20;   ▼

FinSightAgentService

&#x20;   │

&#x20;   ├──────────────► Motor financiero

&#x20;   │

&#x20;   ├──────────────► Soporte interactivo

&#x20;   │

&#x20;   ├──────────────► Respuestas determinísticas

&#x20;   │

&#x20;   └──────────────► LLM (Groq / Gemini)

```



\---



\# Flujo de procesamiento



Cada consulta pasa por las siguientes etapas:



1\. Normalización del texto.

2\. Corrección ortográfica.

3\. Detección de intención.

4\. Verificación de contexto conversacional.

5\. Evaluación de consultas financieras.

6\. Evaluación del soporte interactivo.

7\. Respuestas determinísticas.

8\. Uso del LLM únicamente cuando es necesario.



\---



\# Prioridad de resolución



El agente intenta responder utilizando el siguiente orden:



1\. Consultas financieras.

2\. Contexto conversacional.

3\. Soporte interactivo.

4\. Respuestas determinísticas.

5\. LLM.



De esta forma se reducen costos, latencia y respuestas inconsistentes.



\---



\# Motor financiero



El motor financiero responde consultas utilizando las transacciones reales del usuario.



Actualmente soporta:



\## Gastos



\- Total de gastos.

\- Último gasto.

\- Mayor gasto.

\- Gastos por período.

\- Gastos diarios.

\- Gastos mensuales.

\- Gastos por categoría.

\- Gastos por medio de pago.

\- Detalle de movimientos.



\## Ingresos



\- Total de ingresos.

\- Último ingreso.

\- Ingresos mensuales.

\- Ingresos diarios.



\## Fechas



\- Hoy.

\- Ayer.

\- Anteayer.

\- Día anterior.

\- Mes actual.

\- Mes anterior.

\- Meses específicos.



\---



\# Contexto conversacional



El agente mantiene contexto utilizando la respuesta anterior.



Ejemplos:



```

¿Cuánto gasté ayer?



¿Y el día anterior?

```



```

¿Cuánto gasté este mes?



¿Y el mes pasado?

```



```

¿Cuál fue mi último gasto?



¿Y el anterior?

```



\---



\# Soporte interactivo



El módulo de soporte guía al usuario para resolver problemas relacionados con la aplicación.



Actualmente incluye:



\- Problemas al importar CSV.

\- Diagnóstico paso a paso.

\- Validación de requisitos.

\- Derivación al soporte cuando corresponde.



\---



\# Zona horaria



El frontend envía automáticamente la zona horaria del navegador.



```ts

Intl.DateTimeFormat().resolvedOptions().timeZone

```



El backend utiliza esta información para interpretar correctamente consultas como:



\- Hoy.

\- Ayer.

\- Anteayer.

\- Este mes.



En caso de recibir una zona inválida se utiliza UTC como respaldo.



\---



\# Frontend



El frontend incorpora:



\- Bienvenida inicial de Finsi.

\- Renderizado de enlaces Markdown.

\- Navegación interna.

\- Conservación del contexto mediante `previous\_answer`.



\---



\# Modelos de IA



El sistema soporta múltiples proveedores.



Actualmente:



\- Groq

\- Gemini



La selección del proveedor es transparente para el usuario.



\---



\# Objetivos de diseño



El asistente fue diseñado siguiendo los siguientes principios:



\- Priorizar respuestas determinísticas.

\- Minimizar llamadas al LLM.

\- Utilizar datos reales del usuario.

\- Mantener contexto conversacional.

\- Ser extensible mediante nuevos intents.

\- Mantener una arquitectura modular.



\---



\# Estructura principal



```

app/

│

├── api/

│

├── services/

│   ├── agent/

│   ├── support/

│   ├── goals/

│   └── llm/

│

├── schemas/

│

└── tests/

```



\---



\# Próximas mejoras



\- Mejor contexto conversacional.

\- Mayor cobertura de consultas financieras.

\- Más consultas comparativas.

\- Optimización del router semántico.

\- Mejor memoria entre preguntas.

\- Nuevos diagnósticos de soporte.

\- Mayor cobertura de tests.



\---



\# Estado del proyecto



Estado actual:



\- Arquitectura modular.

\- Motor financiero determinístico.

\- Soporte interactivo.

\- Contexto conversacional.

\- Backend y frontend integrados.

\- Cobertura de pruebas automatizadas.

