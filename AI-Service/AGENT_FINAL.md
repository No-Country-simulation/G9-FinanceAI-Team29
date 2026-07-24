# FinSight AI — Agente final para hackathon

## Flujo

1. Valida la entrada.
2. Bloquea solicitudes sobre otros usuarios y solicitudes de información interna.
3. Detecta la intención sin cargar información financiera.
4. Responde saludos y consultas fuera de alcance localmente.
5. Carga únicamente los datos de la cuenta autenticada.
6. Construye un contexto limitado según la intención.
7. Envía al LLM un payload JSON tratado como datos no confiables.

## Controles incluidos

- Privacidad entre usuarios: no consulta, confirma, compara ni revela información de otra cuenta.
- Protección contra solicitudes de prompt, credenciales, variables de entorno o dataset completo.
- Los bloqueos se resuelven internamente y no llaman al LLM ni a `analizar_usuario`.
- Saludos, agradecimientos, despedidas, capacidades y consultas fuera de alcance no cargan datos financieros.
- Consultas puntuales reciben contexto mínimo.
- Consultas con varios temas financieros se tratan como análisis general.
- Prompt en español neutro para Latinoamérica.
- Uso exclusivo de la moneda configurada.
- Prohibición de inventar datos, recomendar productos financieros o presentar clasificaciones como diagnósticos.

## Pruebas

Ejecutar:

```bash
pytest -q
```

La versión entregada contiene 11 pruebas automáticas para intenciones, privacidad,
seguridad, minimización de contexto y comportamiento conversacional.
