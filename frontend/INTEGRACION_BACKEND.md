# Integración del historial con Spring Boot

El módulo **Movimientos** ahora es de solo lectura y consume:

```http
GET /api/usuarios/{usuarioId}/transacciones
```

## Ejecución local

1. Iniciar Spring Boot en `http://localhost:8080`.
2. Opcionalmente, copiar `.env.example` como `.env`.
3. Ejecutar:

```bash
npm install
npm run dev
```

Valores predeterminados:

```env
VITE_API_URL=http://localhost:8080/api
VITE_USER_ID=USR0001
```

Cuando exista login, `VITE_USER_ID` será reemplazado por el ID del usuario autenticado.
