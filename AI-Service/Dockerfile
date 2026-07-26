FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app
COPY models ./models
COPY data ./data
COPY storage ./storage

# Render/hosts inyectan el puerto en $PORT; localmente cae a 8000.
ENV PORT=8000
EXPOSE 8000

# Forma shell para que ${PORT} se expanda en runtime.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
