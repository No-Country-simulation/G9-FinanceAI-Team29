package com.financeai.service;

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
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Set;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CsvImportService {
    private final UsuarioRepository usuarioRepository;
    private final TransaccionRepository transaccionRepository;
    private final CategoriaRepository categoriaRepository;
    private final RestTemplate restTemplate;
    private final String aiServiceUrl;

    public CsvImportService(
            UsuarioRepository usuarioRepository,
            TransaccionRepository transaccionRepository,
            CategoriaRepository categoriaRepository,
            @Value("${ml.service.url:http://127.0.0.1:8000}") String aiServiceUrl) {
        this.usuarioRepository = usuarioRepository;
        this.transaccionRepository = transaccionRepository;
        this.categoriaRepository = categoriaRepository;
        this.restTemplate = new RestTemplate();
        this.aiServiceUrl = aiServiceUrl;
    }

    @Transactional
    public Map<String, Object> importar(String usuarioId, MultipartFile archivo) throws Exception {
        if (archivo == null || archivo.isEmpty()) {
            throw new IllegalArgumentException("Seleccioná un archivo CSV con movimientos.");
        }
        if (archivo.getOriginalFilename() != null &&
                !archivo.getOriginalFilename().toLowerCase().endsWith(".csv")) {
            throw new IllegalArgumentException("El archivo debe tener extensión .csv.");
        }

        String nombreArchivo = archivo.getOriginalFilename() == null
                ? "movimientos.csv"
                : archivo.getOriginalFilename();

        HttpHeaders usuarioHeaders = new HttpHeaders();
        usuarioHeaders.setContentType(MediaType.TEXT_PLAIN);
        HttpEntity<String> usuarioPart = new HttpEntity<>(usuarioId, usuarioHeaders);

        ByteArrayResource archivoResource = new ByteArrayResource(archivo.getBytes()) {
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

        if (procesado == null || procesado.getUsuario() == null || procesado.getTransacciones() == null) {
            throw new IllegalStateException("El AI-Service devolvió una respuesta vacía o incompleta.");
        }

        CsvImportResponse.UsuarioCsv datos = procesado.getUsuario();
        Usuario usuario = usuarioRepository.findById(usuarioId).orElseGet(Usuario::new);
        usuario.setId(usuarioId);
        usuario.setIngresoMensual(datos.getIngresoMensual());
        usuario.setGastoMensualPromedio(datos.getGastoMensualPromedio());
        usuario.setDeudaMensual(datos.getDeudaMensual());
        usuario.setAhorroMensualEstimado(datos.getAhorroMensualEstimado());
        usuario.setPorcentajeGastosIngreso(datos.getPorcentajeGastosIngreso());
        usuario.setNivelEndeudamiento(datos.getNivelEndeudamiento());
        usuario.setFrecuenciaAhorro(datos.getFrecuenciaAhorro());
        usuario.setPerfilFinanciero(datos.getPerfilFinanciero());
        usuario.setActivo(true);
        if (usuario.getFechaRegistro() == null) usuario.setFechaRegistro(LocalDateTime.now());
        usuarioRepository.save(usuario);

        // Para el MVP, volver a cargar el CSV reemplaza los movimientos previos del usuario demo.
        transaccionRepository.deleteByUsuarioId(usuarioId);
        transaccionRepository.flush();

        if (procesado.getTransacciones().isEmpty()) {
            throw new IllegalArgumentException(
                    "El CSV fue procesado, pero no contiene movimientos válidos para guardar."
            );
        }

        List<Transaccion> transaccionesAGuardar = new ArrayList<>();

        for (CsvImportResponse.TransaccionCsv item : procesado.getTransacciones()) {
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
            // La columna actual admite 10 caracteres; generamos un ID compacto y único.
            transaccion.setId("C" + UUID.randomUUID().toString().replace("-", "").substring(0, 9).toUpperCase());
            transaccion.setUsuario(usuario);
            transaccion.setCategoria(categoria);
            transaccion.setFecha(item.getFecha());
            transaccion.setDescripcion(item.getDescripcion());
            transaccion.setMonto(item.getMonto());
            transaccion.setMoneda("USD");
            transaccion.setTipo(item.getTipo());
            transaccion.setMedioPago(item.getMedioPago());
            transaccion.setRecurrente(item.getRecurrente());
            transaccion.setOrigen("CSV");
            transaccionesAGuardar.add(transaccion);
        }

        transaccionRepository.saveAllAndFlush(transaccionesAGuardar);

        long movimientosGuardados = transaccionRepository.countByUsuarioId(usuarioId);
        if (movimientosGuardados != transaccionesAGuardar.size()) {
            throw new IllegalStateException(
                    "La base de datos no confirmó todos los movimientos. Esperados: "
                            + transaccionesAGuardar.size() + ", guardados: " + movimientosGuardados
            );
        }

        // El resumen del AI-Service puede venir vacío o con valores en cero.
        // Lo calculamos a partir de las mismas transacciones confirmadas por la base.
        BigDecimal totalIngresos = BigDecimal.ZERO;
        BigDecimal totalGastos = BigDecimal.ZERO;
        Set<YearMonth> meses = new HashSet<>();

        for (Transaccion transaccion : transaccionesAGuardar) {
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
        resumen.put("cantidadTransacciones", movimientosGuardados);
        resumen.put("cantidadMeses", meses.size());
        resumen.put("totalIngresos", totalIngresos);
        resumen.put("totalGastos", totalGastos);
        resumen.put("moneda", "USD");

        Map<String, Object> respuesta = new LinkedHashMap<>();
        respuesta.put("mensaje", "CSV importado correctamente");
        respuesta.put("usuarioId", usuarioId);
        respuesta.put("perfilFinanciero", usuario.getPerfilFinanciero());
        respuesta.put("movimientosGuardados", movimientosGuardados);
        respuesta.put("resumen", resumen);
        return respuesta;
    }
}