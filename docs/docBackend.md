# Entrega Backend — FinanceAI

> Documento de handoff del **backend** (Java 21 + Spring Boot 3.4 + PostgreSQL).
> Resume qué hace, cómo levantarlo, el contrato con el front y qué falta por hacer .
> Última actualización: 15 de julio de 2026.

---

## 1. Resumen

El backend expone una **API REST** que:
- Carga y sirve los **datos sintéticos** (100 usuarios + 4.500 transacciones).
- **Clasifica** transacciones en categorías (Alimentación, Transporte, etc.).
- Analiza el **perfil financiero** del usuario (Saludable / En observación / En riesgo).
- Genera **recomendaciones** personalizadas.
- Guarda el **historial** de cada análisis.
- Documenta todo con **Swagger/OpenAPI**.

Estado: **funcional y probado end-to-end** con la base y el front.
Pendiente de equipo: **integración OCI** y **modelo ML** (ver sección 7).

---

## 2. Cómo levantar el stack

### Requisitos
- Java 21 (`C:\Program Files\Java\jdk-21.0.10`)
- Node 18+ (para el front)
- PostgreSQL 18 corriendo en `localhost:5432`, base `financeai`, user/pass `postgres/postgres`


### Backend (puerto 8080)
```powershell
cd C:\Users\Users\Desktop\finanzas-hackathon\backend
$env:JAVA_HOME="C:\Program Files\Java\jdk-21.0.10"
.\.mvn\apache-maven\apache-maven-3.9.6\bin\mvn.cmd spring-boot:run
```

### Frontend (puerto 5173)
```powershell
cd C:\Users\Users\Desktop\finanzas-hackathon\frontend
npm run dev
```

### URLs
| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8080/api |
| **Swagger (doc de la API)** | http://localhost:8080/swagger-ui.html |
| OpenAPI JSON | http://localhost:8080/v3/api-docs |

### Cómo cambiar los puertos

Si tienen algún puerto ocupado se puede cambiar sin problema. Lo único importante es que los puntos que dependen entre sí queden coherentes:

| Qué | Dónde se cambia | Por defecto |
|-----|-----------------|-------------|
| Puerto del backend | `backend/src/main/resources/application.yml` → `server.port` | 8080 |
| A qué puerto le pega el front | `frontend/src/services/api.ts` → `API_BASE` | http://localhost:8081/api |
| Puerto del microservicio de ML | `application.yml` → `ml.service.url` | 8000 |
| Puerto del front (Vite) | no está fijado; se cambia al vuelo con `npm run dev -- --port XXXX` | 5173 |

Dos cosas a tener en cuenta:
- Si mueven el **backend**, el `API_BASE` de `api.ts` tiene que apuntar al mismo puerto.
- Si cambian el puerto del **front**, agréguenlo en los `allowedOrigins` del CORS (`backend/src/main/java/com/financeai/config/WebConfig.java`), o el navegador va a bloquear las llamadas.

Aviso: yo (Guillermo) levanto el backend en el **8081** porque tengo el 8080 ocupado, por eso el `api.ts` ya apunta a `8081` aunque el `application.yml` venga con `8080` por defecto. Si arrancan el backend tal cual (8080), o bien lo suben a 8081 (con `server.port: 8081` o `--server.port=8081`), o cambien el `API_BASE` del front a 8080 para que casen. Y si a alguien le choca el 8081 o necesita probar otro puerto, que lo maneje en su copia local; no hace falta preguntar, solo mantengan alineados los puntos de la tabla.

---

## 3. Contrato de la API (lo que consume el front)

| Método | Endpoint | Devuelve |
|--------|----------|----------|
| GET | `/api/usuarios/{id}` | Usuario completo |
| GET | `/api/usuarios/{id}/perfil` | Perfil financiero resumido |
| GET | `/api/usuarios/{id}/recomendaciones` | Recomendaciones activas |
| PUT | `/api/usuarios/{id}` | Actualiza datos del usuario |
| GET | `/api/usuarios/{id}/transacciones` | Lista de transacciones |
| GET | `/api/usuarios/{id}/transacciones/resumen` | Totales y gastos por categoría |
| POST | `/api/analisis-financiero?usuarioId={id}` | Análisis de perfil + recomendaciones |
| GET | `/api/clasificar?descripcion={texto}` | Categoría de una descripción |

### Reglas de validación del POST `/analisis-financiero`
- `ingresoMensual`: obligatorio, ≥ 0
- `nivelEndeudamiento`: obligatorio, entre 0 y 100
- `frecuenciaAhorro`: obligatorio, uno de **`Alta` | `Media` | `Baja` | `Nunca`**
- `transacciones`: al menos una; cada `valor` **> 0** (cada transacción es un gasto)

Ejemplo de body válido:
```json
{
  "ingresoMensual": 5000,
  "nivelEndeudamiento": 25,
  "frecuenciaAhorro": "Media",
  "transacciones": [
    { "descripcion": "Alquiler", "valor": 1200 },
    { "descripcion": "Supermercado", "valor": 400 }
  ]
}
```

Si el body es inválido, la API responde **400** con un JSON estructurado:
```json
{
  "status": 400,
  "error": "Bad Request",
  "message": "La solicitud contiene datos inválidos",
  "path": "/api/analisis-financiero",
  "validationErrors": {
    "frecuenciaAhorro": "Frecuencia inválida: Alta, Media, Baja o Nunca",
    "transacciones[0].valor": "El monto debe ser mayor a 0"
  }
}
```

---

## 4. Base de datos y carga de datos

- **DDL:** `ddl-auto: update` + `defer-datasource-initialization: true` (Hibernate crea las tablas y *después* corre `data.sql`).
- **`data.sql`** inserta solo las **9 categorías** (ids 1–9).
- **`DataLoader`** (`bootstrap/DataLoader.java`) carga **100 usuarios** y **4.500 transacciones** desde los CSV en `resources/data/` la primera vez. Es **idempotente**: si ya hay usuarios, no recarga.
- Para **recargar desde cero** (por ejemplo si cambian los CSV): resetear el esquema y reiniciar el back:
  ```sql
  -- como admin de postgres
  DROP SCHEMA public CASCADE; CREATE SCHEMA public;
  ```

---

## 5. Qué se corrigió en el backend 

1. **Carga de datos sintéticos**: antes la DB quedaba casi vacía (solo 10 usuarios, 0 transacciones) y el Dashboard salía en blanco. Ahora carga los 100 usuarios y 4.500 transacciones.
2. **Bug `/clasificar`**: daba error 500 (parámetro mal declarado). Corregido; ahora usa el servicio de clasificación.
3. **Clasificación determinista**: antes el resultado podía variar entre ejecuciones (orden de patrones no garantizado). Ahora es estable y con prioridad explícita.
4. **Manejo de errores**: se agregó un handler global que devuelve errores 400/500 en JSON estructurado.
5. **Swagger/OpenAPI**: la API queda auto-documentada.
6. **Historial de análisis**: cada `POST /analisis-financiero` se guarda en `perfiles_historial`.
7. **Limpieza**: CORS centralizado, dependencias sin uso eliminadas, Java alineado a 21.

---

## 6. ⚠️ Nota para Ciencia de Datos 

El archivo **`transacciones_ready.csv`** tiene mal el `categoria_id` de **Alimentación** y **Educación**: los asignó a **9 (Otros)** por un desajuste de acentos al mapear nombre→id en el notebook. Resultado: "Otros" quedaba con 1.500 filas y Alimentación/Educación con 0.

**Solución aplicada:** el backend carga desde **`transacciones_sinteticas.csv`** (que trae el **nombre** correcto de la categoría) y mapea por nombre. Distribución ahora: **500 por cada una de las 9 categorías**.

**Acción sugerida:** corregir el join nombre→id en el notebook para que `transacciones_ready.csv` quede consistente (o simplemente usar el `sinteticas.csv` como fuente oficial).

---

## 7. Pendiente de integrar con el equipo

### Modelo ML (Ciencia de Datos)
Hoy la clasificación y el perfil usan **reglas** (regex + puntaje), no el modelo entrenado del notebook.
- **Punto de integración**: `service/ClasificacionService.java` (clasificación) y `service/AnalisisService.java` (perfil).
- Idea: exponer el modelo serializado (por ejemplo vía un microservicio Python o cargarlo con una librería Java) y reemplazar las reglas por la predicción del modelo.

### OCI (obligatorio por las bases del hackathon)
Aún no integrado. Opciones mínimas:
- **Object Storage** para guardar el modelo serializado o los CSV.
- **OCI Compute** para hospedar el backend.
- El requisito es usar **al menos un** servicio de OCI.

---

## 8. Estructura del backend
```
backend/src/main/java/com/financeai/
├── FinanceAIApplication.java
├── bootstrap/DataLoader.java        # carga CSV -> DB (idempotente)
├── config/                          # CORS global + OpenAPI/Swagger
├── controller/                      # AnalisisController, UsuarioController, TransaccionController
├── dto/                             # objetos de request/response
├── exception/                       # GlobalExceptionHandler + ErrorResponse
├── model/                           # entidades JPA
├── repository/                      # repositorios Spring Data
└── service/                         # AnalisisService, ClasificacionService, RecomendacionService
```
