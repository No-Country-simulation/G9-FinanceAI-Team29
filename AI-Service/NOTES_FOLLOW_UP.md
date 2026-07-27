# Mejora conversacional para la demo

Se agregó soporte de contexto inmediato en el asistente financiero.

## Cambios

- El frontend envía opcionalmente la última respuesta del asistente como `previous_answer`.
- El endpoint `POST /agent/chat` acepta `previous_answer`.
- Consultas como "explicámelo más sencillo", "no entendí", "¿qué significa eso?" o "¿por qué?" reutilizan la última respuesta y la reformulan sin recalcular ni inventar datos.
- Consultas como "¿Dónde estoy gastando más?" y variantes se detectan como análisis de gastos por categoría.
- Se agregaron pruebas específicas para ambos comportamientos.

## Archivos modificados

- `frontend/src/pages/Ai/AsistenteIA.tsx`
- `frontend/src/services/api.ts`
- `AI-Service/app/api/agent.py`
- `AI-Service/app/services/agent/service.py`
- `AI-Service/app/services/agent/intent.py`
- `AI-Service/app/services/llm/prompt_builder.py`
- `AI-Service/tests/test_agent_intents.py`
- `AI-Service/tests/test_agent_service.py`
