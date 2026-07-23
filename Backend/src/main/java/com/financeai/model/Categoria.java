package com.financeai.model;

import jakarta.persistence.*;
import org.springframework.web.bind.annotation.CrossOrigin;

@Entity
@Table(name = "categorias")
@CrossOrigin(origins = "*")
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nombre", unique = true, length = 50)
    private String nombre;

    @Column(name = "descripcion", length = 200)
    private String descripcion;

    @Column(name = "icono", length = 50)
    private String icono;

    @Column(name = "color", length = 7)
    private String color;

    public Categoria() {}

    public Categoria(String nombre, String descripcion, String icono, String color) {
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.icono = icono;
        this.color = color;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getDescripcion() { return descripcion; }
    public void setDescripcion(String descripcion) { this.descripcion = descripcion; }

    public String getIcono() { return icono; }
    public void setIcono(String icono) { this.icono = icono; }

    public String getColor() { return color; }
    public void setColor(String color) { this.color = color; }
}
