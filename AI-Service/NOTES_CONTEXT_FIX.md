# Corrección de contexto conversacional

Se agregó soporte para preguntas de seguimiento inmediatas mediante `previous_answer`.

Ejemplos soportados:
- "¿Me lo podés explicar más sencillo?"
- "No entendí"
- "¿Qué significa eso?"
- "Resumímelo"
- "¿Por qué?"

También se ajustó la detección para que las consultas sobre "mi perfil financiero" usen el perfil real del usuario y para reconocer expresiones como "¿Dónde estoy gastando más?".

Archivos modificados:
- frontend/src/pages/Ai/AsistenteIA.tsx
- frontend/src/services/api.ts
- AI-Service/app/api/agent.py
- AI-Service/app/services/agent/service.py
- AI-Service/app/services/agent/intent.py
- AI-Service/app/services/llm/prompt_builder.py
