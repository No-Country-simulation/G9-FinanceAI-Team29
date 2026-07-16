package com.financeai.service;

import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Le pone categoría a una transacción según lo que diga la descripción.
 *
 * Uso LinkedHashMap a propósito (y no Map.of) porque necesito respetar el orden:
 * primero las categorías más específicas y después las genéricas, así una
 * descripción ambigua siempre cae en la misma. Si no matchea nada, va a "Otros".
 */
@Service
public class ClasificacionService {

    private static final Map<String, Pattern> CATEGORIAS_PATRONES = new LinkedHashMap<>();

    static {
        // Orden = prioridad (de más específico a más genérico)
        add("Vivienda", "alquiler|hipoteca|expensas|seguro del hogar|mantenimiento del hogar|"
            + "materiales de construcción|reparación del hogar|servicio de limpieza|muebles");
        add("Salud", "médic|farmacia|hospital|clínica|dentist|odontolog|salud|medicamento|"
            + "terapia|kinesiolog|consulta médica|estudio médico|lentes|seguro de salud");
        add("Educación", "curso|clase|universidad|colegio|libro|papelería|educación|capacitación|"
            + "inscripción|certificación|plataforma educativa|material de estudio|cuota educativa");
        add("Transporte", "taxi|uber|gasolina|combustible|estacionamiento|peaje|transporte|pasaje|"
            + "metro|bus|autobús|tren|mantenimiento del vehículo|viaje por aplicación|carga de tarjeta");
        add("Ocio", "cine|concierto|videojuego|streaming|suscripción|música|parque|recreativ|"
            + "deporte|gimnasio|hobby|salida|evento cultural|actividad recreativa");
        add("Servicios", "luz|agua|gas|internet|teléfono|telefonía|electricidad|impuesto|"
            + "televisión|comisión bancaria|seguridad");
        add("Alimentación", "supermercado|mercado|comida|almuerzo|cena|desayuno|panadería|carnicería|"
            + "verdulería|frutería|restaurante|cafetería|comida a domicilio|compra de alimentos");
        add("Compras", "ropa|calzado|electrónic|tecnología|cosmétic|artículos personales|compra por internet");
        // "Otros" es el fallback por defecto (no necesita patrón).
    }

    private static void add(String categoria, String alternativas) {
        CATEGORIAS_PATRONES.put(categoria,
            Pattern.compile(".*(" + alternativas + ").*", Pattern.CASE_INSENSITIVE));
    }

    public String clasificarTransaccion(String descripcion) {
        if (descripcion == null || descripcion.isBlank()) {
            return "Otros";
        }
        for (Map.Entry<String, Pattern> entry : CATEGORIAS_PATRONES.entrySet()) {
            if (entry.getValue().matcher(descripcion).matches()) {
                return entry.getKey();
            }
        }
        return "Otros";
    }
}
