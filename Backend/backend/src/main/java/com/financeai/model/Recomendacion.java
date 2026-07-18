package com.financeai.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "recomendaciones")
public class Recomendacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "usuario_id", referencedColumnName = "id")
    private Usuario usuario;

    @Column(name = "texto", length = 500)
    private String texto;

    @Column(name = "prioridad", length = 10)
    private String prioridad;

    @Column(name = "categoria_recomendada", length = 50)
    private String categoriaRecomendada;

    @Column(name = "activa")
    private Boolean activa = true;

    @Column(name = "fecha_creacion")
    private LocalDateTime fechaCreacion;

    public Recomendacion() {}

    public Recomendacion(Usuario usuario, String texto, String prioridad, String categoriaRecomendada) {
        this.usuario = usuario;
        this.texto = texto;
        this.prioridad = prioridad;
        this.categoriaRecomendada = categoriaRecomendada;
        this.activa = true;
        this.fechaCreacion = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Usuario getUsuario() { return usuario; }
    public void setUsuario(Usuario usuario) { this.usuario = usuario; }

    public String getTexto() { return texto; }
    public void setTexto(String texto) { this.texto = texto; }

    public String getPrioridad() { return prioridad; }
    public void setPrioridad(String prioridad) { this.prioridad = prioridad; }

    public String getCategoriaRecomendada() { return categoriaRecomendada; }
    public void setCategoriaRecomendada(String categoriaRecomendada) { this.categoriaRecomendada = categoriaRecomendada; }

    public Boolean getActiva() { return activa; }
    public void setActiva(Boolean activa) { this.activa = activa; }

    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }
}
