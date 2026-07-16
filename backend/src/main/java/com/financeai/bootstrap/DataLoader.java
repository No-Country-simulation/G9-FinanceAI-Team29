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
 * Carga los datos sintéticos (usuarios y transacciones) desde los CSV de
 * classpath la primera vez que arranca la aplicación. Es idempotente: si ya
 * hay usuarios en la base de datos no vuelve a cargar nada.
 */
@Component
public class DataLoader implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataLoader.class);

    private static final String USUARIOS_CSV = "data/usuarios.csv";
    private static final String TRANSACCIONES_CSV = "data/transacciones.csv";

    private final UsuarioRepository usuarioRepository;
    private final TransaccionRepository transaccionRepository;
    private final CategoriaRepository categoriaRepository;

    public DataLoader(UsuarioRepository usuarioRepository,
                      TransaccionRepository transaccionRepository,
                      CategoriaRepository categoriaRepository) {
        this.usuarioRepository = usuarioRepository;
        this.transaccionRepository = transaccionRepository;
        this.categoriaRepository = categoriaRepository;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (usuarioRepository.count() > 0) {
            log.info("Datos ya cargados ({} usuarios). Se omite la carga inicial.",
                usuarioRepository.count());
            return;
        }

        long inicio = System.currentTimeMillis();
        Map<String, Usuario> usuarios = cargarUsuarios();
        cargarTransacciones(usuarios);
        log.info("Carga inicial completada en {} ms: {} usuarios, {} transacciones.",
            System.currentTimeMillis() - inicio,
            usuarioRepository.count(), transaccionRepository.count());
    }

    private Map<String, Usuario> cargarUsuarios() {
        Map<String, Usuario> porId = new HashMap<>();
        List<Usuario> usuarios = new ArrayList<>();

        for (String[] c : leerCsv(USUARIOS_CSV)) {
            // 0 id, 1 ingreso, 2 deuda, 3 nivel_end, 4 gasto_prom,
            // 5 ahorro_est, 6 pct_gastos, 7 frec_ahorro, 8 perfil
            Usuario u = new Usuario();
            u.setId(c[0]);
            u.setIngresoMensual(parseDecimal(c[1]));
            u.setDeudaMensual(parseDecimal(c[2]));
            u.setNivelEndeudamiento(parseDecimal(c[3]));
            u.setGastoMensualPromedio(parseDecimal(c[4]));
            u.setAhorroMensualEstimado(parseDecimal(c[5]));
            u.setPorcentajeGastosIngreso(parseDecimal(c[6]));
            u.setFrecuenciaAhorro(vacioANull(c[7]));
            u.setPerfilFinanciero(vacioANull(c[8]));
            u.setFechaRegistro(LocalDateTime.now());
            u.setActivo(true);
            usuarios.add(u);
            porId.put(u.getId(), u);
        }

        usuarioRepository.saveAll(usuarios);
        log.info("Usuarios cargados: {}", usuarios.size());
        return porId;
    }

    private void cargarTransacciones(Map<String, Usuario> usuarios) {
        // Se mapea la categoría por NOMBRE (fuente autoritativa del CSV sintético),
        // no por id, para evitar el desajuste de acentos del dataset "ready".
        Map<String, Categoria> categorias = new HashMap<>();
        for (Categoria cat : categoriaRepository.findAll()) {
            categorias.put(cat.getNombre(), cat);
        }

        List<Transaccion> transacciones = new ArrayList<>();
        int omitidas = 0;
        int sinCategoria = 0;

        for (String[] c : leerCsv(TRANSACCIONES_CSV)) {
            // 0 transaction_id, 1 usuario_id, 2 fecha, 3 descripcion, 4 monto,
            // 5 moneda, 6 categoria (nombre), 7 recurrente, 8 medio_pago
            Usuario usuario = usuarios.get(c[1]);
            if (usuario == null) {
                omitidas++;
                continue;
            }

            Categoria categoria = categorias.get(vacioANull(c[6]));
            if (categoria == null) sinCategoria++;

            Transaccion t = new Transaccion();
            t.setId(c[0]);
            t.setUsuario(usuario);
            t.setCategoria(categoria);
            t.setDescripcion(vacioANull(c[3]));
            t.setMonto(parseDecimal(c[4]));
            t.setMoneda(vacioANull(c[5]));
            t.setFecha(parseFecha(c[2]));
            t.setRecurrente(parseBool(c[7]));
            t.setMedioPago(vacioANull(c[8]));
            t.setTipo("Gasto");   // el dataset sintético solo contiene gastos
            t.setOrigen("CSV");
            transacciones.add(t);
        }

        transaccionRepository.saveAll(transacciones);
        log.info("Transacciones cargadas: {} (omitidas por usuario inexistente: {}, sin categoría: {})",
            transacciones.size(), omitidas, sinCategoria);
    }

    // ---------- Lectura y parseo de CSV ----------

    /** Lee un CSV de classpath, salta la cabecera y devuelve las filas ya tokenizadas. */
    private List<String[]> leerCsv(String ruta) {
        List<String[]> filas = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new ClassPathResource(ruta).getInputStream(), StandardCharsets.UTF_8))) {
            String linea;
            boolean cabecera = true;
            while ((linea = reader.readLine()) != null) {
                if (cabecera) {            // descarta cabecera (y su BOM)
                    cabecera = false;
                    continue;
                }
                if (linea.isBlank()) continue;
                filas.add(tokenizar(linea));
            }
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo leer el CSV: " + ruta, e);
        }
        return filas;
    }

    /** Divide una línea CSV respetando comillas dobles. */
    private String[] tokenizar(String linea) {
        List<String> campos = new ArrayList<>();
        StringBuilder actual = new StringBuilder();
        boolean enComillas = false;

        for (int i = 0; i < linea.length(); i++) {
            char ch = linea.charAt(i);
            if (ch == '"') {
                // comilla escapada ("") dentro de un campo entrecomillado
                if (enComillas && i + 1 < linea.length() && linea.charAt(i + 1) == '"') {
                    actual.append('"');
                    i++;
                } else {
                    enComillas = !enComillas;
                }
            } else if (ch == ',' && !enComillas) {
                campos.add(actual.toString());
                actual.setLength(0);
            } else {
                actual.append(ch);
            }
        }
        campos.add(actual.toString());
        return campos.toArray(new String[0]);
    }

    private String vacioANull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private BigDecimal parseDecimal(String s) {
        String t = vacioANull(s);
        return t == null ? null : new BigDecimal(t);
    }

    private LocalDate parseFecha(String s) {
        String t = vacioANull(s);
        return t == null ? null : LocalDate.parse(t);
    }

    private Boolean parseBool(String s) {
        String t = vacioANull(s);
        if (t == null) return null;
        return t.equalsIgnoreCase("t") || t.equalsIgnoreCase("true")
            || t.equalsIgnoreCase("si") || t.equalsIgnoreCase("sí");
    }
}
