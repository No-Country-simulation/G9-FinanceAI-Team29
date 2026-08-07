from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


# ============================================================
# Configuración
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

RUTA_MODELO_GASTOS = MODELS_DIR / "clasificador_gastos.joblib"

MODELO_VERSION = "8.1.0"

UMBRAL_FUZZY_FUERTE = 0.90
UMBRAL_FUZZY_CORTO = 0.94
UMBRAL_CONFIANZA_BAJA = 0.45
UMBRAL_CONFIANZA_MEDIA = 0.65

modelo_gastos = joblib.load(RUTA_MODELO_GASTOS)


# ============================================================
# Reglas de dominio
# ============================================================
#
# termino -> {
#     "descripcion": descripción canónica para el modelo,
#     "categoria": categoría principal,
#     "subcategoria": subcategoría explicativa,
# }
#
# IMPORTANTE:
# - La categoría principal sigue siendo compatible con el sistema actual.
# - La subcategoría NO necesita existir en la base de datos.
# - Se calcula en memoria y puede ser ignorada por frontend/backend antiguos.
# ============================================================

REGLAS_TERMINOS: dict[str, dict[str, str]] = {
    # --------------------------------------------------------
    # Alimentación
    # --------------------------------------------------------
    "verduleria": {
        "descripcion": "verduleria",
        "categoria": "Alimentación",
        "subcategoria": "Verdulería",
    },
    "fruteria": {
        "descripcion": "fruteria",
        "categoria": "Alimentación",
        "subcategoria": "Frutería",
    },
    "carniceria": {
        "descripcion": "carniceria",
        "categoria": "Alimentación",
        "subcategoria": "Carnicería",
    },
    "panaderia": {
        "descripcion": "panaderia",
        "categoria": "Alimentación",
        "subcategoria": "Panadería",
    },
    "fiambreria": {
        "descripcion": "fiambreria",
        "categoria": "Alimentación",
        "subcategoria": "Fiambrería",
    },
    "polleria": {
        "descripcion": "polleria",
        "categoria": "Alimentación",
        "subcategoria": "Pollería",
    },
    "pescaderia": {
        "descripcion": "pescaderia",
        "categoria": "Alimentación",
        "subcategoria": "Pescadería",
    },
    "supermercado": {
        "descripcion": "supermercado",
        "categoria": "Alimentación",
        "subcategoria": "Supermercado",
    },
    "autoservicio": {
        "descripcion": "autoservicio",
        "categoria": "Alimentación",
        "subcategoria": "Supermercado",
    },
    "despensa": {
        "descripcion": "despensa",
        "categoria": "Alimentación",
        "subcategoria": "Almacén y despensa",
    },
    "almacen": {
        "descripcion": "almacen",
        "categoria": "Alimentación",
        "subcategoria": "Almacén y despensa",
    },
    "restaurante": {
        "descripcion": "restaurante",
        "categoria": "Alimentación",
        "subcategoria": "Restaurante",
    },
    "cafeteria": {
        "descripcion": "cafeteria",
        "categoria": "Alimentación",
        "subcategoria": "Cafetería",
    },
    "heladeria": {
        "descripcion": "heladeria",
        "categoria": "Alimentación",
        "subcategoria": "Heladería",
    },
    "pizzeria": {
        "descripcion": "pizzeria",
        "categoria": "Alimentación",
        "subcategoria": "Restaurante",
    },
    "rotiseria": {
        "descripcion": "rotiseria",
        "categoria": "Alimentación",
        "subcategoria": "Comida preparada",
    },
    "comida rapida": {
        "descripcion": "comida rapida",
        "categoria": "Alimentación",
        "subcategoria": "Comida rápida",
    },
    "pedido de comida": {
        "descripcion": "pedido de comida",
        "categoria": "Alimentación",
        "subcategoria": "Delivery",
    },
    "delivery": {
        "descripcion": "pedido de comida",
        "categoria": "Alimentación",
        "subcategoria": "Delivery",
    },
    "pedidosya": {
        "descripcion": "pedido de comida",
        "categoria": "Alimentación",
        "subcategoria": "Delivery",
    },
    "rappi": {
        "descripcion": "pedido de comida",
        "categoria": "Alimentación",
        "subcategoria": "Delivery",
    },
    "mcdonalds": {
        "descripcion": "comida rapida",
        "categoria": "Alimentación",
        "subcategoria": "Comida rápida",
    },
    "mcdonald": {
        "descripcion": "comida rapida",
        "categoria": "Alimentación",
        "subcategoria": "Comida rápida",
    },
    "burger king": {
        "descripcion": "comida rapida",
        "categoria": "Alimentación",
        "subcategoria": "Comida rápida",
    },
    "kfc": {
        "descripcion": "comida rapida",
        "categoria": "Alimentación",
        "subcategoria": "Comida rápida",
    },
    "starbucks": {
        "descripcion": "cafeteria",
        "categoria": "Alimentación",
        "subcategoria": "Cafetería",
    },

    # --------------------------------------------------------
    # Transporte
    # --------------------------------------------------------
    "uber": {
        "descripcion": "viaje por aplicacion",
        "categoria": "Transporte",
        "subcategoria": "Viaje por aplicación",
    },
    "cabify": {
        "descripcion": "viaje por aplicacion",
        "categoria": "Transporte",
        "subcategoria": "Viaje por aplicación",
    },
    "didi": {
        "descripcion": "viaje por aplicacion",
        "categoria": "Transporte",
        "subcategoria": "Viaje por aplicación",
    },
    "taxi": {
        "descripcion": "taxi",
        "categoria": "Transporte",
        "subcategoria": "Taxi",
    },
    "remis": {
        "descripcion": "taxi",
        "categoria": "Transporte",
        "subcategoria": "Taxi",
    },
    "transporte publico": {
        "descripcion": "transporte publico",
        "categoria": "Transporte",
        "subcategoria": "Transporte público",
    },
    "autobus": {
        "descripcion": "transporte publico",
        "categoria": "Transporte",
        "subcategoria": "Transporte público",
    },
    "metro": {
        "descripcion": "transporte publico",
        "categoria": "Transporte",
        "subcategoria": "Transporte público",
    },
    "tren": {
        "descripcion": "transporte publico",
        "categoria": "Transporte",
        "subcategoria": "Transporte público",
    },
    "combustible": {
        "descripcion": "combustible",
        "categoria": "Transporte",
        "subcategoria": "Combustible",
    },
    "gasolina": {
        "descripcion": "combustible",
        "categoria": "Transporte",
        "subcategoria": "Combustible",
    },
    "gasoil": {
        "descripcion": "combustible",
        "categoria": "Transporte",
        "subcategoria": "Combustible",
    },
    "estacionamiento": {
        "descripcion": "estacionamiento",
        "categoria": "Transporte",
        "subcategoria": "Estacionamiento",
    },
    "parking": {
        "descripcion": "estacionamiento",
        "categoria": "Transporte",
        "subcategoria": "Estacionamiento",
    },
    "peaje": {
        "descripcion": "peaje",
        "categoria": "Transporte",
        "subcategoria": "Peajes",
    },
    "mantenimiento del vehiculo": {
        "descripcion": "mantenimiento del vehiculo",
        "categoria": "Transporte",
        "subcategoria": "Mantenimiento vehicular",
    },
    "reparacion del vehiculo": {
        "descripcion": "reparacion del vehiculo",
        "categoria": "Transporte",
        "subcategoria": "Mantenimiento vehicular",
    },

    # --------------------------------------------------------
    # Salud
    # --------------------------------------------------------
    "farmacia": {
        "descripcion": "farmacia",
        "categoria": "Salud",
        "subcategoria": "Farmacia",
    },
    "medicamentos": {
        "descripcion": "medicamentos",
        "categoria": "Salud",
        "subcategoria": "Farmacia",
    },
    "medicina": {
        "descripcion": "medicamentos",
        "categoria": "Salud",
        "subcategoria": "Farmacia",
    },
    "consulta medica": {
        "descripcion": "consulta medica",
        "categoria": "Salud",
        "subcategoria": "Consulta médica",
    },
    "medico": {
        "descripcion": "consulta medica",
        "categoria": "Salud",
        "subcategoria": "Consulta médica",
    },
    "hospital": {
        "descripcion": "hospital",
        "categoria": "Salud",
        "subcategoria": "Atención médica",
    },
    "clinica": {
        "descripcion": "clinica",
        "categoria": "Salud",
        "subcategoria": "Atención médica",
    },
    "laboratorio": {
        "descripcion": "laboratorio",
        "categoria": "Salud",
        "subcategoria": "Estudios y laboratorio",
    },
    "odontologia": {
        "descripcion": "odontologia",
        "categoria": "Salud",
        "subcategoria": "Odontología",
    },
    "dentista": {
        "descripcion": "odontologia",
        "categoria": "Salud",
        "subcategoria": "Odontología",
    },
    "psicologia": {
        "descripcion": "psicologia",
        "categoria": "Salud",
        "subcategoria": "Salud mental",
    },
    "psiquiatria": {
        "descripcion": "psiquiatria",
        "categoria": "Salud",
        "subcategoria": "Salud mental",
    },
    "terapia": {
        "descripcion": "terapia",
        "categoria": "Salud",
        "subcategoria": "Salud mental",
    },
    "kinesiologia": {
        "descripcion": "kinesiologia",
        "categoria": "Salud",
        "subcategoria": "Rehabilitación",
    },
    "fisioterapia": {
        "descripcion": "fisioterapia",
        "categoria": "Salud",
        "subcategoria": "Rehabilitación",
    },
    "seguro medico": {
        "descripcion": "seguro de salud",
        "categoria": "Salud",
        "subcategoria": "Seguro médico",
    },
    "seguro de salud": {
        "descripcion": "seguro de salud",
        "categoria": "Salud",
        "subcategoria": "Seguro médico",
    },
    "veterinaria": {
        "descripcion": "consulta veterinaria",
        "categoria": "Salud",
        "subcategoria": "Veterinaria",
    },
    "consulta veterinaria": {
        "descripcion": "consulta veterinaria",
        "categoria": "Salud",
        "subcategoria": "Veterinaria",
    },
    "clinica veterinaria": {
        "descripcion": "consulta veterinaria",
        "categoria": "Salud",
        "subcategoria": "Veterinaria",
    },
    "hospital veterinario": {
        "descripcion": "consulta veterinaria",
        "categoria": "Salud",
        "subcategoria": "Veterinaria",
    },
    "vacuna mascota": {
        "descripcion": "consulta veterinaria",
        "categoria": "Salud",
        "subcategoria": "Veterinaria",
    },
    "vacuna para mascota": {
        "descripcion": "consulta veterinaria",
        "categoria": "Salud",
        "subcategoria": "Veterinaria",
    },
    "medicamentos mascota": {
        "descripcion": "medicamentos para mascota",
        "categoria": "Salud",
        "subcategoria": "Veterinaria",
    },

    # --------------------------------------------------------
    # Vivienda
    # --------------------------------------------------------
    "alquiler": {
        "descripcion": "alquiler",
        "categoria": "Vivienda",
        "subcategoria": "Alquiler",
    },
    "hipoteca": {
        "descripcion": "hipoteca",
        "categoria": "Vivienda",
        "subcategoria": "Hipoteca",
    },
    "renta mensual": {
        "descripcion": "alquiler",
        "categoria": "Vivienda",
        "subcategoria": "Alquiler",
    },
    "mantenimiento del hogar": {
        "descripcion": "mantenimiento del hogar",
        "categoria": "Vivienda",
        "subcategoria": "Mantenimiento",
    },
    "reparacion del hogar": {
        "descripcion": "reparacion del hogar",
        "categoria": "Vivienda",
        "subcategoria": "Mantenimiento",
    },
    "plomeria": {
        "descripcion": "plomeria",
        "categoria": "Vivienda",
        "subcategoria": "Mantenimiento",
    },
    "electricista": {
        "descripcion": "electricista del hogar",
        "categoria": "Vivienda",
        "subcategoria": "Mantenimiento",
    },
    "cerrajeria": {
        "descripcion": "cerrajeria",
        "categoria": "Vivienda",
        "subcategoria": "Mantenimiento",
    },
    "mudanza": {
        "descripcion": "mudanza",
        "categoria": "Vivienda",
        "subcategoria": "Mudanza",
    },
    "muebles": {
        "descripcion": "compra de muebles",
        "categoria": "Vivienda",
        "subcategoria": "Muebles y equipamiento",
    },
    "mobiliario": {
        "descripcion": "compra de muebles",
        "categoria": "Vivienda",
        "subcategoria": "Muebles y equipamiento",
    },
    "electrodomestico": {
        "descripcion": "electrodomestico",
        "categoria": "Vivienda",
        "subcategoria": "Muebles y equipamiento",
    },
    "materiales de construccion": {
        "descripcion": "materiales de construccion",
        "categoria": "Vivienda",
        "subcategoria": "Refacción",
    },

    # --------------------------------------------------------
    # Educación
    # --------------------------------------------------------
    "universidad": {
        "descripcion": "universidad",
        "categoria": "Educación",
        "subcategoria": "Universidad",
    },
    "instituto educativo": {
        "descripcion": "instituto educativo",
        "categoria": "Educación",
        "subcategoria": "Institución educativa",
    },
    "colegio": {
        "descripcion": "colegio",
        "categoria": "Educación",
        "subcategoria": "Institución educativa",
    },
    "escuela": {
        "descripcion": "escuela",
        "categoria": "Educación",
        "subcategoria": "Institución educativa",
    },
    "curso": {
        "descripcion": "curso",
        "categoria": "Educación",
        "subcategoria": "Cursos y capacitación",
    },
    "capacitacion": {
        "descripcion": "capacitacion",
        "categoria": "Educación",
        "subcategoria": "Cursos y capacitación",
    },
    "certificacion": {
        "descripcion": "certificacion",
        "categoria": "Educación",
        "subcategoria": "Cursos y capacitación",
    },
    "seminario": {
        "descripcion": "seminario",
        "categoria": "Educación",
        "subcategoria": "Cursos y capacitación",
    },
    "matricula": {
        "descripcion": "matricula",
        "categoria": "Educación",
        "subcategoria": "Matrícula",
    },
    "libro de estudio": {
        "descripcion": "libro de estudio",
        "categoria": "Educación",
        "subcategoria": "Libros y materiales",
    },
    "material de estudio": {
        "descripcion": "material de estudio",
        "categoria": "Educación",
        "subcategoria": "Libros y materiales",
    },
    "utiles escolares": {
        "descripcion": "articulos escolares",
        "categoria": "Educación",
        "subcategoria": "Libros y materiales",
    },
    "articulos escolares": {
        "descripcion": "articulos escolares",
        "categoria": "Educación",
        "subcategoria": "Libros y materiales",
    },

    # --------------------------------------------------------
    # Entretenimiento
    # --------------------------------------------------------
    "netflix": {
        "descripcion": "streaming",
        "categoria": "Entretenimiento",
        "subcategoria": "Streaming",
    },
    "spotify": {
        "descripcion": "servicio de musica",
        "categoria": "Entretenimiento",
        "subcategoria": "Música",
    },
    "disney plus": {
        "descripcion": "streaming",
        "categoria": "Entretenimiento",
        "subcategoria": "Streaming",
    },
    "disney": {
        "descripcion": "streaming",
        "categoria": "Entretenimiento",
        "subcategoria": "Streaming",
    },
    "youtube premium": {
        "descripcion": "streaming",
        "categoria": "Entretenimiento",
        "subcategoria": "Streaming",
    },
    "hbo max": {
        "descripcion": "streaming",
        "categoria": "Entretenimiento",
        "subcategoria": "Streaming",
    },
    "max": {
        "descripcion": "streaming",
        "categoria": "Entretenimiento",
        "subcategoria": "Streaming",
    },
    "prime video": {
        "descripcion": "streaming",
        "categoria": "Entretenimiento",
        "subcategoria": "Streaming",
    },
    "streaming": {
        "descripcion": "streaming",
        "categoria": "Entretenimiento",
        "subcategoria": "Streaming",
    },
    "steam": {
        "descripcion": "videojuego",
        "categoria": "Entretenimiento",
        "subcategoria": "Videojuegos",
    },
    "epic games": {
        "descripcion": "videojuego",
        "categoria": "Entretenimiento",
        "subcategoria": "Videojuegos",
    },
    "playstation": {
        "descripcion": "videojuego",
        "categoria": "Entretenimiento",
        "subcategoria": "Videojuegos",
    },
    "xbox": {
        "descripcion": "videojuego",
        "categoria": "Entretenimiento",
        "subcategoria": "Videojuegos",
    },
    "nintendo": {
        "descripcion": "videojuego",
        "categoria": "Entretenimiento",
        "subcategoria": "Videojuegos",
    },
    "videojuego": {
        "descripcion": "videojuego",
        "categoria": "Entretenimiento",
        "subcategoria": "Videojuegos",
    },
    "cine": {
        "descripcion": "cine",
        "categoria": "Entretenimiento",
        "subcategoria": "Cine",
    },
    "teatro": {
        "descripcion": "teatro",
        "categoria": "Entretenimiento",
        "subcategoria": "Eventos y cultura",
    },
    "concierto": {
        "descripcion": "concierto",
        "categoria": "Entretenimiento",
        "subcategoria": "Eventos y cultura",
    },
    "recital": {
        "descripcion": "concierto",
        "categoria": "Entretenimiento",
        "subcategoria": "Eventos y cultura",
    },
    "festival": {
        "descripcion": "festival",
        "categoria": "Entretenimiento",
        "subcategoria": "Eventos y cultura",
    },
    "museo": {
        "descripcion": "museo",
        "categoria": "Entretenimiento",
        "subcategoria": "Eventos y cultura",
    },

    # --------------------------------------------------------
    # Servicios
    # --------------------------------------------------------
    "internet": {
        "descripcion": "servicio de internet",
        "categoria": "Servicios",
        "subcategoria": "Internet",
    },
    "electricidad": {
        "descripcion": "electricidad",
        "categoria": "Servicios",
        "subcategoria": "Electricidad",
    },
    "servicio de agua": {
        "descripcion": "agua",
        "categoria": "Servicios",
        "subcategoria": "Agua",
    },
    "factura de agua": {
        "descripcion": "agua",
        "categoria": "Servicios",
        "subcategoria": "Agua",
    },
    "servicio de gas": {
        "descripcion": "gas",
        "categoria": "Servicios",
        "subcategoria": "Gas",
    },
    "factura de gas": {
        "descripcion": "gas",
        "categoria": "Servicios",
        "subcategoria": "Gas",
    },
    "telefonia movil": {
        "descripcion": "telefonia movil",
        "categoria": "Servicios",
        "subcategoria": "Telefonía",
    },
    "telefono movil": {
        "descripcion": "telefonia movil",
        "categoria": "Servicios",
        "subcategoria": "Telefonía",
    },
    "plan de celular": {
        "descripcion": "telefonia movil",
        "categoria": "Servicios",
        "subcategoria": "Telefonía",
    },
    "fibra optica": {
        "descripcion": "internet",
        "categoria": "Servicios",
        "subcategoria": "Internet",
    },
    "banda ancha": {
        "descripcion": "internet",
        "categoria": "Servicios",
        "subcategoria": "Internet",
    },
    "television por cable": {
        "descripcion": "servicio de television",
        "categoria": "Servicios",
        "subcategoria": "Televisión",
    },
    "hosting": {
        "descripcion": "alojamiento web",
        "categoria": "Servicios",
        "subcategoria": "Servicios digitales",
    },
    "almacenamiento en la nube": {
        "descripcion": "servicio en la nube",
        "categoria": "Servicios",
        "subcategoria": "Servicios digitales",
    },

    # --------------------------------------------------------
    # Compras
    # --------------------------------------------------------
    "mercado libre": {
        "descripcion": "compra por internet",
        "categoria": "Compras",
        "subcategoria": "Comercio electrónico",
    },
    "amazon": {
        "descripcion": "compra por internet",
        "categoria": "Compras",
        "subcategoria": "Comercio electrónico",
    },
    "temu": {
        "descripcion": "compra por internet",
        "categoria": "Compras",
        "subcategoria": "Comercio electrónico",
    },
    "shein": {
        "descripcion": "compra por internet",
        "categoria": "Compras",
        "subcategoria": "Comercio electrónico",
    },
    "falabella": {
        "descripcion": "compra en tienda",
        "categoria": "Compras",
        "subcategoria": "Tienda",
    },
    "ripley": {
        "descripcion": "compra en tienda",
        "categoria": "Compras",
        "subcategoria": "Tienda",
    },
    "ropa": {
        "descripcion": "compra de ropa",
        "categoria": "Compras",
        "subcategoria": "Ropa e indumentaria",
    },
    "indumentaria": {
        "descripcion": "compra de ropa",
        "categoria": "Compras",
        "subcategoria": "Ropa e indumentaria",
    },
    "calzado": {
        "descripcion": "compra de calzado",
        "categoria": "Compras",
        "subcategoria": "Calzado",
    },
    "zapatillas": {
        "descripcion": "compra de calzado",
        "categoria": "Compras",
        "subcategoria": "Calzado",
    },
    "telefono celular": {
        "descripcion": "compra de telefono",
        "categoria": "Compras",
        "subcategoria": "Tecnología",
    },
    "smartphone": {
        "descripcion": "compra de telefono",
        "categoria": "Compras",
        "subcategoria": "Tecnología",
    },
    "notebook": {
        "descripcion": "compra de computadora",
        "categoria": "Compras",
        "subcategoria": "Tecnología",
    },
    "computadora": {
        "descripcion": "compra de computadora",
        "categoria": "Compras",
        "subcategoria": "Tecnología",
    },
    "auriculares": {
        "descripcion": "compra de tecnologia",
        "categoria": "Compras",
        "subcategoria": "Tecnología",
    },
    "perfume": {
        "descripcion": "perfumeria",
        "categoria": "Compras",
        "subcategoria": "Cuidado personal",
    },
    "cosmetica": {
        "descripcion": "cosmetica",
        "categoria": "Compras",
        "subcategoria": "Cuidado personal",
    },
    "alimento para mascotas": {
        "descripcion": "alimento para mascotas",
        "categoria": "Compras",
        "subcategoria": "Mascotas",
    },
    "accesorios para mascotas": {
        "descripcion": "accesorios para mascotas",
        "categoria": "Compras",
        "subcategoria": "Mascotas",
    },

    # --------------------------------------------------------
    # Deudas
    # --------------------------------------------------------
    "pago de deuda": {
        "descripcion": "pago de deuda",
        "categoria": "Deudas",
        "subcategoria": "Pago de deuda",
    },
    "pago de prestamo": {
        "descripcion": "pago de prestamo",
        "categoria": "Deudas",
        "subcategoria": "Préstamo",
    },
    "cuota de prestamo": {
        "descripcion": "cuota de prestamo",
        "categoria": "Deudas",
        "subcategoria": "Préstamo",
    },
    "pago de tarjeta": {
        "descripcion": "pago de tarjeta",
        "categoria": "Deudas",
        "subcategoria": "Tarjeta de crédito",
    },
    "saldo de tarjeta": {
        "descripcion": "pago de tarjeta",
        "categoria": "Deudas",
        "subcategoria": "Tarjeta de crédito",
    },
    "pago minimo de tarjeta": {
        "descripcion": "pago de tarjeta",
        "categoria": "Deudas",
        "subcategoria": "Tarjeta de crédito",
    },
    "intereses de deuda": {
        "descripcion": "pago de intereses",
        "categoria": "Deudas",
        "subcategoria": "Intereses",
    },

    # --------------------------------------------------------
    # Impuestos
    # --------------------------------------------------------
    "impuesto municipal": {
        "descripcion": "impuesto municipal",
        "categoria": "Impuestos",
        "subcategoria": "Impuestos locales",
    },
    "impuesto provincial": {
        "descripcion": "impuesto provincial",
        "categoria": "Impuestos",
        "subcategoria": "Impuestos regionales",
    },
    "impuesto nacional": {
        "descripcion": "impuesto nacional",
        "categoria": "Impuestos",
        "subcategoria": "Impuestos nacionales",
    },
    "impuesto vehicular": {
        "descripcion": "impuesto automotor",
        "categoria": "Impuestos",
        "subcategoria": "Impuesto vehicular",
    },
    "impuesto inmobiliario": {
        "descripcion": "impuesto inmobiliario",
        "categoria": "Impuestos",
        "subcategoria": "Impuesto inmobiliario",
    },
    "tributo": {
        "descripcion": "pago tributario",
        "categoria": "Impuestos",
        "subcategoria": "Otros impuestos",
    },
    "impuestos": {
        "descripcion": "impuestos",
        "categoria": "Impuestos",
        "subcategoria": "Otros impuestos",
    },
    "impuesto": {
        "descripcion": "impuestos",
        "categoria": "Impuestos",
        "subcategoria": "Otros impuestos",
    },
}


# Términos que son demasiado ambiguos para decidir una categoría por sí solos.
TERMINOS_AMBIGUOS = {
    "mercado",
    "tienda",
    "pago",
    "compra",
    "servicio",
    "gas",
    "agua",
    "movimiento",
    "operacion",
    "local",
    "online",
    "credito",
}


# ============================================================
# Subcategorías de respaldo por categoría
# ============================================================

SUBCATEGORIA_DEFAULT = {
    "Alimentación": "Otros alimentos",
    "Transporte": "Otros transportes",
    "Salud": "Otros gastos de salud",
    "Vivienda": "Otros gastos de vivienda",
    "Educación": "Otros gastos educativos",
    "Entretenimiento": "Otros entretenimientos",
    "Servicios": "Otros servicios",
    "Compras": "Otras compras",
    "Deudas": "Otras deudas",
    "Impuestos": "Otros impuestos",
    "Otros": "Otros",
}


# ============================================================
# Normalización
# ============================================================

def quitar_tildes(texto: str) -> str:
    normalizado = unicodedata.normalize("NFD", texto)
    return "".join(
        caracter
        for caracter in normalizado
        if unicodedata.category(caracter) != "Mn"
    )


def normalizar_texto(texto: str) -> str:
    if texto is None:
        return ""

    resultado = quitar_tildes(str(texto).lower().strip())

    # Convierte "+" en palabra para conservar semántica de marcas como Disney+.
    resultado = resultado.replace("+", " plus ")

    resultado = re.sub(r"[^a-z0-9\s]", " ", resultado)
    resultado = re.sub(r"\s+", " ", resultado).strip()

    return resultado


# ============================================================
# Matching exacto y fuzzy
# ============================================================

def _contiene_frase(texto: str, frase: str) -> bool:
    """
    Coincidencia por límites de palabra.
    Evita falsos positivos del tipo amazon -> amazonia.
    """
    patron = rf"(?<![a-z0-9]){re.escape(frase)}(?![a-z0-9])"
    return re.search(patron, texto) is not None


def detectar_regla_exacta(texto_normalizado: str) -> dict | None:
    if not texto_normalizado:
        return None

    # Primero frases largas para priorizar:
    # "clinica veterinaria" antes que "clinica".
    for termino in sorted(REGLAS_TERMINOS, key=len, reverse=True):
        if termino in TERMINOS_AMBIGUOS:
            continue

        if _contiene_frase(texto_normalizado, termino):
            regla = REGLAS_TERMINOS[termino]

            return {
                "termino": termino,
                "descripcion_canonica": regla["descripcion"],
                "categoria": regla["categoria"],
                "subcategoria": regla["subcategoria"],
                "similitud": 1.0,
                "metodo": "regla_exacta",
            }

    return None


def _similitud(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _ngramas_palabras(texto: str, max_n: int = 3) -> list[str]:
    palabras = texto.split()
    candidatos: list[str] = []

    for n in range(1, min(max_n, len(palabras)) + 1):
        for i in range(len(palabras) - n + 1):
            candidatos.append(
                " ".join(palabras[i:i + n])
            )

    return candidatos


def detectar_regla_fuzzy(texto_normalizado: str) -> dict | None:
    """
    Matching ortográfico conservador.

    Ejemplos:
        vrduleria    -> verduleria
        vetrinaria   -> veterinaria
        farmcia      -> farmacia
        resturante   -> restaurante
        nintendo eshp -> nintendo
    """
    if not texto_normalizado:
        return None

    candidatos = [texto_normalizado]
    candidatos.extend(
        _ngramas_palabras(texto_normalizado, max_n=3)
    )

    mejor: dict | None = None

    for candidato in candidatos:
        if len(candidato) < 4:
            continue

        for termino, regla in REGLAS_TERMINOS.items():
            if termino in TERMINOS_AMBIGUOS:
                continue

            diferencia_longitud = abs(
                len(candidato) - len(termino)
            )

            limite_diferencia = max(
                5,
                int(len(termino) * 0.45),
            )

            if diferencia_longitud > limite_diferencia:
                continue

            score = _similitud(
                candidato,
                termino,
            )

            umbral = (
                UMBRAL_FUZZY_CORTO
                if min(
                    len(candidato),
                    len(termino),
                ) <= 5
                else UMBRAL_FUZZY_FUERTE
            )

            if score < umbral:
                continue

            if (
                mejor is None
                or score > mejor["similitud"]
            ):
                mejor = {
                    "termino": termino,
                    "descripcion_canonica": regla["descripcion"],
                    "categoria": regla["categoria"],
                    "subcategoria": regla["subcategoria"],
                    "similitud": score,
                    "metodo": "fuzzy",
                }

    return mejor


def normalizar_descripcion(descripcion: str) -> str:
    """
    Compatibilidad con versiones anteriores.
    Retorna descripción canónica cuando la podemos identificar.
    """
    texto = normalizar_texto(descripcion)

    exacta = detectar_regla_exacta(texto)
    if exacta is not None:
        return str(exacta["descripcion_canonica"])

    fuzzy = detectar_regla_fuzzy(texto)
    if fuzzy is not None:
        return str(fuzzy["descripcion_canonica"])

    return texto


# ============================================================
# Preparación de datos para el modelo
# ============================================================

def preparar_transaccion(
    descripcion: str,
    monto: float,
    fecha: str,
    medio_pago: str,
    recurrente: str,
    descripcion_limpia: str | None = None,
) -> pd.DataFrame:
    fecha_convertida = pd.to_datetime(
        fecha,
        errors="raise",
    )

    if descripcion_limpia is None:
        descripcion_limpia = normalizar_descripcion(
            descripcion
        )

    return pd.DataFrame([
        {
            "descripcion_limpia": descripcion_limpia,
            "monto": float(monto),
            "mes": fecha_convertida.month,
            "dia_semana": fecha_convertida.dayofweek,
            "es_fin_de_semana": int(
                fecha_convertida.dayofweek >= 5
            ),
            "longitud_descripcion": len(
                descripcion_limpia
            ),
            "cantidad_palabras": len(
                descripcion_limpia.split()
            ),
            "medio_pago": medio_pago,
            "recurrente": recurrente,
        }
    ])


# ============================================================
# Modelo ML
# ============================================================

def _predecir_ml(
    entrada: pd.DataFrame,
) -> tuple[str, float]:
    categoria = str(
        modelo_gastos.predict(entrada)[0]
    )

    if not hasattr(
        modelo_gastos,
        "predict_proba",
    ):
        return categoria, 0.50

    probabilidades = modelo_gastos.predict_proba(
        entrada
    )[0]

    clases = [
        str(clase)
        for clase in modelo_gastos.classes_
    ]

    try:
        indice = clases.index(categoria)
        confianza = float(
            probabilidades[indice]
        )
    except (ValueError, IndexError):
        confianza = float(
            np.max(probabilidades)
        )

    return categoria, confianza


def _confianza_fuzzy(
    similitud: float,
) -> float:
    """
    Convierte similitud ortográfica en confianza conservadora.

    No altera predict_proba() del modelo.
    """
    return min(
        0.99,
        max(
            0.90,
            0.90
            + (similitud - 0.90) * 0.90,
        ),
    )


# ============================================================
# Subcategoría para resultados ML
# ============================================================

def inferir_subcategoria(
    descripcion: str,
    categoria: str,
) -> str:
    """
    Intenta extraer una subcategoría incluso cuando la categoría
    principal provino del modelo ML.

    Nunca cambia la categoría principal.
    """
    texto = normalizar_texto(descripcion)

    exacta = detectar_regla_exacta(texto)

    if (
        exacta is not None
        and exacta["categoria"] == categoria
    ):
        return str(
            exacta["subcategoria"]
        )

    fuzzy = detectar_regla_fuzzy(texto)

    if (
        fuzzy is not None
        and fuzzy["categoria"] == categoria
    ):
        return str(
            fuzzy["subcategoria"]
        )

    return SUBCATEGORIA_DEFAULT.get(
        categoria,
        "Otros",
    )


# ============================================================
# Advertencias
# ============================================================

def generar_advertencias(
    descripcion: str,
    monto: float,
    confianza: float | None = None,
    metodo: str | None = None,
) -> list[str]:
    advertencias: list[str] = []

    descripcion_normalizada = normalizar_texto(
        descripcion
    )

    if (
        "alquiler" in descripcion_normalizada
        and monto < 100
    ):
        advertencias.append(
            "Monto inusualmente bajo para un alquiler."
        )

    if monto >= 5000:
        advertencias.append(
            "Se detectó un importe atípico para esta categoría. "
            "Se recomienda revisar el valor antes de guardar la transacción."
        )

    if (
        confianza is not None
        and confianza < UMBRAL_CONFIANZA_BAJA
        and metodo == "ml"
    ):
        advertencias.append(
            "La descripción es ambigua. "
            "Revisá la categoría sugerida antes de guardar."
        )

    elif (
        confianza is not None
        and confianza < UMBRAL_CONFIANZA_MEDIA
        and metodo == "ml"
    ):
        advertencias.append(
            "La clasificación es probable, pero conviene revisarla "
            "si la descripción es ambigua."
        )

    return advertencias


# ============================================================
# Predicción principal
# ============================================================

def predecir_categoria(
    descripcion: str,
    monto: float,
    fecha: str,
    medio_pago: str,
    recurrente: str,
) -> dict:
    """
    Pipeline híbrido:

    1. Normalización.
    2. Regla exacta.
    3. Fuzzy matching.
    4. ML como fallback.
    5. Subcategoría explicativa.
    6. Confianza según la fuente real de decisión.

    Mantiene compatibilidad con el contrato anterior.
    """
    texto = normalizar_texto(
        descripcion
    )

    # --------------------------------------------------------
    # 1. Regla exacta
    # --------------------------------------------------------
    regla = detectar_regla_exacta(
        texto
    )

    if regla is not None:
        categoria = str(
            regla["categoria"]
        )

        subcategoria = str(
            regla["subcategoria"]
        )

        confianza = 0.99
        metodo = "regla_exacta"

    else:
        # ----------------------------------------------------
        # 2. Fuzzy
        # ----------------------------------------------------
        fuzzy = detectar_regla_fuzzy(
            texto
        )

        if fuzzy is not None:
            categoria = str(
                fuzzy["categoria"]
            )

            subcategoria = str(
                fuzzy["subcategoria"]
            )

            confianza = _confianza_fuzzy(
                float(
                    fuzzy["similitud"]
                )
            )

            metodo = "fuzzy"

        else:
            # ------------------------------------------------
            # 3. ML
            # ------------------------------------------------
            entrada = preparar_transaccion(
                descripcion=descripcion,
                monto=monto,
                fecha=fecha,
                medio_pago=medio_pago,
                recurrente=recurrente,
                descripcion_limpia=texto,
            )

            categoria, confianza = _predecir_ml(
                entrada
            )

            subcategoria = inferir_subcategoria(
                descripcion,
                categoria,
            )

            metodo = "ml"

    advertencias = generar_advertencias(
        descripcion=descripcion,
        monto=float(monto),
        confianza=float(confianza),
        metodo=metodo,
    )

    return {
        # Tipo de transacción compatible con CategoriaResponse.
        "tipo_transaccion": "GASTO",

        # Campos originales
        "categoria_predicha": categoria,
        "confianza": round(
            float(confianza),
            4,
        ),
        "advertencias": advertencias,
        "modelo_version": MODELO_VERSION,

        # Campos nuevos, no destructivos
        "subcategoria_predicha": subcategoria,
        "metodo_clasificacion": metodo,
    }


# ============================================================
# Diagnóstico / testing
# ============================================================

def diagnosticar_descripcion(
    descripcion: str,
) -> dict:
    """
    Permite inspeccionar por qué una descripción fue reconocida.
    Útil para tests, Swagger y desarrollo.
    """
    texto = normalizar_texto(
        descripcion
    )

    exacta = detectar_regla_exacta(
        texto
    )

    if exacta is not None:
        return {
            "original": descripcion,
            "normalizada": texto,
            "metodo": "regla_exacta",
            "termino_detectado": exacta["termino"],
            "descripcion_canonica": exacta["descripcion_canonica"],
            "categoria": exacta["categoria"],
            "subcategoria": exacta["subcategoria"],
            "similitud": 1.0,
        }

    fuzzy = detectar_regla_fuzzy(
        texto
    )

    if fuzzy is not None:
        return {
            "original": descripcion,
            "normalizada": texto,
            "metodo": "fuzzy",
            "termino_detectado": fuzzy["termino"],
            "descripcion_canonica": fuzzy["descripcion_canonica"],
            "categoria": fuzzy["categoria"],
            "subcategoria": fuzzy["subcategoria"],
            "similitud": round(
                float(
                    fuzzy["similitud"]
                ),
                4,
            ),
        }

    return {
        "original": descripcion,
        "normalizada": texto,
        "metodo": "ml",
        "termino_detectado": None,
        "descripcion_canonica": texto,
        "categoria": None,
        "subcategoria": None,
        "similitud": None,
    }