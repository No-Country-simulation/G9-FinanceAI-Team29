from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.agent import router as agent_router
from app.api.analysis import router as analysis_router
from app.api.category import router as category_router
from app.api.goals import router as goals_router
from app.api.health import router as health_router
from app.config import settings


logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.knowledge_dir.mkdir(
        parents=True,
        exist_ok=True,
    )
    settings.vector_store_dir.mkdir(
        parents=True,
        exist_ok=True,
    )
    settings.models_dir.mkdir(
        parents=True,
        exist_ok=True,
    )
    settings.goals_storage_path.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    logger.info(
        "Iniciando %s %s",
        settings.app_name,
        settings.app_version,
    )

    yield

    logger.info(
        "Finalizando %s",
        settings.app_name,
    )


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Microservicio de inteligencia de FinSightAI para clasificación "
        "de transacciones, análisis financiero y educación financiera con RAG."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health_router)
app.include_router(category_router)
app.include_router(analysis_router)
app.include_router(agent_router)
app.include_router(goals_router)


@app.get(
    "/",
    tags=["Root"],
)
def root() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "status": "running",
        "documentation": "/docs",
    }