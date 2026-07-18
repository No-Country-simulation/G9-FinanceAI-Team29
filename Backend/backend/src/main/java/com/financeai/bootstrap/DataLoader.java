package com.financeai.bootstrap;

import com.financeai.model.Categoria;
import com.financeai.model.Transaccion;
import com.financeai.model.Usuario;
import com.financeai.repository.CategoriaRepository;
import com.financeai.repository.TransaccionRepository;
import com.financeai.repository.UsuarioRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Carga los datos sintéticos de usuarios y transacciones desde archivos CSV.
 *
 * La carga se ejecuta únicamente cuando la tabla de usuarios está vacía.
 *
 * Archivos esperados:
 *
 * data/usuarios.csv
 * data/transacciones.csv
 */
@Component
public class DataLoader implements CommandLineRunner {

    private static final Logger log =
        LoggerFactory.getLogger(DataLoader.class);

    private static final String USUARIOS_CSV =
        "data/usuarios.csv";

    private static final String TRANSACCIONES_CSV =
        "data/transacciones.csv";

    private final UsuarioRepository usuarioRepository;
    private final TransaccionRepository transaccionRepository;
    private final CategoriaRepository categoriaRepository;

    public DataLoader(
        UsuarioRepository usuarioRepository,
        TransaccionRepository transaccionRepository,
        CategoriaRepository categoriaRepository
    ) {
        this.usuarioRepository = usuarioRepository;
        this.transaccionRepository = transaccionRepository;
        this.categoriaRepository = categoriaRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {

        long cantidadUsuarios = usuarioRepository.count();

        if (cantidadUsuarios > 0) {
            log.info(
                "Datos ya cargados ({} usuarios). Se omite la carga inicial.",
                cantidadUsuarios
            );
            return;
        }

        long inicio = System.currentTimeMillis();

        Map<String, Usuario> usuarios = cargarUsuarios();

        cargarTransacciones(usuarios);

        log.info(
            "Carga inicial completada en {} ms: {} usuarios, {} transacciones.",
            System.currentTimeMillis() - inicio,
            usuarioRepository.count(),
            transaccionRepository.count()
        );
    }

    private Map<String, Usuario> cargarUsuarios() {

        Map<String, Usuario> usuariosPorId = new HashMap<>();
        List<Usuario> usuarios = new ArrayList<>();

        for (String[] columnas : leerCsv(USUARIOS_CSV)) {

            /*
             * Índices esperados en usuarios.csv:
             *
             * 0 usuario_id
             * 1 ingreso_mensual
             * 2 deuda_mensual
             * 3 nivel_endeudamiento
             * 4 gasto_mensual_promedio
             * 5 ahorro_mensual_estimado
             * 6 porcentaje_gastos_ingreso
             * 7 frecuencia_ahorro
             * 8 perfil_financiero
             */

            validarCantidadColumnas(
                columnas,
                9,
                USUARIOS_CSV
            );

            Usuario usuario = new Usuario();

            usuario.setId(vacioANull(columnas[0]));
            usuario.setIngresoMensual(
                parseDecimal(columnas[1])
            );
            usuario.setDeudaMensual(
                parseDecimal(columnas[2])
            );
            usuario.setNivelEndeudamiento(
                parseDecimal(columnas[3])
            );
            usuario.setGastoMensualPromedio(
                parseDecimal(columnas[4])
            );
            usuario.setAhorroMensualEstimado(
                parseDecimal(columnas[5])
            );
            usuario.setPorcentajeGastosIngreso(
                parseDecimal(columnas[6])
            );
            usuario.setFrecuenciaAhorro(
                vacioANull(columnas[7])
            );
            usuario.setPerfilFinanciero(
                vacioANull(columnas[8])
            );
            usuario.setFechaRegistro(
                LocalDateTime.now()
            );
            usuario.setActivo(true);

            usuarios.add(usuario);
            usuariosPorId.put(
                usuario.getId(),
                usuario
            );
        }

        usuarioRepository.saveAll(usuarios);

        log.info(
            "Usuarios cargados: {}",
            usuarios.size()
        );

        return usuariosPorId;
    }

    private void cargarTransacciones(
        Map<String, Usuario> usuarios
    ) {

        Map<String, Categoria> categoriasPorNombre =
            new HashMap<>();

        for (Categoria categoria :
            categoriaRepository.findAll()) {

            if (categoria.getNombre() != null) {
                categoriasPorNombre.put(
                    categoria.getNombre().trim(),
                    categoria
                );
            }
        }

        List<Transaccion> transacciones =
            new ArrayList<>();

        int omitidasPorUsuario = 0;
        int sinCategoria = 0;

        for (String[] columnas :
            leerCsv(TRANSACCIONES_CSV)) {

            /*
             * Índices esperados en transacciones.csv:
             *
             * 0 transaction_id
             * 1 usuario_id
             * 2 fecha
             * 3 descripcion
             * 4 monto
             * 5 moneda
             * 6 tipo
             * 7 categoria
             * 8 recurrente
             * 9 medio_pago
             */

            validarCantidadColumnas(
                columnas,
                10,
                TRANSACCIONES_CSV
            );

            String usuarioId =
                vacioANull(columnas[1]);

            Usuario usuario =
                usuarios.get(usuarioId);

            if (usuario == null) {
                omitidasPorUsuario++;

                log.warn(
                    "Se omite la transacción {} porque el usuario {} no existe.",
                    columnas[0],
                    usuarioId
                );

                continue;
            }

            String nombreCategoria =
                vacioANull(columnas[7]);

            Categoria categoria = null;

            if (nombreCategoria != null) {
                categoria =
                    categoriasPorNombre.get(
                        nombreCategoria
                    );
            }

            if (categoria == null) {
                sinCategoria++;

                log.warn(
                    "La transacción {} no encontró la categoría '{}'.",
                    columnas[0],
                    nombreCategoria
                );
            }

            Transaccion transaccion =
                new Transaccion();

            transaccion.setId(
                vacioANull(columnas[0])
            );
            transaccion.setUsuario(usuario);
            transaccion.setFecha(
                parseFecha(columnas[2])
            );
            transaccion.setDescripcion(
                vacioANull(columnas[3])
            );
            transaccion.setMonto(
                parseDecimal(columnas[4])
            );
            transaccion.setMoneda(
                vacioANull(columnas[5])
            );
            transaccion.setTipo(
                normalizarTipo(columnas[6])
            );
            transaccion.setCategoria(categoria);
            transaccion.setRecurrente(
                parseBool(columnas[8])
            );
            transaccion.setMedioPago(
                vacioANull(columnas[9])
            );
            transaccion.setOrigen("CSV");

            transacciones.add(transaccion);
        }

        transaccionRepository.saveAll(
            transacciones
        );

        log.info(
            "Transacciones cargadas: {} " +
            "(omitidas por usuario inexistente: {}, " +
            "sin categoría: {}).",
            transacciones.size(),
            omitidasPorUsuario,
            sinCategoria
        );
    }

    /**
     * Lee un CSV desde el classpath, descarta la cabecera
     * y devuelve sus filas tokenizadas.
     */
    private List<String[]> leerCsv(String ruta) {

        List<String[]> filas =
            new ArrayList<>();

        try (
            BufferedReader reader =
                new BufferedReader(
                    new InputStreamReader(
                        new ClassPathResource(ruta)
                            .getInputStream(),
                        StandardCharsets.UTF_8
                    )
                )
        ) {
            String linea;
            boolean cabecera = true;

            while ((linea = reader.readLine()) != null) {

                if (cabecera) {
                    cabecera = false;
                    continue;
                }

                if (linea.isBlank()) {
                    continue;
                }

                filas.add(tokenizar(linea));
            }

        } catch (Exception e) {
            throw new IllegalStateException(
                "No se pudo leer el CSV: " + ruta,
                e
            );
        }

        return filas;
    }

    /**
     * Divide una línea CSV respetando campos entre comillas.
     */
    private String[] tokenizar(String linea) {

        List<String> campos =
            new ArrayList<>();

        StringBuilder campoActual =
            new StringBuilder();

        boolean enComillas = false;

        for (int i = 0; i < linea.length(); i++) {

            char caracter = linea.charAt(i);

            if (caracter == '"') {

                boolean esComillaEscapada =
                    enComillas
                    && i + 1 < linea.length()
                    && linea.charAt(i + 1) == '"';

                if (esComillaEscapada) {
                    campoActual.append('"');
                    i++;
                } else {
                    enComillas = !enComillas;
                }

            } else if (
                caracter == ','
                && !enComillas
            ) {
                campos.add(
                    campoActual.toString()
                );

                campoActual.setLength(0);

            } else {
                campoActual.append(caracter);
            }
        }

        campos.add(
            campoActual.toString()
        );

        return campos.toArray(
            new String[0]
        );
    }

    private void validarCantidadColumnas(
        String[] columnas,
        int cantidadEsperada,
        String archivo
    ) {
        if (columnas.length < cantidadEsperada) {
            throw new IllegalArgumentException(
                "Fila inválida en "
                + archivo
                + ". Se esperaban al menos "
                + cantidadEsperada
                + " columnas, pero se encontraron "
                + columnas.length
                + "."
            );
        }
    }

    private String vacioANull(String valor) {

        if (valor == null) {
            return null;
        }

        String texto = valor.trim();

        return texto.isEmpty()
            ? null
            : texto;
    }

    private BigDecimal parseDecimal(
        String valor
    ) {
        String texto =
            vacioANull(valor);

        return texto == null
            ? null
            : new BigDecimal(texto);
    }

    private LocalDate parseFecha(
        String valor
    ) {
        String texto =
            vacioANull(valor);

        return texto == null
            ? null
            : LocalDate.parse(texto);
    }

    private Boolean parseBool(
        String valor
    ) {
        String texto =
            vacioANull(valor);

        if (texto == null) {
            return null;
        }

        return texto.equalsIgnoreCase("t")
            || texto.equalsIgnoreCase("true")
            || texto.equalsIgnoreCase("si")
            || texto.equalsIgnoreCase("sí")
            || texto.equals("1");
    }

    private String normalizarTipo(
        String valor
    ) {
        String tipo =
            vacioANull(valor);

        if (tipo == null) {
            return null;
        }

        if (
            tipo.equalsIgnoreCase("gasto")
            || tipo.equalsIgnoreCase("expense")
            || tipo.equalsIgnoreCase("egreso")
        ) {
            return "Gasto";
        }

        if (
            tipo.equalsIgnoreCase("ingreso")
            || tipo.equalsIgnoreCase("income")
        ) {
            return "Ingreso";
        }

        log.warn(
            "Tipo de transacción desconocido: '{}'. Se conserva el valor original.",
            tipo
        );

        return tipo;
    }
}