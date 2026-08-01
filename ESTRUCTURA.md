# Estructura de FinSightAI

- `Frontend/`: React + Vite. Instalar con `npm install` y ejecutar con `npm run dev`.
- `Backend/backend/`: Spring Boot. Ejecutar con `mvn spring-boot:run`.
- `AI-Service/`: FastAPI y modelos de inferencia. Usa Python 3.12.
- `AI-Service/data/processed/`: datasets de features requeridos durante la ejecución.
- `AI-Service/models/`: modelos serializados usados por FastAPI.
- `DataScience/data/raw/`: datasets sintéticos originales.
- `DataScience/data/processed/`: datasets procesados producidos por el notebook.
- `DataScience/models/`: copia de los artefactos generados por Data Science.
- `DataScience/archive/`: servicio ML anterior conservado como referencia.
- `scripts/database/`: scripts auxiliares de carga a Supabase.

## AI-Service

```powershell
cd G:\FinSight\AI-Service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

## Frontend

```powershell
cd G:\FinSight\Frontend
npm install
npm run dev
```

## Backend

```powershell
cd G:\FinSight\Backend\backend
mvn spring-boot:run
```
