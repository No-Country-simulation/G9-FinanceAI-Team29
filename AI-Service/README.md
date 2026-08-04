# Sprint Summary – AI Service (FinSightAI)

## ✅ Funcionalidades implementadas

### 🤖 Asistente financiero

- Motor determinístico para consultas financieras basado en datos reales.
- Las consultas financieras tienen prioridad sobre el soporte técnico.
- Soporte para contexto conversacional utilizando la respuesta anterior (`previous_answer`).

---

## 💰 Consultas financieras

Se agregaron consultas como:

- Gastos de hoy, ayer y anteayer.
- Día anterior / día siguiente (seguimiento contextual).
- Último gasto.
- Mayor gasto.
- Categoría con mayor gasto.
- Total gastado por mes.
- Total ingresado por mes.
- Comparaciones por fechas.
- Consultas sobre movimientos específicos.
- Consultas por mes utilizando nombres ("julio", "agosto", etc.).

---

## 🧠 Contexto conversacional

El asistente ahora comprende preguntas de seguimiento como:

- ¿Y el día anterior?
- ¿Y el siguiente?
- ¿Y el mes pasado?
- ¿Y julio?
- ¿Eso corresponde a julio?

---

## 📅 Manejo de fechas

- Se agregó soporte para zona horaria enviada desde el frontend.
- El frontend envía automáticamente:

```ts
Intl.DateTimeFormat().resolvedOptions().timeZone
```

- El backend recibe `time_zone`.
- Se implementó fallback seguro a UTC cuando la zona es inválida.

---

## 🛠️ Soporte interactivo

Se mejoró el flujo de soporte para:

- Importación de CSV.
- Diagnóstico guiado.
- Validación de requisitos del CSV.
- Derivación a la página de soporte cuando corresponde.
- Evitar ciclos infinitos durante el diagnóstico.

---

## 🎨 Frontend

- Render de enlaces Markdown.
- Navegación interna hacia `/soporte`.
- Bienvenida inicial de Finsi.
- El mensaje de bienvenida solo aparece en el primer mensaje de la conversación.

---

## 🧪 Testing

Estado actual:

- ✅ 123 tests aprobados.
- ✅ 28 subtests aprobados.
- ✅ Frontend compila correctamente (`npm run build`).

---

# Bugs conocidos

Actualmente existen algunos comportamientos pendientes de mejorar.

## 1. Consultas mensuales específicas

Consultas como:

- ¿Cuánto gasté en julio?
- ¿Qué día gasté más en julio?

En algunos casos son interpretadas como consultas de categoría.

Deberían responder:

- Total del mes.
- Día de mayor gasto.

---

## 2. Seguimiento de movimientos

Después de una consulta incorrectamente interpretada:

```
¿Qué movimiento fue ese?
```

no puede recuperar la fecha previa.

Este problema desaparecerá al corregir el punto anterior.

---

## 3. Fecha actual

Actualmente existen mejoras pendientes para:

- ¿Qué día es hoy?
- ¿En qué mes estamos?

utilizando siempre la zona horaria del usuario.

---

## 4. Contexto mensual

Se desea mejorar conversaciones como:

```
¿Cuánto gasté en julio?

¿Y agosto?

¿Y septiembre?
```

manteniendo automáticamente el contexto.

---

# Próximas mejoras

- Mejorar el router semántico para consultas mensuales.
- Mejorar el seguimiento contextual de meses.
- Mayor memoria conversacional.
- Más consultas financieras avanzadas.
- Optimización del bundle del frontend mediante code splitting.