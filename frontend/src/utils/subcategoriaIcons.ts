const ICONOS_SUBCATEGORIA: Record<string, string> = {
  // Alimentación
  'Verdulería': '🥬',
  'Frutería': '🍎',
  'Carnicería': '🥩',
  'Panadería': '🥖',
  'Fiambrería': '🧀',
  'Pollería': '🍗',
  'Pescadería': '🐟',
  'Supermercado': '🛒',
  'Almacén y despensa': '🏪',
  'Restaurante': '🍽️',
  'Cafetería': '☕',
  'Heladería': '🍦',
  'Comida preparada': '🍱',
  'Comida rápida': '🍔',
  'Delivery': '🛵',
  'Otros alimentos': '🍴',

  // Transporte
  'Viaje por aplicación': '🚕',
  'Taxi': '🚖',
  'Transporte público': '🚌',
  'Combustible': '⛽',
  'Estacionamiento': '🅿️',
  'Peajes': '🛣️',
  'Viajes': '✈️',
  'Mantenimiento vehicular': '🔧',
  'Otros transportes': '🚗',

  // Salud
  'Farmacia': '💊',
  'Consulta médica': '🩺',
  'Atención médica': '🏥',
  'Estudios y laboratorio': '🧪',
  'Odontología': '🦷',
  'Salud mental': '🧠',
  'Rehabilitación': '🦽',
  'Seguro médico': '🛡️',
  'Veterinaria': '🐾',
  'Otros gastos de salud': '⚕️',

  // Vivienda
  'Alquiler': '🏠',
  'Hipoteca': '🏦',
  'Mantenimiento': '🛠️',
  'Mudanza': '📦',
  'Muebles y equipamiento': '🛋️',
  'Refacción': '🔨',
  'Otros gastos de vivienda': '🏡',

  // Educación
  'Universidad': '🎓',
  'Institución educativa': '🏫',
  'Cursos y capacitación': '📖',
  'Matrícula': '📝',
  'Libros y materiales': '📚',
  'Otros gastos educativos': '✏️',

  // Entretenimiento / Ocio
  'Streaming': '📺',
  'Música': '🎵',
  'Videojuegos': '🎮',
  'Cine': '🎬',
  'Eventos y cultura': '🎭',
  'Turismo': '🧳',
  'Otros entretenimientos': '🎉',

  // Servicios
  'Internet': '🌐',
  'Electricidad': '💡',
  'Agua': '🚰',
  'Gas': '🔥',
  'Telefonía': '📱',
  'Televisión': '📡',
  'Servicios digitales': '💻',
  'Otros servicios': '🔧',

  // Compras
  'Comercio electrónico': '📦',
  'Tienda': '🏬',
  'Ropa e indumentaria': '👕',
  'Calzado': '👟',
  'Tecnología': '💻',
  'Cuidado personal': '🧴',
  'Mascotas': '🐶',
  'Otras compras': '🛍️',

  // Deudas
  'Pago de deuda': '💳',
  'Préstamo': '💰',
  'Tarjeta de crédito': '💳',
  'Intereses': '📉',
  'Otras deudas': '💸',

  // Impuestos
  'Impuestos locales': '🧾',
  'Impuestos regionales': '🧾',
  'Impuestos nacionales': '🧾',
  'Impuesto vehicular': '🚙',
  'Impuesto inmobiliario': '🏘️',
  'Otros impuestos': '🧾',

  'Otros': '🏷️',
};

const ICONO_CATEGORIA_FALLBACK: Record<string, string> = {
  'Alimentación': '🍽️',
  'Transporte': '🚗',
  'Salud': '⚕️',
  'Vivienda': '🏠',
  'Educación': '📚',
  'Ocio': '🎉',
  'Entretenimiento': '🎉',
  'Servicios': '🔧',
  'Compras': '🛍️',
  'Deudas': '💳',
  'Impuestos': '🧾',
  'Otros': '🏷️',
};

export function getSubcategoriaIcon(subcategoria?: string | null, categoria?: string): string {
  if (subcategoria && ICONOS_SUBCATEGORIA[subcategoria]) {
    return ICONOS_SUBCATEGORIA[subcategoria];
  }
  if (categoria && ICONO_CATEGORIA_FALLBACK[categoria]) {
    return ICONO_CATEGORIA_FALLBACK[categoria];
  }
  return '🏷️';
}
