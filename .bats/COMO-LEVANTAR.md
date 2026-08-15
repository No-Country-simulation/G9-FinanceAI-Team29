# 🚀 Cómo levantar FinSightAI en tu compu

Guía para correr **todo el proyecto** (frontend + backend + IA + base de datos) en tu máquina con un comando. No necesitás instalar Java, Node ni Python: **todo corre en Docker**.

---

## 1. Requisitos (una sola vez)

- **Docker Desktop** → https://www.docker.com/products/docker-desktop/ (Windows/Mac). Instalalo y abrilo al menos una vez.
- **Git** → para clonar el repo.

## 2. Clonar el repo

```bash
git clone <URL-del-repo>
cd G9-FinanceAI-Team29
git checkout migración-OCI
```

## 3. Poner los archivos `.env` (¡importante!)

Los `.env` tienen **claves privadas**, así que **NO están en el repo**. Pedíselos a tu líder y colocalos tal cual acá:

```
Backend/backend/.env      <- token de servicio, Resend, VAPID, etc.
AI-Service/.env           <- claves de Groq (chat con IA), etc.
frontend/.env             <- clave pública de push (opcional)
```

> Si te falta alguno, el `levantar.bat` te avisa cuál. Sin el de `AI-Service` el chat con IA no responde; el resto igual funciona.
> Cada carpeta tiene un `.env.example` de referencia con los nombres de las variables.

## 4. Levantar

- **Windows:** doble-click en **`levantar.bat`** (abre Docker si está cerrado, construye y levanta todo, y te abre la app).
- **Mac/Linux o consola:**
  ```bash
  docker compose up -d --build
  ```

La primera vez tarda unos minutos (baja imágenes y construye). Las siguientes es casi instantáneo.

## 5. Usar la app

| Qué | Dónde |
|---|---|
| **App** | http://localhost |
| Consola de MinIO (storage local) | http://localhost:9001 · user/pass: `minioadmin` |

## 6. Apagar

- **Windows:** doble-click en **`apagar.bat`**.
- **Consola:** `docker compose stop`

Los datos (usuarios, transacciones, etc.) **se conservan** entre apagadas.

---

## Comandos útiles

```bash
docker compose ps                 # ver estado de los contenedores
docker compose logs -f backend    # ver logs del backend en vivo
docker compose logs -f ai-service # ver logs del servicio de IA
docker compose down               # apagar y BORRAR contenedores (los datos quedan en volúmenes)
docker compose up -d --build      # reconstruir tras cambios de código

# meterse a la base de datos:
docker compose exec postgres psql -U finsight -d finsight
#   dentro:  \dt   (listar tablas)   ·   \d usuarios   (columnas)
```

## Problemas comunes

- **"docker: command not found" / no conecta:** abrí Docker Desktop y esperá que diga *Running*.
- **`levantar.bat` avisa que falta un `.env`:** pedíselo a tu líder y ponelo en la carpeta que indica.
- **La app carga pero el chat de IA falla:** falta `AI-Service/.env` o su clave de Groq.
- **Cambió el código y no se refleja:** corré `docker compose up -d --build` (rebuild).
