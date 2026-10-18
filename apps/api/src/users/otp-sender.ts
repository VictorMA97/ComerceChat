import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { ENV, type Env } from '../config/env.js';

/** Envío del código de un solo uso (D-04: SMS/WhatsApp en el MVP). */
export interface OtpSender {
  send(phone: string, code: string): Promise<void>;
}

export const OTP_SENDER = Symbol('OTP_SENDER');

/**
 * PoC (OTP_SENDER=console, ADR-018): escribe el código en la consola de la API y lo deja en Mailpit
 * (http://localhost:8025) como si fuera un SMS.
 */
@Injectable()
export class ConsoleOtpSender implements OtpSender {
  private readonly logger = new Logger('OTP');
  private readonly mailer;

  constructor(@Inject(ENV) env: Env) {
    this.mailer = nodemailer.createTransport(env.SMTP_URL);
  }

  async send(phone: string, code: string): Promise<void> {
    this.logger.log(`OTP para ${phone}: ${code}`);
    await this.mailer
      .sendMail({
        from: 'ComerceChat <no-reply@comercechat.test>',
        to: `${phone.replace('+', '')}@sms.comercechat.test`,
        subject: `SMS para ${phone}: tu código es ${code}`,
        text: `Tu código de ComerceChat es ${code}. Caduca en 5 minutos. No lo compartas con nadie.`,
      })
      .catch((err: unknown) => this.logger.warn(`Mailpit no disponible: ${String(err)}`));
  }
}
