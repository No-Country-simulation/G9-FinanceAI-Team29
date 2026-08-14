"""
Sincronización de los modelos .joblib desde Object Storage (S3-compatible: OCI / MinIO).

Idea: en vez de tener el modelo empaquetado en la imagen, el AI-Service lo BAJA del bucket
al arrancar. Así data-science puede actualizar el modelo sin re-deployar.

Es configurable y con fallback: si no hay Object Storage configurado (o falla la descarga),
se usan los .joblib empaquetados que vinieron en la imagen. Así en local anda sin bucket.

IMPORTANTE: `ensure_models()` debe llamarse ANTES de importar los módulos que cargan los
modelos (prediction.py / profile.py los cargan al importarse). Por eso se invoca al inicio
de app/main.py, antes de importar los routers.
"""

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

# Los binarios que vive en el bucket (y que ya vienen empaquetados como fallback).
NOMBRES_MODELOS = ["clasificador_gastos.joblib", "clasificador_perfil.joblib"]

# app/model_sync.py → parent.parent = raíz del servicio; los modelos viven en ./models
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"


def _env(nombre: str, defecto: str = "") -> str:
    return os.getenv(nombre, defecto).strip()


def ensure_models() -> None:
    """Descarga los modelos desde Object Storage si está configurado; si no, usa los empaquetados."""
    endpoint = _env("MODELS_S3_ENDPOINT")
    bucket = _env("MODELS_S3_BUCKET")
    access = _env("MODELS_S3_ACCESS_KEY")
    secret = _env("MODELS_S3_SECRET_KEY")

    if not (endpoint and bucket and access and secret):
        logger.info("[models] Object Storage no configurado — uso los modelos empaquetados.")
        return

    try:
        import boto3
        from botocore.client import Config
    except ImportError:
        logger.warning("[models] boto3 no está instalado — uso los modelos empaquetados.")
        return

    prefix = _env("MODELS_S3_PREFIX").strip("/")
    region = _env("MODELS_S3_REGION") or "us-east-1"

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access,
            aws_secret_access_key=secret,
            region_name=region,
            config=Config(signature_version="s3v4"),
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[models] No se pudo crear el cliente S3 (%s) — uso los empaquetados.", e)
        return

    for nombre in NOMBRES_MODELOS:
        key = f"{prefix}/{nombre}" if prefix else nombre
        destino = MODELS_DIR / nombre
        try:
            s3.download_file(bucket, key, str(destino))
            logger.info("[models] Descargado %s desde s3://%s/%s", nombre, bucket, key)
        except Exception as e:  # noqa: BLE001
            # No es fatal: si ya existe el empaquetado, se sigue usando ese.
            existe = destino.exists()
            logger.warning(
                "[models] No se pudo bajar %s de Object Storage (%s). %s",
                nombre, e,
                "Uso el empaquetado." if existe else "¡Y no hay empaquetado de fallback!",
            )
