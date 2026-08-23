package com.financeai.exception;

/** Login con credenciales correctas pero email sin confirmar. El controller la mapea a 403. */
public class EmailNoConfirmadoException extends RuntimeException {
    public EmailNoConfirmadoException(String mensaje) {
        super(mensaje);
    }
}
