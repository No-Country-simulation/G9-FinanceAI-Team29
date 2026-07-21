from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


ROOT_DIR = Path(__file__).resolve().parents[2]

USUARIOS_CSV = (
    ROOT_DIR
    / "DataScience"
    / "data"
    / "raw"
    / "usuarios_sinteticos.csv"
)

TRANSACCIONES_CSV = (
    ROOT_DIR
    / "DataScience"
    / "data"
    / "raw"
    / "transacciones_sinteticas.csv"
)

ENV_FILE = ROOT_DIR / ".env"


def cargar_configuracion() -> str:
    load_dotenv(ENV_FILE, override=True)

    database_url = os.getenv("DATABASE_URL")

    if not database_url:
        raise ValueError(
            f"No se encontró DATABASE_URL en {ENV_FILE}"
        )

    database_url = database_url.strip()

    if database_url.startswith("postgresql://"):
        database_url = database_url.replace(
            "postgresql://",
            "postgresql+psycopg://",
            1,
        )

    if not database_url.startswith("postgresql+psycopg://"):
        raise ValueError(
            "DATABASE_URL debe comenzar con "
            "'postgresql+psycopg://'"
        )

    return database_url


def validar_archivos() -> None:
    archivos = [USUARIOS_CSV, TRANSACCIONES_CSV]

    for archivo in archivos:
        if not archivo.exists():
            raise FileNotFoundError(
                f"No se encontró el archivo: {archivo}"
            )


def validar_columnas(
    dataframe: pd.DataFrame,
    columnas_requeridas: set[str],
    nombre_archivo: str,
) -> None:
    faltantes = columnas_requeridas - set(dataframe.columns)

    if faltantes:
        raise ValueError(
            f"{nombre_archivo} no contiene estas columnas: "
            f"{sorted(faltantes)}"
        )


def normalizar_booleano(valor: object) -> bool:
    if pd.isna(valor):
        return False

    if isinstance(valor, bool):
        return valor

    return str(valor).strip().lower() in {
        "true",
        "1",
        "si",
        "sí",
        "yes",
    }


def preparar_usuarios() -> pd.DataFrame:
    usuarios = pd.read_csv(USUARIOS_CSV)

    columnas_requeridas = {
        "usuario_id",
        "ingreso_mensual",
        "deuda_mensual",
        "nivel_endeudamiento",
        "gasto_mensual_promedio",
        "ahorro_mensual_estimado",
        "porcentaje_gastos_ingreso",
        "frecuencia_ahorro",
        "perfil_financiero",
    }

    validar_columnas(
        usuarios,
        columnas_requeridas,
        USUARIOS_CSV.name,
    )

    usuarios = usuarios.rename(
        columns={"usuario_id": "id"}
    )

    usuarios["fecha_registro"] = datetime.now()
    usuarios["activo"] = True

    columnas_finales = [
        "id",
        "ingreso_mensual",
        "deuda_mensual",
        "nivel_endeudamiento",
        "gasto_mensual_promedio",
        "ahorro_mensual_estimado",
        "porcentaje_gastos_ingreso",
        "frecuencia_ahorro",
        "perfil_financiero",
        "fecha_registro",
        "activo",
    ]

    return usuarios[columnas_finales]


def preparar_transacciones() -> pd.DataFrame:
    transacciones = pd.read_csv(TRANSACCIONES_CSV)

    columnas_requeridas = {
        "transaction_id",
        "usuario_id",
        "fecha",
        "descripcion",
        "monto",
        "moneda",
        "tipo",
        "categoria",
        "recurrente",
        "medio_pago",
    }

    validar_columnas(
        transacciones,
        columnas_requeridas,
        TRANSACCIONES_CSV.name,
    )

    transacciones = transacciones.rename(
        columns={"transaction_id": "id"}
    )

    transacciones["fecha"] = pd.to_datetime(
        transacciones["fecha"],
        errors="raise",
    ).dt.date

    transacciones["recurrente"] = transacciones[
        "recurrente"
    ].apply(normalizar_booleano)

    transacciones["origen"] = "CSV"

    return transacciones


def insertar_categorias(
    engine: Engine,
    transacciones: pd.DataFrame,
) -> dict[str, int]:
    categorias = sorted(
        transacciones["categoria"]
        .dropna()
        .astype(str)
        .str.strip()
        .unique()
    )

    with engine.begin() as connection:
        for categoria in categorias:
            connection.execute(
                text(
                    """
                    INSERT INTO categorias (
                        nombre,
                        descripcion,
                        icono,
                        color
                    )
                    VALUES (
                        :nombre,
                        :descripcion,
                        :icono,
                        :color
                    )
                    ON CONFLICT (nombre) DO NOTHING
                    """
                ),
                {
                    "nombre": categoria,
                    "descripcion": f"Categoría {categoria}",
                    "icono": "wallet",
                    "color": "#64748B",
                },
            )

        filas = connection.execute(
            text(
                """
                SELECT id, nombre
                FROM categorias
                """
            )
        ).mappings()

        return {
            str(fila["nombre"]): int(fila["id"])
            for fila in filas
        }


def insertar_usuarios(
    engine: Engine,
    usuarios: pd.DataFrame,
) -> None:
    registros = usuarios.to_dict(orient="records")

    consulta = text(
        """
        INSERT INTO usuarios (
            id,
            ingreso_mensual,
            deuda_mensual,
            nivel_endeudamiento,
            gasto_mensual_promedio,
            ahorro_mensual_estimado,
            porcentaje_gastos_ingreso,
            frecuencia_ahorro,
            perfil_financiero,
            fecha_registro,
            activo
        )
        VALUES (
            :id,
            :ingreso_mensual,
            :deuda_mensual,
            :nivel_endeudamiento,
            :gasto_mensual_promedio,
            :ahorro_mensual_estimado,
            :porcentaje_gastos_ingreso,
            :frecuencia_ahorro,
            :perfil_financiero,
            :fecha_registro,
            :activo
        )
        ON CONFLICT (id) DO UPDATE SET
            ingreso_mensual = EXCLUDED.ingreso_mensual,
            deuda_mensual = EXCLUDED.deuda_mensual,
            nivel_endeudamiento =
                EXCLUDED.nivel_endeudamiento,
            gasto_mensual_promedio =
                EXCLUDED.gasto_mensual_promedio,
            ahorro_mensual_estimado =
                EXCLUDED.ahorro_mensual_estimado,
            porcentaje_gastos_ingreso =
                EXCLUDED.porcentaje_gastos_ingreso,
            frecuencia_ahorro =
                EXCLUDED.frecuencia_ahorro,
            perfil_financiero =
                EXCLUDED.perfil_financiero,
            activo = EXCLUDED.activo
        """
    )

    with engine.begin() as connection:
        connection.execute(consulta, registros)


def insertar_transacciones(
    engine: Engine,
    transacciones: pd.DataFrame,
    categorias: dict[str, int],
    tamano_lote: int = 1000,
) -> None:
    transacciones = transacciones.copy()

    transacciones["categoria_id"] = (
        transacciones["categoria"]
        .astype(str)
        .str.strip()
        .map(categorias)
    )

    if transacciones["categoria_id"].isna().any():
        categorias_faltantes = (
            transacciones.loc[
                transacciones["categoria_id"].isna(),
                "categoria",
            ]
            .drop_duplicates()
            .tolist()
        )

        raise ValueError(
            "No se encontraron IDs para estas categorías: "
            f"{categorias_faltantes}"
        )

    columnas_finales = [
        "id",
        "usuario_id",
        "categoria_id",
        "descripcion",
        "monto",
        "moneda",
        "recurrente",
        "medio_pago",
        "fecha",
        "tipo",
        "origen",
    ]

    transacciones = transacciones[columnas_finales]

    consulta = text(
        """
        INSERT INTO transacciones (
            id,
            usuario_id,
            categoria_id,
            descripcion,
            monto,
            moneda,
            recurrente,
            medio_pago,
            fecha,
            tipo,
            origen
        )
        VALUES (
            :id,
            :usuario_id,
            :categoria_id,
            :descripcion,
            :monto,
            :moneda,
            :recurrente,
            :medio_pago,
            :fecha,
            :tipo,
            :origen
        )
        ON CONFLICT (id) DO UPDATE SET
            usuario_id = EXCLUDED.usuario_id,
            categoria_id = EXCLUDED.categoria_id,
            descripcion = EXCLUDED.descripcion,
            monto = EXCLUDED.monto,
            moneda = EXCLUDED.moneda,
            recurrente = EXCLUDED.recurrente,
            medio_pago = EXCLUDED.medio_pago,
            fecha = EXCLUDED.fecha,
            tipo = EXCLUDED.tipo,
            origen = EXCLUDED.origen
        """
    )

    total = len(transacciones)

    with engine.begin() as connection:
        for inicio in range(0, total, tamano_lote):
            fin = min(inicio + tamano_lote, total)

            lote = transacciones.iloc[inicio:fin].to_dict(
                orient="records"
            )

            connection.execute(consulta, lote)

            print(
                f"Transacciones cargadas: {fin}/{total}",
                flush=True,
            )


def mostrar_totales(engine: Engine) -> None:
    with engine.connect() as connection:
        usuarios = connection.execute(
            text("SELECT COUNT(*) FROM usuarios")
        ).scalar_one()

        categorias = connection.execute(
            text("SELECT COUNT(*) FROM categorias")
        ).scalar_one()

        transacciones = connection.execute(
            text("SELECT COUNT(*) FROM transacciones")
        ).scalar_one()

    print()
    print("Carga finalizada correctamente.")
    print(f"Usuarios en la base: {usuarios}")
    print(f"Categorías en la base: {categorias}")
    print(f"Transacciones en la base: {transacciones}")


def main() -> None:
    print("Iniciando carga de datos en Supabase...")
    print(f"Usuarios: {USUARIOS_CSV}")
    print(f"Transacciones: {TRANSACCIONES_CSV}")

    validar_archivos()

    database_url = cargar_configuracion()
    engine = create_engine(
        database_url,
        pool_pre_ping=True,
    )

    print("Leyendo archivos CSV...")
    usuarios = preparar_usuarios()
    transacciones = preparar_transacciones()

    print(f"Usuarios encontrados: {len(usuarios)}")
    print(
        "Transacciones encontradas: "
        f"{len(transacciones)}"
    )

    print("Insertando categorías...")
    categorias = insertar_categorias(
        engine,
        transacciones,
    )

    print(f"Categorías disponibles: {len(categorias)}")

    print("Insertando usuarios...")
    insertar_usuarios(engine, usuarios)

    print("Insertando transacciones...")
    insertar_transacciones(
        engine,
        transacciones,
        categorias,
    )

    mostrar_totales(engine)


if __name__ == "__main__":
    main()