# Chatbot conectado a Spring Boot

El asistente ahora consulta las transacciones reales mediante:

`GET {BACKEND_URL}/usuarios/{usuarioId}/transacciones`

Configuración local recomendada en `AI-Service/.env`:

`BACKEND_URL=http://localhost:8081/api`

Para usuarios registrados, Spring Boot es la fuente de verdad. Los CSV de
`data/processed` quedan como respaldo exclusivo para cuentas demo cuando el
backend no está disponible.
