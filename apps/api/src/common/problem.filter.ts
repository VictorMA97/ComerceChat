import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ProblemDetails } from '@comercechat/shared-types';
import type { Request, Response } from 'express';
import { AppError } from './app-error.js';

const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'RATE_LIMITED',
};

/** Convierte cualquier excepción en application/problem+json (ARCHITECTURE §11). */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    let problem: ProblemDetails;
    if (exception instanceof AppError) {
      problem = this.base(exception.getStatus(), exception.code, exception.title, exception.detail);
    } else if (exception instanceof BadRequestException) {
      const body = exception.getResponse() as { message?: string | string[] };
      const messages = Array.isArray(body.message) ? body.message : [body.message ?? 'Petición inválida'];
      problem = this.base(400, 'VALIDATION_FAILED', 'La petición no es válida');
      problem.errors = { body: messages.filter((m): m is string => typeof m === 'string') };
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      problem = this.base(status, DEFAULT_CODES[status] ?? `HTTP_${status}`, exception.message);
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
      problem = this.base(500, 'INTERNAL_ERROR', 'Error interno');
    }

    problem.instance = req.originalUrl;
    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private base(status: number, code: string, title: string, detail?: string): ProblemDetails {
    return {
      type: `https://docs.comercechat.es/errors/${code.toLowerCase().replaceAll('_', '-')}`,
      title,
      status: status || HttpStatus.INTERNAL_SERVER_ERROR,
      code,
      ...(detail ? { detail } : {}),
    };
  }
}
