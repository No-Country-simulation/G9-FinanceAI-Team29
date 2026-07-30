\# 🚀 Levantar AI-Service desde cero



\## Requisitos



\- Python 3.12+

\- Acceso a las variables de entorno del proyecto



\---



\## 1. Entrar al proyecto



```powershell

cd AI-Service

```



\---



\## 2. Crear el entorno virtual



Solo la primera vez:



```powershell

py -3.12 -m venv .venv

```



Si no funciona `py -3.12`, comprobar las versiones instaladas:



```powershell

py -0p

```



\---



\## 3. Activar el entorno virtual



```powershell

.venv\\\\Scripts\\\\Activate.ps1

```



Si PowerShell bloquea la ejecución:



```powershell

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

```



Y volver a activar:



```powershell

.venv\\\\Scripts\\\\Activate.ps1

```



\---



\## 4. Instalar dependencias



```powershell

python -m pip install --upgrade pip

pip install -r requirements.txt

```



\---



\## 5. Crear el archivo `.env`



El archivo `.env` no se sube al repositorio.



por eso lo incluyo aqui



Completar también cualquier variable de Supabase o base de datos que use el proyecto actual.



\---



\## 6. Levantar FastAPI



```powershell

uvicorn app.main:app --reload

```



Si `uvicorn` no es reconocido:



```powershell

python -m uvicorn app.main:app --reload

```



\---



\## 7. Abrir Swagger



```text

http://127.0.0.1:8000/docs

```



\---



\## 8. Probar el agente IA



Buscar:



```text

POST /agent/chat

```



Usar:



```json

{

\&#x20; "usuario\\\_id": "USR0001",

\&#x20; "question": "¿Cómo está mi situación financiera?"

}

```



\---



\## 9. Probar otro usuario



Cambiar únicamente el `usuario\\\_id`:



```json

{

\&#x20; "usuario\\\_id": "USR0042",

\&#x20; "question": "¿En qué estoy gastando más dinero?"

}

```



El usuario debe existir en los datos disponibles para el AI-Service.



\---



\## 10. Detener el servidor



En la terminal:



```text

Ctrl + C

```



\---



\# Inicio habitual



Después de la primera instalación, solo hace falta:



```powershell

cd AI-Service

.venv\\\\Scripts\\\\Activate.ps1

python -m uvicorn app.main:app --reload

```



\---



\# Si el entorno virtual se rompe



Eliminarlo:



```powershell

Remove-Item -Recurse -Force .venv

```



Volver a crearlo:



```powershell

py -3.12 -m venv .venv

.venv\\\\Scripts\\\\Activate.ps1

python -m pip install --upgrade pip

pip install -r requirements.txt

```



\---



\# URLs



| Servicio | URL |

|---|---|

| AI-Service | http://127.0.0.1:8000 |

| Swagger | http://127.0.0.1:8000/docs |



\---



\# Importante



\- No usar Python 3.14 para este proyecto.

\- Usar Python 3.12.

\- El `.env` no se commitea.

\- Las API keys no deben compartirse en GitHub.

\- Si aparece `GEMINI\\\_API\\\_KEY no está configurada`, revisar que `LLM\\\_PROVIDER=groq` o agregar la clave de Gemini.

