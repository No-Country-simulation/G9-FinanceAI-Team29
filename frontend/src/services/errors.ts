export class NotFoundError extends Error {
  constructor(message = 'El recurso solicitado no existe.') {
    super(message);
    this.name = 'NotFoundError';
  }
}
