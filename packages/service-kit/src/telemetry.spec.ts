import { describe, expect, it } from 'vitest';
import { redactAttributes, redactQuery } from './telemetry.js';

describe('redacción de trazas', () => {
  it('quita la query de URLs y rutas', () => {
    expect(redactQuery('/v1/payments/abc?t=secreto')).toBe('/v1/payments/abc?[redactado]');
    expect(redactQuery('http://localhost:4000/v1/qr/X1')).toBe('http://localhost:4000/v1/qr/X1');
  });

  it('redacta los atributos con URL y deja el resto', () => {
    const attrs: Record<string, unknown> = {
      'url.full': 'http://localhost:4000/v1/payments/abc?t=tok',
      'url.query': 't=tok',
      'http.target': '/v1/payments/abc?t=tok',
      'http.response.status_code': 200,
      'db.statement': 'select 1',
    };
    redactAttributes(attrs);
    expect(JSON.stringify(attrs)).not.toContain('tok');
    expect(attrs).toMatchObject({
      'url.full': 'http://localhost:4000/v1/payments/abc?[redactado]',
      'url.query': '[redactado]',
      'http.response.status_code': 200,
      'db.statement': 'select 1',
    });
  });
});
