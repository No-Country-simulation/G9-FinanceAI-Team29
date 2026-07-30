# FinSightAI — Agente final para hackathon

## Flujo

1. Valida la consulta.
2. Normaliza y corrige errores financieros controlados.
3. Bloquea solicitudes de privacidad o seguridad.
4. Detecta intención sin cargar datos financieros.
5. Selecciona la ruta adecuada.
6. Responde internamente cuando el resultado puede calcularse con exactitud.
7. Para recomendaciones, genera hechos verificables mediante reglas.
8. Construye contexto mínimo de la cuenta autenticada.
9. Envía al LLM un JSON tratado como datos no confiables.

## Capacidades finales

- ingresos, gastos, deuda, ahorro, score y perfil;
- análisis y presupuestos;
- cálculos financieros;
- recomendaciones híbridas;
- consulta determinista de metas;
- tolerancia a errores ortográficos comunes;
- privacidad entre usuarios;
- protección de instrucciones y secretos internos.

## Persistencia

La carpeta `storage/` no se versiona. La aplicación crea sus rutas automáticamente. No existe historial conversacional ni almacenamiento funcional de prompts y respuestas.

## Moneda

Todo el sistema trabaja exclusivamente en USD.

## Validación

La entrega final posee 43 pruebas automáticas aprobadas.
