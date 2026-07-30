package com.financeai.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.HashMap;
import java.util.Map;

/** Manejo centralizado de errores para toda la API. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /** Errores de validación de @Valid en el cuerpo (@RequestBody). */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest req) {

        Map<String, String> errores = new HashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            errores.put(fe.getField(), fe.getDefaultMessage());
        }
        ErrorResponse body = new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(), "Bad Request",
            "La solicitud contiene datos inválidos", req.getRequestURI());
        body.setValidationErrors(errores);
        return ResponseEntity.badRequest().body(body);
    }

    /** Errores de validación de parámetros (@RequestParam / @PathVariable). */
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraint(
            ConstraintViolationException ex, HttpServletRequest req) {
        return ResponseEntity.badRequest().body(new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(), "Bad Request",
            ex.getMessage(), req.getRequestURI()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(
            IllegalArgumentException ex, HttpServletRequest req) {
        return ResponseEntity.badRequest().body(new ErrorResponse(
            HttpStatus.BAD_REQUEST.value(), "Bad Request",
            ex.getMessage(), req.getRequestURI()));
    }

    /** Método HTTP incorrecto (p. ej. abrir en el navegador un endpoint POST). */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException ex, HttpServletRequest req) {
        String soportados = ex.getSupportedHttpMethods() == null ? "" : ex.getSupportedHttpMethods().toString();
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(new ErrorResponse(
            HttpStatus.METHOD_NOT_ALLOWED.value(), "Method Not Allowed",
            "El método " + ex.getMethod() + " no está permitido en esta ruta. Métodos válidos: " + soportados,
            req.getRequestURI()));
    }

    /** Recurso estático inexistente (p. ej. /favicon.ico). Se devuelve 404 sin ruido en logs. */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoResource(
            NoResourceFoundException ex, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(
            HttpStatus.NOT_FOUND.value(), "Not Found",
            "Recurso no encontrado", req.getRequestURI()));
    }

    /** Cualquier otro error no controlado. */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex, HttpServletRequest req) {
        log.error("Error no controlado en {}", req.getRequestURI(), ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ErrorResponse(
            HttpStatus.INTERNAL_SERVER_ERROR.value(), "Internal Server Error",
            "Ocurrió un error inesperado", req.getRequestURI()));
    }
}
