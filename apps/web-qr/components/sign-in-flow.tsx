'use client';

import type { CouponView } from '@comercechat/shared-types';
import Link from 'next/link';
import { useActionState } from 'react';
import { formatCents } from '@/lib/money';
import { requestCode, type SignInState, verifyCode } from '@/lib/user-actions';

interface Props {
  /** Si viene del justificante: pago cuyos puntos se guardan al terminar. */
  claim?: {
    paymentId: string;
    statusToken: string;
    merchantId: string;
    merchantName: string;
    points: number;
  };
}

function NewCoupons({ coupons }: { coupons: CouponView[] }) {
  if (coupons.length === 0) return null;
  return (
    <div className="coupon-list">
      {coupons.map((c) => (
        <div key={c.id} className="coupon">
          <strong>🎁 {c.title}</strong>
          <span className="muted small">
            {formatCents(c.discountCents)} de descuento
            {c.minSpendCents > 0 && ` · a partir de ${formatCents(c.minSpendCents)}`}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Alta o inicio de sesión con el teléfono y un código de un solo uso (FR-USR-02). Funciona sin
 * JavaScript: cada paso es un formulario con su server action.
 */
export function SignInFlow({ claim }: Props) {
  const [phoneState, sendCode, sending] = useActionState<SignInState, FormData>(requestCode, {
    step: 'phone',
  });
  const [codeState, checkCode, checking] = useActionState<SignInState, FormData>(verifyCode, {
    step: 'code',
  });

  if (codeState.step === 'done') {
    return (
      <div className="signin done" aria-live="polite">
        {codeState.claim ? (
          <>
            <p className="big">+{codeState.claim.pointsEarned} puntos guardados</p>
            <p>
              Tienes <strong>{codeState.claim.balance} puntos</strong> en{' '}
              {codeState.claim.merchant.brandName}.
            </p>
            <NewCoupons coupons={codeState.claim.newCoupons} />
          </>
        ) : (
          <p className="big">{codeState.isNew ? '¡Cuenta creada!' : '¡Hola de nuevo!'}</p>
        )}
        {codeState.error && <p className="error">{codeState.error}</p>}
        <Link className="pay-button as-link" href="/cuenta">
          Ver mis puntos y cupones
        </Link>
      </div>
    );
  }

  if (phoneState.step === 'code') {
    return (
      <form action={checkCode} className="signin">
        <input type="hidden" name="phone" value={phoneState.phone} />
        {claim && (
          <>
            <input type="hidden" name="paymentId" value={claim.paymentId} />
            <input type="hidden" name="statusToken" value={claim.statusToken} />
            <input type="hidden" name="merchantId" value={claim.merchantId} />
          </>
        )}
        <p className="muted small">Te hemos enviado un código a {phoneState.phone}.</p>
        <label>
          Código
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
          />
        </label>
        <label>
          Tu nombre (opcional)
          <input name="name" autoComplete="given-name" maxLength={60} />
        </label>
        <fieldset className="consents">
          <legend className="sr-only">Consentimientos</legend>
          <label className="check">
            <input type="checkbox" name="terms" /> Acepto las condiciones de uso y la política de
            privacidad (obligatorio para crear la cuenta)
          </label>
          <label className="check">
            <input type="checkbox" name="marketing" /> Quiero recibir ofertas de ComerceChat
          </label>
          {claim && (
            <label className="check">
              <input type="checkbox" name="share" /> Compartir mis datos con {claim.merchantName}{' '}
              para que me envíe ofertas
            </label>
          )}
        </fieldset>
        {codeState.error && (
          <p className="error" role="alert">
            {codeState.error}
          </p>
        )}
        <button className="pay-button" type="submit" disabled={checking}>
          {checking ? 'Comprobando…' : claim ? `Guardar mis ${claim.points} puntos` : 'Entrar'}
        </button>
      </form>
    );
  }

  return (
    <form action={sendCode} className="signin">
      <label>
        Tu móvil
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="600 000 000"
          defaultValue={phoneState.phone}
          required
        />
      </label>
      {phoneState.error && (
        <p className="error" role="alert">
          {phoneState.error}
        </p>
      )}
      <button className="pay-button" type="submit" disabled={sending}>
        {sending ? 'Enviando…' : 'Recibir código'}
      </button>
      <p className="muted small">
        Sin contraseñas: te enviaremos un código por SMS (en esta demo, a la consola y a Mailpit).
      </p>
    </form>
  );
}
