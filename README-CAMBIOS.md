# Resumen de Cambios – FinSightAI

## Archivos Modificados

### Backend

#### `Backend/src/main/java/.../service/RecomendacionService.java`
Se modificó para generar recomendaciones financieras estructuradas con diagnóstico, acción sugerida, objetivo y contexto para Finsi.

#### `Backend/src/main/java/.../service/MlService.java`
Se modificó para mejorar la comunicación con el AI-Service, validar respuestas y manejar fallbacks cuando el servicio de IA no está disponible.

#### `Backend/src/main/java/.../service/AnalisisService.java`
Se modificó para integrar el análisis del AI-Service con el análisis local y construir respuestas unificadas.

#### `Backend/src/main/java/.../dto/AnalisisResponse.java`
Se modificó para soportar recomendaciones estructuradas.

#### `Backend/src/main/java/.../dto/ml/MlAnalysisResponse.java`
Se modificó para adaptar la respuesta recibida desde el AI-Service.

---

### Frontend

#### `frontend/src/pages/Finance/Recomendaciones.tsx`
Se modificó para mostrar recomendaciones estructuradas y permitir continuar la conversación con Finsi.

#### `frontend/src/components/finance/RecommendationsList.tsx`
Se modificó para renderizar las nuevas recomendaciones estructuradas.

#### `frontend/src/pages/Finance/Analisis.tsx`
Se modificó para consumir el nuevo formato de análisis financiero.

#### `frontend/src/pages/Dashboard/Home.tsx`
Se modificó para integrar las recomendaciones en el dashboard.

#### `frontend/src/types/finance.ts`
Se modificó para incorporar los nuevos modelos de recomendaciones.

#### `frontend/src/pages/Ai/AsistenteIA.tsx`
Se modificó para mantener el contexto conversacional, soportar seguimiento de recomendaciones, ocultar metadata interna y mejorar la experiencia del chat.

---

### AI-Service

#### `app/services/agent/service.py`
Se modificó para mejorar el enrutamiento de consultas, mantener contexto y priorizar correctamente soporte, consultas financieras y conocimiento del producto.

#### `app/services/agent/transaction_queries.py`
Se modificó para agregar seguimiento de consultas financieras por meses, años y rankings, además de proteger el contexto conversacional.

#### `app/services/support/diagnosis.py`
Se modificó para implementar flujos guiados de soporte para contraseña, CSV y dashboard.

#### `app/services/support/intent.py`
Se modificó para reconocer más variantes de consultas técnicas y errores comunes.

#### `app/services/support/product_knowledge.py`
Se modificó para responder preguntas frecuentes sobre el funcionamiento de FinSightAI sin utilizar IA generativa.

---

## Archivos Creados

### Backend

#### `Backend/src/main/java/.../dto/RecomendacionDTO.java`
Creado para representar recomendaciones financieras estructuradas.

---

### AI-Service

#### `AI-Service/tests/test_support_*.py`
Creados para validar automáticamente los flujos de soporte.

#### `AI-Service/tests/test_financial_context_*.py`
Creados para validar el contexto financiero, los seguimientos por período y los rankings.

---

## Los cambios incluyen

- Recomendaciones financieras estructuradas.
- Continuidad entre las recomendaciones y Finsi.
- Contexto conversacional financiero.
- Seguimiento de consultas por mes y año.
- Seguimiento de rankings de categorías.
- Soporte guiado para CSV, contraseña y dashboard.
- Base de conocimiento integrada (Product Knowledge).
- Tolerancia a errores ortográficos y lenguaje natural.
- Español neutro para Latinoamérica.
- Protección del contexto conversacional.
- Derivación automática a soporte cuando corresponde.
- Pruebas de regresión para evitar que los errores corregidos vuelvan a aparecer.