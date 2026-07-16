# FinancialAI ML Service

## Requisitos

- Python 3.12

## Instalación

### 1. Crear entorno virtual

```bash
py -3.12 -m venv .venv
```

### 2. Activar el entorno

**Windows PowerShell**

```powershell
.\.venv\Scripts\Activate.ps1
```

### 3. (Opcional) Actualizar pip

```bash
python -m pip install --upgrade pip
```

### 4. Instalar dependencias

```bash
python -m pip install -r requirements.txt
```

### 5. Ejecutar el servicio

```bash
python -m uvicorn app.main:app --reload --port 8000
```

## Documentación Swagger

```
http://127.0.0.1:8000/docs
```

## Endpoints

| Método | Endpoint | Descripción |
|---------|----------|-------------|
| GET | `/health` | Verifica el estado del servicio |
| POST | `/predict/category` | Clasifica una transacción |
| GET | `/analysis/users/{usuario_id}` | Análisis usando el dataset sintético |
| POST | `/analysis` | Endpoint principal para integración con Spring Boot |

## Versiones utilizadas

- Python 3.12
- FastAPI
- Scikit-Learn 1.6.1
- Pandas 2.2.3
- NumPy 2.2.5
- Joblib 1.4.2