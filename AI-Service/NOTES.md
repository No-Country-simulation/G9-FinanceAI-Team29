# FinSightAI AI-Service
## Versión 2.0.0 — Hackathon Final

## Objetivo

El AI-Service interpreta consultas financieras en lenguaje natural, aplica reglas de seguridad, carga únicamente el contexto necesario y elige entre respuestas internas, cálculos deterministas y generación mediante LLM.

La lógica financiera no se delega por completo al modelo generativo. Los datos calculados, las reglas de negocio y las respuestas exactas permanecen en componentes deterministas.

## Flujo del agente

```text
Consulta
  ↓
Normalización
  ↓
Corrección ortográfica financiera controlada
  ↓
Políticas de privacidad y seguridad
  ↓
Detección de intención
  ↓
Router
  ├─ Respuesta interna
  ├─ Calculadora financiera
  ├─ Respuesta financiera determinista
  ├─ Respuesta determinista de metas
  └─ Financial Rules Engine + contexto mínimo + LLM
```

## Componentes principales

### QueryNormalizer

Normaliza minúsculas, espacios, acentos y puntuación. No corrige palabras ni decide intenciones.

### FinancialSpellCorrector

Corrige errores únicamente contra un vocabulario financiero controlado. Conserva la consulta original y registra cada corrección aplicada.

### IntentDetector

Distingue consultas directas y analíticas. Entre otros casos, diferencia:

```text
¿Cuánto puedo ahorrar por mes? → SAVINGS
¿Cómo puedo ahorrar por mes?  → RECOMMENDATIONS
¿Cómo va mi meta?             → GOALS
```

### AgentPolicies

Bloquea solicitudes sobre otros usuarios, prompt interno, credenciales, variables de entorno, configuración privada y dataset completo. Las solicitudes bloqueadas no cargan el perfil financiero ni llaman al LLM.

### AgentRouter

Selecciona una de estas rutas:

- `internal`
- `calculator`
- `deterministic`
- `llm_with_context`
- `llm_without_context`

### DeterministicFinancialResponder

Responde sin LLM consultas puntuales sobre:

- ingresos;
- gastos;
- deuda;
- capacidad de ahorro;
- score;
- perfil financiero.

### DeterministicGoalResponder

Responde sin LLM consultas sobre metas financieras. Puede informar:

- cantidad de metas activas;
- porcentaje completado;
- monto reservado;
- monto restante;
- reserva mensual sugerida;
- fecha objetivo.

### FinancialRulesEngine

Transforma métricas calculadas en hechos financieros verificables. Ejemplos:

- déficit mensual;
- capacidad de ahorro positiva;
- gastos elevados respecto de ingresos;
- carga mensual de deuda;
- score financiero;
- principal categoría de consumo;
- información insuficiente.

Estos hechos se ordenan por prioridad y se incluyen en el contexto de análisis y recomendaciones. El LLM debe utilizarlos como base y no contradecirlos.

### FinancialContextBuilder

Aplica minimización de datos. Una pregunta puntual recibe solo las métricas necesarias; un análisis general recibe un contexto más amplio. Los hechos del Rules Engine se incluyen únicamente cuando aportan valor.

### FinancialCalculator

Resuelve porcentajes, descuentos, impuestos e intereses con montos explícitos. Rechaza operaciones matemáticas sin propósito financiero.

## Recomendaciones híbridas

Las recomendaciones combinan:

1. métricas ya calculadas;
2. hechos producidos por reglas deterministas;
3. redacción natural mediante LLM.

El LLM no decide por sí solo si existe déficit, cuánto puede ahorrar el usuario o qué proporción representan gastos y deuda.

## Política de moneda

FinSightAI utiliza exclusivamente USD para análisis, metas y respuestas financieras. No existe conversión ni soporte multimoneda.

## Política de almacenamiento

`storage/` está excluido del repositorio mediante `.gitignore`.

La aplicación crea automáticamente las rutas necesarias durante la ejecución, entre ellas:

```text
storage/faiss_index/
storage/goals.json
```

El contenido local no debe considerarse persistencia permanente en despliegues con disco efímero. Para producción, los datos críticos deben almacenarse en una base persistente.

El paquete incluye únicamente `storage/.gitkeep`; no incluye metas ni índices generados durante desarrollo.

## Privacidad

El agente:

- solo procesa la cuenta autenticada;
- no confirma ni compara otros usuarios;
- no expone prompts ni configuración interna;
- no registra memoria conversacional;
- procesa cada consulta de manera independiente;
- no debe almacenar prompts o respuestas como historial funcional.

Los logs técnicos deben evitar credenciales y datos financieros sensibles.

## Capacidad de ahorro

```text
Balance positivo:
Podés ahorrar aproximadamente USD XXX.XX por mes.

Balance cero:
Actualmente no tenés capacidad de ahorro mensual. Tus ingresos cubren exactamente tus gastos y deudas.

Balance negativo:
Actualmente no tenés capacidad de ahorro mensual. Con tus ingresos, gastos y deudas actuales, tu balance mensual estimado presenta un déficit de USD XXX.XX.
```

## Decisiones finales para el hackathon

Incluido:

- arquitectura modular;
- corrección ortográfica controlada;
- seguridad y privacidad;
- contexto mínimo;
- respuestas deterministas;
- metas deterministas;
- Financial Rules Engine;
- recomendaciones híbridas;
- explicaciones financieras basadas en hechos;
- moneda única USD;
- pruebas automáticas.

No incluido deliberadamente:

- memoria conversacional;
- almacenamiento de conversaciones;
- recomendaciones de productos o inversiones;
- soporte multimoneda;
- conversiones de tipo de cambio.

## Pruebas

Ejecutar:

```bash
python -m unittest discover -s tests -v
```

Estado de esta entrega:

```text
43 pruebas aprobadas
Compilación correcta
Importación de app.main correcta
```

## Versión

`2.0.0` es la entrega final del AI-Service para el hackathon.
