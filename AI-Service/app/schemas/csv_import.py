from pydantic import BaseModel


class CSVUsuarioData(BaseModel):
    usuario_id: str
    ingreso_mensual: float
    gasto_mensual_promedio: float
    deuda_mensual: float
    ahorro_mensual_estimado: float
    porcentaje_gastos_ingreso: float
    nivel_endeudamiento: float
    porcentaje_ahorro_ingreso: float
    frecuencia_ahorro: str
    perfil_financiero: str
    estado: str


class CSVTransactionData(BaseModel):
    transaction_id: str
    usuario_id: str
    fecha: str
    descripcion: str
    monto: float
    moneda: str
    tipo: str
    categoria: str
    medio_pago: str
    recurrente: bool
    origen: str


class CSVSummary(BaseModel):
    cantidad_transacciones: int
    cantidad_meses: int
    total_ingresos: float
    total_gastos: float
    moneda: str


class CSVProcessResponse(BaseModel):
    valido: bool = True
    usuario: CSVUsuarioData
    transacciones: list[CSVTransactionData]
    resumen: CSVSummary
