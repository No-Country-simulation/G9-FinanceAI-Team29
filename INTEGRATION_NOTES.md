# FinSightAI — integración de Metas

## Arquitectura final

- **Backend Spring Boot:** fuente de verdad y persistencia de metas en PostgreSQL/Supabase mediante JPA.
- **Frontend React:** pantalla `/metas` con creación, edición, reserva de dinero, cancelación y seguimiento visual.
- **AI-Service FastAPI:** consulta las metas desde el backend Spring; ya no utiliza `storage/goals.json` como persistencia.

## Backend

Proyecto ejecutable: `Backend/Backend/backend`.

Se agregaron:

- entidad `Goal` (`metas`);
- DTOs de creación, actualización, montos, respuesta y resumen;
- `GoalRepository`;
- `GoalService` con validaciones de propiedad, categorías, estados y montos;
- `GoalController` bajo `/api/usuarios/{usuarioId}/metas`.

Endpoints:

- `GET /api/usuarios/{usuarioId}/metas`
- `POST /api/usuarios/{usuarioId}/metas`
- `GET /api/usuarios/{usuarioId}/metas/{goalId}`
- `PATCH /api/usuarios/{usuarioId}/metas/{goalId}`
- `POST /api/usuarios/{usuarioId}/metas/{goalId}/reservas`
- `POST /api/usuarios/{usuarioId}/metas/{goalId}/liberaciones`
- `DELETE /api/usuarios/{usuarioId}/metas/{goalId}`
- `GET /api/usuarios/{usuarioId}/metas/resumen`

Hibernate tiene `ddl-auto: update`, por lo que crea la tabla `metas` al iniciar contra la base configurada.

## Frontend

Se agregó:

- ruta protegida `/metas`;
- entrada “Metas” en el sidebar;
- página `src/pages/Finance/Metas.tsx`;
- tipos `Goal`, `GoalInput`, categorías y estados;
- funciones de API para listar, crear, editar, reservar y cancelar.

La moneda visible se mantiene en USD, consistente con el alcance definido para FinSightAI.

## AI-Service

- `GoalRepository` ahora consume el backend configurado por `BACKEND_URL` (por defecto `http://localhost:8081/api`).
- Se eliminó el uso operativo de `goals_storage_path`.
- El agente conserva el resumen determinista de metas, pero obtiene los datos desde Spring.

## Corrección de deuda

Ahora se reconocen como análisis de deuda:

- “¿Cómo puedo desendeudar?”
- “¿Cómo puedo desendeudarme?”
- “¿Cómo puedo resolver mi deuda?”
- consultas con “salir”, “reducir” o “pagar” la deuda.

Las consultas de monto como “¿Cuánto pago de deuda por mes?” siguen siendo directas y deterministas.

## Validación realizada

- Compilación sintáctica completa del código Python (`compileall`): correcta.
- Pruebas focalizadas del clasificador de deuda: correctas.
- La suite existente del agente conserva cinco fallos anteriores en casos de saludo combinado, intención desconocida y análisis múltiple; no fueron introducidos por Metas.
- Maven no está instalado en el entorno de empaquetado, por lo que el backend debe validarse localmente con `mvn test` o `./mvnw test` si se agrega wrapper.
- El frontend venía sin dependencias instaladas. La instalación comenzó, pero el registro local de paquetes quedó incompleto dentro del límite del entorno; ejecutar `npm ci && npm run build` en una máquina con acceso normal al registro.

## Ajuste de metas: aportes de ahorro

- `Reservar` fue reemplazado por `+ Agregar ahorro`.
- Los aportes ya no se validan contra el saldo disponible del usuario.
- Nuevo endpoint principal: `POST /api/usuarios/{usuarioId}/metas/{goalId}/aportes`.
- El endpoint anterior `/reservas` se mantiene temporalmente por compatibilidad.
- Al cancelar una meta se conserva el progreso registrado para historial.
- Se corrigió el selector de categorías en modo oscuro.

## Fix final de aislamiento y recomendaciones

- La pantalla de Metas usa el `usuarioId` activo del `AuthContext` en todas las operaciones.
- Al cambiar de cuenta demo, limpia el estado anterior y recarga solo las metas del usuario seleccionado.
- El backend mantiene la validación de propiedad de cada meta y filtra por `usuario_id`.
- El nivel de riesgo `Moderado`/`Medio` se muestra en naranja.
- Las recomendaciones se presentan con voz del agente usando “Te recomiendo…”.
- Los perfiles en observación o riesgo muestran una acción directa hacia la sección Metas.
