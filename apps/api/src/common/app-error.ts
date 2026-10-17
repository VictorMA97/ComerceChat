import { HttpException, HttpStatus } from '@nestjs/common';

/** Error de dominio con un `code` estable que se expone en el problem+json (RFC 9457). */
export class AppError extends HttpException {
  constructor(
    readonly code: string,
    status: HttpStatus,
    readonly title: string,
    readonly detail?: string,
  ) {
    super({ code, title, detail }, status);
  }
}
