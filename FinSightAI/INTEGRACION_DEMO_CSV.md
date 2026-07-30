# FinSightAI — demo de importación CSV (USR1001)

Este paquete contiene una integración vertical mínima para mostrar hoy:

1. El frontend abre **Importar CSV**.
2. Envía el archivo al backend mediante `POST /api/usuarios/USR1001/importar-csv`.
3. El backend reenvía el archivo al AI-Service mediante `POST /csv/procesar`.
4. El AI-Service valida, normaliza y calcula el perfil.
5. El backend crea/actualiza `USR1001`, reemplaza sus transacciones y guarda todo en Supabase/PostgreSQL.
6. El admin puede seleccionar **CSV demo · USR1001** y recorrer dashboard, transacciones e IA.

## Orden de arranque local

### AI-Service

```bash
cd AI-Service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Backend

Debe tener:

```env
ML_SERVICE_URL=http://127.0.0.1:8000
```

Luego ejecutar Spring Boot en el puerto 8081.

### Frontend

Debe tener:

```env
VITE_API_URL=http://localhost:8081/api
VITE_AI_URL=http://localhost:8000
```

Luego:

```bash
npm install
npm run dev
```

## CSV aceptado

```csv
fecha,descripcion,monto,tipo,categoria,medio_pago,recurrente
2026-07-01,Sueldo mensual,3000.00,INGRESO,Salario,Transferencia,Si
```

No lleva columna moneda: se guarda automáticamente como `USD`.

## Repetir o limpiar la demo

Volver a importar reemplaza las transacciones anteriores de `USR1001`, así que pueden ensayar varias veces sin acumular movimientos.

Para borrar por completo el usuario de prueba después de ensayar:

```sql
DELETE FROM transacciones WHERE usuario_id = 'USR1001';
DELETE FROM usuarios WHERE id = 'USR1001';
```

No borren categorías porque pueden estar compartidas con otros usuarios.

## Archivos principales modificados

### Frontend
- `src/pages/Finance/ImportarCsv.tsx`
- `src/services/api.ts`
- `src/App.tsx`
- `src/layout/AppSidebar.tsx`
- `src/context/AuthContext.tsx`
- `public/plantilla_movimientos_usuario.csv`

### Backend
- `controller/CsvImportController.java`
- `service/CsvImportService.java`
- `dto/csv/CsvImportResponse.java`
- `CategoriaRepository.java`
- `TransaccionRepository.java`

### AI-Service
- Endpoint `/csv/procesar` y procesador CSV incluidos en el paquete anterior.
