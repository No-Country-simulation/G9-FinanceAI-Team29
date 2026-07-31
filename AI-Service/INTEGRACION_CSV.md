# Importación CSV de usuarios reales

## Endpoint

`POST /csv/procesar`

Content-Type: `multipart/form-data`

Campos:

- `usuario_id`: por ejemplo `USR1001`
- `archivo`: archivo `.csv`

## Plantilla aceptada

```csv
fecha,descripcion,monto,tipo,categoria,medio_pago,recurrente
2026-07-01,Sueldo mensual,3000.00,INGRESO,Salario,Transferencia,Si
2026-07-03,Supermercado,180.50,GASTO,Alimentacion,Tarjeta de debito,No
```

La moneda no se recibe desde el archivo: todas las transacciones se normalizan como `USD`.

## Respuesta

El AI-Service devuelve:

- `usuario`: métricas compatibles con `usuarios_sinteticos.csv`.
- `transacciones`: filas compatibles con la preparación del script `cargar_supabase.py`.
- `resumen`: totales útiles para la vista previa del frontend.

El backend debe guardar la respuesta en Supabase. El AI-Service no escribe directamente en la base para evitar mezclar credenciales y responsabilidades.

## Ejemplo con curl

```bash
curl -X POST http://localhost:8000/csv/procesar \
  -F usuario_id=USR1001 \
  -F archivo=@data/templates/plantilla_movimientos_usuario.csv
```

## Cálculos

Los importes se promedian por mes. Los gastos asociados a deuda se separan de los gastos comunes usando categorías como `Deudas`, `Prestamos`, `Credito`, `Cuotas` o `Tarjeta de credito`.

- ahorro estimado = ingreso - gasto común - deuda
- porcentaje de gastos = gasto común / ingreso
- endeudamiento = deuda / ingreso
- porcentaje de ahorro = ahorro / ingreso

Las clasificaciones de frecuencia y perfil usan los cortes principales observados en el dataset sintético.
