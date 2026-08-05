package com.financeai.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RecomendacionDTO {
    private String id;
    private String tipo;
    private String perfil;
    private String prioridad;
    private String titulo;
    private String diagnostico;
    private String accion;
    private String objetivo;
    private Map<String, Object> evidencia;

    @JsonProperty("pregunta_finsi")
    private String preguntaFinsi;

    private String advertencia;

    public RecomendacionDTO() {}

    public RecomendacionDTO(String id, String tipo, String perfil, String prioridad, String titulo,
            String diagnostico, String accion, String objetivo, Map<String, Object> evidencia,
            String preguntaFinsi, String advertencia) {
        this.id = id; this.tipo = tipo; this.perfil = perfil; this.prioridad = prioridad;
        this.titulo = titulo; this.diagnostico = diagnostico; this.accion = accion;
        this.objetivo = objetivo; this.evidencia = evidencia; this.preguntaFinsi = preguntaFinsi;
        this.advertencia = advertencia;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTipo() { return tipo; }
    public void setTipo(String tipo) { this.tipo = tipo; }
    public String getPerfil() { return perfil; }
    public void setPerfil(String perfil) { this.perfil = perfil; }
    public String getPrioridad() { return prioridad; }
    public void setPrioridad(String prioridad) { this.prioridad = prioridad; }
    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getDiagnostico() { return diagnostico; }
    public void setDiagnostico(String diagnostico) { this.diagnostico = diagnostico; }
    public String getAccion() { return accion; }
    public void setAccion(String accion) { this.accion = accion; }
    public String getObjetivo() { return objetivo; }
    public void setObjetivo(String objetivo) { this.objetivo = objetivo; }
    public Map<String, Object> getEvidencia() { return evidencia; }
    public void setEvidencia(Map<String, Object> evidencia) { this.evidencia = evidencia; }
    public String getPreguntaFinsi() { return preguntaFinsi; }
    public void setPreguntaFinsi(String preguntaFinsi) { this.preguntaFinsi = preguntaFinsi; }
    public String getAdvertencia() { return advertencia; }
    public void setAdvertencia(String advertencia) { this.advertencia = advertencia; }
}
