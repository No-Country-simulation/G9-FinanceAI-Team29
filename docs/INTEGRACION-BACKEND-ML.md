# 🔗 Integración Backend (Spring Boot) ↔ Microservicio de ML (FastAPI)

> Documenta la arquitectura de integración entre el backend Java y el modelo de Ciencia de Datos
> (*"integrar el modelo de Ciencia de Datos al backend"*).
> Última actualización: 16 de julio de 2026.

---

## 🗺️ Arquitectura general

Tres servicios que corren por separado:

```
┌────────────┐        ┌─────────────────────┐        ┌──────────────────────┐
│  Frontend  │  HTTP  │   Backend Spring    │  HTTP  │   ML Service FastAPI  │
│ React/Vite │ ─────▶ │   Boot (Java 21)    │ ─────▶ │  (modelos .joblib)   │
│  :5173     │        │       :8081         │        │        :8000         │
└────────────┘        └─────────┬───────────┘        └──────────────────────┘
                                │
                                ▼
                        ┌───────────────┐
                        │ PostgreSQL 18 │
                        │    :5432      │
                        └───────────────┘
```

- El **frontend** solo habla con el **backend** (`frontend/src/services/api.ts` → `http://localhost:8081/api`).
- El **backend** llama al **ML service** para clasificar transacciones y analizar el perfil.
- Si el ML está caído, el backend **sigue funcionando** con sus reglas internas (ver *Resiliencia*).

---

## 🧩 Qué hace cada pieza en el análisis

Cuando el front llama a `POST /api/analisis-financiero`, el backend:

1. **Clasifica cada transacción** en una categoría:
   - Pregunta al modelo (`POST /predict/category` del ML).
   - Si el modelo responde con **confianza ≥ umbral** (0.5 por defecto) → usa esa categoría.
   - Si el modelo **duda** (baja confianza) o está caído → usa las **reglas** (`ClasificacionService`, regex).
   - *Por qué:* el modelo acierta descripciones ricas pero duda en algunas obvias
     (ej. "Supermercado" → confianza 0.21). El umbral combina lo mejor de ambos.

2. **Deriva las métricas** que el modelo necesita y el front no envía:
   | Campo para el ML | Cómo lo calcula el backend |
   |------------------|----------------------------|
   | `deuda_mensual` | `ingreso × nivelEndeudamiento / 100` |
   | `gasto_mensual_promedio` | suma de las transacciones |
   | `ahorro_mensual_estimado` | `ingreso − totalGastos` |
   | `porcentaje_gastos_ingreso` | `totalGastos / ingreso × 100` |

3. **Pide el análisis de perfil** al modelo (`POST /analysis`) y mapea su respuesta:
   perfil financiero, financial score, nivel de riesgo, explicación, fortalezas,
   oportunidades de mejora y recomendaciones.

4. Si el ML falla en este paso → calcula el perfil con las **reglas** internas
   (`clasificarPerfil`, `calcularProbabilidad`, etc.). El campo `motorAnalisis`
   indica de dónde salió: `"ML"` o `"reglas"`.

5. **Persiste** el análisis en `perfiles_historial` (si el usuario existe en la BD).

---

## 📁 Archivos que componen la integración

Todo en `backend/src/main/java/com/financeai/`:

| Archivo | Rol |
|---------|-----|
| `service/MlService.java` | **Cliente HTTP** hacia el FastAPI (RestClient con timeouts, health-check). |
| `dto/ml/MlAnalysisRequest.java` | Cuerpo del `POST /analysis` (snake_case). |
| `dto/ml/MlTransaccion.java` | Transacción en el formato del ML. |
| `dto/ml/MlAnalysisResponse.java` | Respuesta del `POST /analysis`. |
| `dto/ml/MlPredictResponse.java` | Respuesta del `POST /predict/category`. |
| `service/AnalisisService.java` | **Orquestador**: ML + fallback a reglas + umbral de confianza. |
| `dto/TransaccionDTO.java` | Se le añadieron campos opcionales `fecha`, `medioPago`, `recurrente`. |
| `dto/AnalisisResponse.java` | Se le añadieron los campos ricos del ML (`financialScore`, `scoreStatus`, `explicacion`, `fortalezas`, `oportunidadesMejora`, `motorAnalisis`). |
| `controller/AnalisisController.java` | `GET /api/clasificar` ahora usa el modelo (con fallback). |

Configuración en `backend/src/main/resources/application.yml`:

```yaml
ml:
  service:
    enabled: true                              # apagar para forzar solo reglas
    url: http://127.0.0.1:8000                 # dónde vive el FastAPI
    connect-timeout-ms: 2000
    read-timeout-ms: 5000
    classification-confidence-threshold: 0.5   # confianza mínima para creerle al modelo
```

---

## 🛡️ Resiliencia (clave para la demo)

El backend **nunca se cae** aunque el ML esté apagado:

| Situación | Qué pasa |
|-----------|----------|
| ML arriba y seguro | Usa el modelo. `motorAnalisis: "ML"`. |
| ML arriba pero poco seguro en una categoría | Esa transacción se clasifica con la regla. |
| ML caído / timeout | Todo se resuelve con reglas. `motorAnalisis: "reglas"`. |
| `ml.service.enabled: false` | Se ignora el ML por completo (solo reglas). |

**Probado:** apagando el FastAPI, `POST /api/analisis-financiero` sigue devolviendo
un análisis válido con `motorAnalisis: "reglas"` (sin errores 500).

---

## 📝 Contrato que el frontend debe respetar

El front llama a `POST /api/analisis-financiero`. El backend **valida** la entrada;
si no se respeta, responde **400** y el front muestra "No se pudo completar el análisis".
Reglas:

| Campo | Regla | Valores válidos |
|-------|-------|-----------------|
| `ingresoMensual` | obligatorio, ≥ 0 (el ML además exige **> 0**) | ej. `4500` |
| `nivelEndeudamiento` | obligatorio, 0–100 | ej. `25` |
| `frecuenciaAhorro` | obligatorio | **`Alta` · `Media` · `Baja` · `Nunca`** (NO "Mensual"/"Semanal") |
| `transacciones` | al menos una | cada `valor` **> 0** (todo es gasto; sin ingresos ni negativos) |
| `fecha`, `medioPago`, `recurrente` | opcionales | el backend pone defaults |

> ⚠️ Errores típicos ya corregidos en `frontend/src/pages/Finance/Analisis.tsx`:
> el `<select>` de frecuencia usaba "Mensual" (inválido) y las transacciones de
> ejemplo incluían un ingreso ("Salario") y montos negativos. Ambos causaban 400.

El front ya muestra los campos del modelo (`financialScore`, `scoreStatus`,
`explicacion`) y un badge `motor: ML | reglas`.

## 🧯 Manejo de errores (respuestas claras)

`GlobalExceptionHandler` devuelve JSON estructurado y con el código correcto:

| Situación | Código | Antes |
|-----------|--------|-------|
| Método incorrecto (GET a un POST) | **405** Method Not Allowed | daba 500 confuso |
| Recurso inexistente (`/favicon.ico`) | **404** Not Found | daba 500 y ensuciaba logs |
| Body inválido (`@Valid`) | **400** con `validationErrors` | igual |

---

### Cómo cambiar los puertos

Si tienen algún puerto ocupado se puede cambiar sin problema. Lo único importante es que los puntos que dependen entre sí queden coherentes:

| Qué | Dónde se cambia | Por defecto |
|-----|-----------------|-------------|
| Puerto del backend | `backend/src/main/resources/application.yml` → `server.port` | 8080 |
| A qué puerto le pega el front | `frontend/src/services/api.ts` → `API_BASE` | http://localhost:8081/api |
| Puerto del microservicio de ML | `application.yml` → `ml.service.url` | 8000 |
| Puerto del front (Vite) | no está fijado; se cambia al vuelo con `npm run dev -- --port XXXX` | 5173 |
