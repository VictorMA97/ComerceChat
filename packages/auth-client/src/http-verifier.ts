import type { InternalHttpClient } from '@comercechat/service-kit';
import type { MerchantPrincipal, MerchantSessionVerifier } from './merchant.js';

/**
 * `MerchantSessionVerifier` por HTTP: pregunta a identity (`POST /v1/internal/sessions/merchant`).
 * Lo usan los servicios separados de la API; si identity no responde, la petición falla con 503
 * (nunca se da por buena una sesión sin comprobarla).
 */
export class HttpMerchantSessionVerifier implements MerchantSessionVerifier {
  constructor(private readonly identity: InternalHttpClient) {}

  async verifyMerchantToken(token: string): Promise<MerchantPrincipal | null> {
    const { principal } = await this.identity.post<{ principal: MerchantPrincipal | null }>(
      '/v1/internal/sessions/merchant',
      { token },
    );
    return principal;
  }
}
