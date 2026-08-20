package com.financeai.service;

import com.financeai.dto.AnalisisRequest;
import com.financeai.dto.AnalisisResponse;
import com.financeai.dto.TransaccionDTO;
import com.financeai.dto.csv.CsvImportResponse;
import com.financeai.model.Categoria;
import com.financeai.model.Transaccion;
import com.financeai.model.Usuario;
import com.financeai.repository.CategoriaRepository;
import com.financeai.repository.TransaccionRepository;
import com.financeai.repository.UsuarioRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class CsvImportService {

    public enum ModoImportacion {
        CARGAR,
        ACTUALIZAR,
        SOBREESCRIBIR;

        public static ModoImportacion desde(String valor) {
            if (valor == null || valor.isBlank()) {
                return CARGAR;
            }

            try {
                return valueOf(valor.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException(
                        "Modo de importación inválido. Usá CARGAR, ACTUALIZAR o SOBREESCRIBIR."
                );
            }
        }
    }

    private final UsuarioRepository usuarioRepository;
    private final TransaccionRepository transaccionRepository;
    private final CategoriaRepository categoriaRepository;
    private final AnalisisService analisisService;
    private final RestTemplate restTemplate;
    private final String aiServiceUrl;

    public CsvImportService(
            UsuarioRepository usuarioRepository,
            TransaccionRepository transaccionRepository,
            CategoriaRepository categoriaRepository,
            AnalisisService analisisService,
            @Value("${ml.service.url:http://127.0.0.1:8000}") String aiServiceUrl) {
        this.usuarioRepository = usuarioRepository;
        this.transaccionRepository = transaccionRepository;
        this.categoriaRepository = categoriaRepository;
        this.analisisService = analisisService;
        this.restTemplate = new RestTemplate();
        this.aiServiceUrl = aiServiceUrl;
    }

    @Transactional
    public Map<String, Object> importar(
            String usuarioId,
            MultipartFile archivo,
            String modoSolicitado) throws Exception {

        validarArchivo(archivo);
        ModoImportacion modo = ModoImportacion.desde(modoSolicitado);

        Usuario usuario = usuarioRepository.findById(usuarioId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No existe el usuario " + usuarioId + "."
                ));

        List<Transaccion> existentes = transaccionRepository.findByUsuarioId(usuarioId);
        long cantidadAntes = existentes.size();

        // Los modos dependen del estado real del historial del usuario.
        // ACTUALIZAR y SOBREESCRIBIR sólo tienen sentido después de una carga inicial.
        if (existentes.isEmpty() && modo != ModoImportacion.CARGAR) {
            throw new IllegalArgumentException(
                    "Todavía no tenés movimientos cargados. Realizá primero una carga inicial."
            );
        }

        // CARGAR queda reservado para la primera importación.
        if (modo == ModoImportacion.CARGAR && !existentes.isEmpty()) {
            throw new IllegalArgumentException(
                    "El usuario ya tiene movimientos. Usá ACTUALIZAR para agregar nuevos "
                            + "o SOBREESCRIBIR para corregir un período."
            );
        }

        String nombreArchivo = archivo.getOriginalFilename() == null
                ? "movimientos.csv"
                : archivo.getOriginalFilename();

        // Recién después de validar el modo procesamos el CSV con el AI-Service.
        CsvImportResponse procesado = procesarConAi(
                usuarioId,
                archivo.getBytes(),
                nombreArchivo
        );

        if (procesado.getTransacciones().isEmpty()) {
            throw new IllegalArgumentException(
                    "El CSV fue procesado, pero no contiene movimientos válidos para guardar."
            );
        }

        int duplicadosIgnorados = 0;
        long movimientosReemplazados = 0;

        List<CsvImportResponse.TransaccionCsv> itemsAGuardar = new ArrayList<>();

        if (modo == ModoImportacion.ACTUALIZAR) {
            Set<String> huellas = new HashSet<>();
            for (Transaccion existente : existentes) {
                huellas.add(huella(existente));
            }

            // También evita duplicados dentro del mismo CSV.
            Set<String> huellasNuevas = new HashSet<>();
            for (CsvImportResponse.TransaccionCsv item : procesado.getTransacciones()) {
                String huella = huella(item);
                if (huellas.contains(huella) || !huellasNuevas.add(huella)) {
                    duplicadosIgnorados++;
                    continue;
                }
                itemsAGuardar.add(item);
            }

        } else if (modo == ModoImportacion.SOBREESCRIBIR) {
            LocalDate fechaDesde = procesado.getTransacciones().stream()
                    .map(CsvImportResponse.TransaccionCsv::getFecha)
                    .filter(fecha -> fecha != null)
                    .min(LocalDate::compareTo)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "No se pudo determinar la fecha inicial del CSV."
                    ));

            LocalDate fechaHasta = procesado.getTransacciones().stream()
                    .map(CsvImportResponse.TransaccionCsv::getFecha)
                    .filter(fecha -> fecha != null)
                    .max(LocalDate::compareTo)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "No se pudo determinar la fecha final del CSV."
                    ));

            movimientosReemplazados = transaccionRepository
                    .countByUsuarioIdAndFechaBetween(usuarioId, fechaDesde, fechaHasta);

            transaccionRepository.deleteByUsuarioIdAndFechaBetween(
                    usuarioId,
                    fechaDesde,
                    fechaHasta
            );
            transaccionRepository.flush();

            // Si el archivo trae duplicados exactos, no tiene sentido insertarlos dos veces.
            Set<String> huellasNuevas = new HashSet<>();
            for (CsvImportResponse.TransaccionCsv item : procesado.getTransacciones()) {
                if (!huellasNuevas.add(huella(item))) {
                    duplicadosIgnorados++;
                    continue;
                }
                itemsAGuardar.add(item);
            }

        } else {
            // CARGAR: usuario sin historial. Conservamos todo, evitando duplicados internos.
            Set<String> huellasNuevas = new HashSet<>();
            for (CsvImportResponse.TransaccionCsv item : procesado.getTransacciones()) {
                if (!huellasNuevas.add(huella(item))) {
                    duplicadosIgnorados++;
                    continue;
                }
                itemsAGuardar.add(item);
            }
        }

        List<Transaccion> transaccionesAGuardar = convertirTransacciones(
                usuario,
                itemsAGuardar
        );

        if (!transaccionesAGuardar.isEmpty()) {
            transaccionRepository.saveAllAndFlush(transaccionesAGuardar);
        }

        long movimientosGuardados = transaccionRepository.countByUsuarioId(usuarioId);

        long esperados;
        if (modo == ModoImportacion.SOBREESCRIBIR) {
            esperados = cantidadAntes - movimientosReemplazados + transaccionesAGuardar.size();
        } else {
            esperados = cantidadAntes + transaccionesAGuardar.size();
        }

        if (movimientosGuardados != esperados) {
            throw new IllegalStateException(
                    "La base de datos no confirmó el resultado esperado. Esperados: "
                            + esperados + ", guardados: " + movimientosGuardados
            );
        }

        // Segunda pasada sobre el historial DEFINITIVO:
        //
        // El AI-Service de CSV sigue siendo la fuente para normalizar el historial y
        // obtener las métricas base del usuario, pero NO decide el perfil final.
        // El perfil financiero se resuelve con AnalisisService, exactamente igual
        // que cuando el Dashboard llama a /analisis-financiero. De esta manera
        // importación y Dashboard comparten una sola fuente de verdad.
        List<Transaccion> historialActual = transaccionRepository.findByUsuarioId(usuarioId);

        CsvImportResponse recalculado = procesarConAi(
                usuarioId,
                construirCsv(historialActual),
                "historial_actual.csv"
        );

        actualizarMetricasUsuarioDesdeAi(usuario, recalculado.getUsuario());
        usuarioRepository.saveAndFlush(usuario);

        AnalisisRequest requestAnalisis =
                construirAnalisisRequestComoFrontend(usuario, historialActual);

        AnalisisResponse analisisFinal =
                analisisService.analizar(requestAnalisis, usuarioId);

        Map<String, Object> resumen = construirResumen(historialActual);

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("mensaje", mensajePorModo(modo));
        respuesta.put("usuarioId", usuarioId);
        respuesta.put("modo", modo.name());
        respuesta.put("perfilFinanciero", analisisFinal.getPerfilFinanciero());
        respuesta.put("movimientosRecibidos", procesado.getTransacciones().size());
        respuesta.put("movimientosInsertados", transaccionesAGuardar.size());
        respuesta.put("duplicadosIgnorados", duplicadosIgnorados);
        respuesta.put("movimientosReemplazados", movimientosReemplazados);
        respuesta.put("movimientosGuardados", movimientosGuardados);
        respuesta.put("resumen", resumen);
        return respuesta;
    }

    private void validarArchivo(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Seleccioná un archivo CSV con movimientos.");
        }

        if (archivo.getOriginalFilename() != null
                && !archivo.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".csv")) {
            throw new IllegalArgumentException("El archivo debe tener extensión .csv.");
        }
    }

    private CsvImportResponse procesarConAi(
            String usuarioId,
            byte[] contenido,
            String nombreArchivo) {

        HttpHeaders usuarioHeaders = new HttpHeaders();
        usuarioHeaders.setContentType(MediaType.TEXT_PLAIN);
        HttpEntity<String> usuarioPart = new HttpEntity<>(usuarioId, usuarioHeaders);

        ByteArrayResource archivoResource = new ByteArrayResource(contenido) {
            @Override
            public String getFilename() {
                return nombreArchivo;
            }
        };

        HttpHeaders archivoHeaders = new HttpHeaders();
        archivoHeaders.setContentType(MediaType.parseMediaType("text/csv"));
        archivoHeaders.setContentDispositionFormData("archivo", nombreArchivo);
        HttpEntity<ByteArrayResource> archivoPart = new HttpEntity<>(archivoResource, archivoHeaders);

        MultiValueMap<String, Object> multipartBody = new LinkedMultiValueMap<>();
        multipartBody.add("usuario_id", usuarioPart);
        multipartBody.add("archivo", archivoPart);

        HttpHeaders requestHeaders = new HttpHeaders();
        requestHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);

        HttpEntity<MultiValueMap<String, Object>> requestEntity =
                new HttpEntity<>(multipartBody, requestHeaders);

        CsvImportResponse procesado;
        try {
            procesado = restTemplate.postForObject(
                    aiServiceUrl + "/csv/procesar",
                    requestEntity,
                    CsvImportResponse.class
            );
        } catch (HttpStatusCodeException error) {
            throw new IllegalArgumentException(
                    "El CSV fue rechazado por el AI-Service: " + error.getResponseBodyAsString(),
                    error
            );
        }

        if (procesado == null
                || procesado.getUsuario() == null
                || procesado.getTransacciones() == null) {
            throw new IllegalStateException(
                    "El AI-Service devolvió una respuesta vacía o incompleta."
            );
        }

        return procesado;
    }

    private List<Transaccion> convertirTransacciones(
            Usuario usuario,
            List<CsvImportResponse.TransaccionCsv> items) {

        List<Transaccion> resultado = new ArrayList<>();

        for (CsvImportResponse.TransaccionCsv item : items) {
            Categoria categoria = categoriaRepository.findByNombreIgnoreCase(item.getCategoria())
                    .orElseGet(() -> {
                        Categoria nueva = new Categoria();
                        nueva.setNombre(item.getCategoria());
                        nueva.setDescripcion("Categoría creada durante la importación CSV");
                        nueva.setIcono("wallet");
                        nueva.setColor("#64748B");
                        return categoriaRepository.save(nueva);
                    });

            Transaccion transaccion = new Transaccion();
            transaccion.setId(
                    "C" + UUID.randomUUID()
                            .toString()
                            .replace("-", "")
                            .substring(0, 9)
                            .toUpperCase(Locale.ROOT)
            );
            transaccion.setUsuario(usuario);
            transaccion.setCategoria(categoria);
            transaccion.setSubcategoria(item.getSubcategoria());
            transaccion.setFecha(item.getFecha());
            transaccion.setDescripcion(item.getDescripcion());
            transaccion.setMonto(item.getMonto());
            transaccion.setMoneda("USD");
            transaccion.setTipo(item.getTipo());
            transaccion.setMedioPago(item.getMedioPago());
            transaccion.setRecurrente(item.getRecurrente());
            transaccion.setOrigen("CSV");
            resultado.add(transaccion);
        }

        return resultado;
    }

    private void actualizarMetricasUsuarioDesdeAi(
            Usuario usuario,
            CsvImportResponse.UsuarioCsv datos) {

        usuario.setIngresoMensual(datos.getIngresoMensual());
        usuario.setGastoMensualPromedio(datos.getGastoMensualPromedio());
        usuario.setDeudaMensual(datos.getDeudaMensual());
        usuario.setAhorroMensualEstimado(datos.getAhorroMensualEstimado());
        usuario.setPorcentajeGastosIngreso(datos.getPorcentajeGastosIngreso());
        usuario.setNivelEndeudamiento(datos.getNivelEndeudamiento());
        usuario.setFrecuenciaAhorro(datos.getFrecuenciaAhorro());

        // El perfil NO se copia desde /csv/procesar.
        // AnalisisService es la única fuente de verdad para perfilFinanciero.
        usuario.setActivo(true);
        if (usuario.getFechaRegistro() == null) {
            usuario.setFechaRegistro(LocalDateTime.now());
        }
    }

    /**
     * Replica el contrato que usa frontend/src/utils/construirAnalisisRequest.ts:
     * toma las métricas actuales del usuario y envía al análisis únicamente
     * movimientos de tipo GASTO con descripción, monto y fecha.
     *
     * Mantener esta construcción alineada con el frontend evita que una
     * importación y una recarga del Dashboard produzcan perfiles distintos.
     */
    private AnalisisRequest construirAnalisisRequestComoFrontend(
            Usuario usuario,
            List<Transaccion> historial) {

        AnalisisRequest request = new AnalisisRequest();

        request.setIngresoMensual(
                usuario.getIngresoMensual() != null
                        ? usuario.getIngresoMensual()
                        : BigDecimal.ZERO
        );

        request.setNivelEndeudamiento(
                usuario.getNivelEndeudamiento() != null
                        ? usuario.getNivelEndeudamiento()
                        : BigDecimal.ZERO
        );

        String frecuencia = usuario.getFrecuenciaAhorro();
        if (!Set.of("Alta", "Media", "Baja", "Nunca").contains(frecuencia)) {
            frecuencia = "Nunca";
        }
        request.setFrecuenciaAhorro(frecuencia);

        List<TransaccionDTO> gastos = new ArrayList<>();

        for (Transaccion transaccion : historial) {
            if (transaccion.getTipo() == null
                    || !transaccion.getTipo().trim().equalsIgnoreCase("GASTO")
                    || transaccion.getMonto() == null
                    || transaccion.getMonto().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            TransaccionDTO dto = new TransaccionDTO();
            dto.setDescripcion(transaccion.getDescripcion());
            dto.setValor(transaccion.getMonto());
            dto.setFecha(transaccion.getFecha());

            gastos.add(dto);
        }

        if (gastos.isEmpty()) {
            throw new IllegalStateException(
                    "No hay gastos válidos para recalcular el perfil financiero."
            );
        }

        request.setTransacciones(gastos);
        return request;
    }

    private Map<String, Object> construirResumen(List<Transaccion> historial) {
        BigDecimal totalIngresos = BigDecimal.ZERO;
        BigDecimal totalGastos = BigDecimal.ZERO;
        Set<YearMonth> meses = new LinkedHashSet<>();

        for (Transaccion transaccion : historial) {
            if (transaccion.getFecha() != null) {
                meses.add(YearMonth.from(transaccion.getFecha()));
            }

            BigDecimal monto = transaccion.getMonto() == null
                    ? BigDecimal.ZERO
                    : transaccion.getMonto().abs();
            String tipo = transaccion.getTipo() == null
                    ? ""
                    : transaccion.getTipo().trim();

            if (tipo.equalsIgnoreCase("Ingreso")) {
                totalIngresos = totalIngresos.add(monto);
            } else if (tipo.equalsIgnoreCase("Gasto")) {
                totalGastos = totalGastos.add(monto);
            }
        }

        Map<String, Object> resumen = new LinkedHashMap<>();
        resumen.put("cantidadTransacciones", historial.size());
        resumen.put("cantidadMeses", meses.size());
        resumen.put("totalIngresos", totalIngresos);
        resumen.put("totalGastos", totalGastos);
        resumen.put("moneda", "USD");
        return resumen;
    }

    private byte[] construirCsv(List<Transaccion> historial) {
        StringBuilder csv = new StringBuilder();
        csv.append("fecha,descripcion,monto,tipo,categoria,subcategoria,medio_pago,recurrente\n");

        for (Transaccion t : historial) {
            csv.append(csvCampo(t.getFecha() != null ? t.getFecha().toString() : ""))
                    .append(',')
                    .append(csvCampo(t.getDescripcion()))
                    .append(',')
                    .append(csvCampo(t.getMonto() != null ? t.getMonto().toPlainString() : "0"))
                    .append(',')
                    .append(csvCampo(t.getTipo()))
                    .append(',')
                    .append(csvCampo(t.getCategoria() != null ? t.getCategoria().getNombre() : "Otros"))
                    .append(',')
                    .append(csvCampo(t.getSubcategoria()))
                    .append(',')
                    .append(csvCampo(t.getMedioPago()))
                    .append(',')
                    .append(csvCampo(Boolean.TRUE.equals(t.getRecurrente()) ? "Sí" : "No"))
                    .append('\n');
        }

        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private String csvCampo(String valor) {
        String seguro = valor == null ? "" : valor;
        return "\"" + seguro.replace("\"", "\"\"") + "\"";
    }

    private String huella(Transaccion t) {
        return huellaBase(
                t.getFecha(),
                t.getDescripcion(),
                t.getMonto(),
                t.getTipo(),
                t.getMedioPago()
        );
    }

    private String huella(CsvImportResponse.TransaccionCsv t) {
        return huellaBase(
                t.getFecha(),
                t.getDescripcion(),
                t.getMonto(),
                t.getTipo(),
                t.getMedioPago()
        );
    }

    private String huellaBase(
            LocalDate fecha,
            String descripcion,
            BigDecimal monto,
            String tipo,
            String medioPago) {

        String montoNormalizado = monto == null
                ? "0"
                : monto.abs().stripTrailingZeros().toPlainString();

        return String.join("|",
                fecha == null ? "" : fecha.toString(),
                normalizarTexto(descripcion),
                montoNormalizado,
                normalizarTexto(tipo),
                normalizarTexto(medioPago)
        );
    }

    private String normalizarTexto(String valor) {
        String texto = valor == null ? "" : valor.trim().toLowerCase(Locale.ROOT);
        texto = Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return texto.replaceAll("\\s+", " ");
    }

    private String mensajePorModo(ModoImportacion modo) {
        return switch (modo) {
            case CARGAR -> "CSV cargado correctamente";
            case ACTUALIZAR -> "Movimientos actualizados correctamente";
            case SOBREESCRIBIR -> "Período sobreescrito correctamente";
        };
    }
}
