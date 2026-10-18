import { HttpStatus } from '@nestjs/common';
import { equalShareCents, MAX_SPLIT_PARTS, type SplitRequest } from '@comercechat/shared-types';
import { AppError } from '../common/app-error.js';
import { formatEur } from '../common/money.js';
import type { BillState } from '../tables/table-bill.service.js';

export interface PlannedAllocation {
  kind: 'AMOUNT' | 'ITEM';
  posLineId?: string;
  units?: number;
  amountCents: number;
}

export interface SplitPlan {
  amountCents: number;
  allocations: PlannedAllocation[];
}

/**
 * Calcula cuánto paga este comensal y qué parte de la cuenta reserva (FR-PAY-02). Se ejecuta con el
 * pedido bloqueado, sobre un `state` leído dentro de la misma transacción: si dos comensales piden lo
 * mismo a la vez, el segundo ve la reserva del primero.
 */
export function planSplit(split: SplitRequest, state: BillState): SplitPlan {
  const { availableCents, reservedCents } = state;
  if (availableCents <= 0) {
    throw reservedCents > 0
      ? new AppError(
          'PAYMENT_IN_PROGRESS',
          HttpStatus.CONFLICT,
          'Otro comensal está pagando lo que queda de la cuenta. Espera unos segundos.',
        )
      : new AppError(
          'NOTHING_TO_PAY',
          HttpStatus.CONFLICT,
          'Esta mesa no tiene nada pendiente de pago',
        );
  }

  switch (split.mode) {
    case 'FULL':
      return {
        amountCents: availableCents,
        allocations: [{ kind: 'AMOUNT', amountCents: availableCents }],
      };

    case 'EQUAL': {
      const { parts, shares } = split;
      if (
        !Number.isInteger(parts) ||
        parts < 2 ||
        parts > MAX_SPLIT_PARTS ||
        !Number.isInteger(shares) ||
        shares < 1 ||
        shares >= parts
      ) {
        throw new AppError(
          'SPLIT_INVALID',
          HttpStatus.UNPROCESSABLE_ENTITY,
          `Divide entre 2 y ${MAX_SPLIT_PARTS} partes`,
        );
      }
      // La última parte se ajusta a lo que queda (redondeo hacia arriba en las demás).
      const amountCents = Math.min(
        availableCents,
        equalShareCents(state.posBill.totalCents, parts, shares),
      );
      return { amountCents, allocations: [{ kind: 'AMOUNT', amountCents }] };
    }

    case 'AMOUNT': {
      const amountCents = split.amountCents;
      if (!Number.isInteger(amountCents) || amountCents < 1) {
        throw new AppError('SPLIT_INVALID', HttpStatus.UNPROCESSABLE_ENTITY, 'Importe no válido');
      }
      if (amountCents > availableCents) {
        throw new AppError(
          'SPLIT_AMOUNT_TOO_HIGH',
          HttpStatus.CONFLICT,
          `Solo quedan ${formatEur(availableCents)} por pagar`,
        );
      }
      return { amountCents, allocations: [{ kind: 'AMOUNT', amountCents }] };
    }

    case 'ITEMS': {
      if (!Array.isArray(split.items) || split.items.length === 0) {
        throw new AppError(
          'SPLIT_INVALID',
          HttpStatus.UNPROCESSABLE_ENTITY,
          'Elige al menos un plato',
        );
      }
      const allocations: PlannedAllocation[] = [];
      const seen = new Set<string>();
      for (const { lineId, units } of split.items) {
        const line = state.posBill.lines.find((l) => l.externalLineId === lineId);
        if (!line || seen.has(lineId) || !Number.isInteger(units) || units < 1) {
          throw new AppError(
            'SPLIT_INVALID',
            HttpStatus.UNPROCESSABLE_ENTITY,
            'Selección de platos no válida',
          );
        }
        seen.add(lineId);
        const usage = state.lineUsage.get(lineId);
        const free = line.qty - (usage?.paidUnits ?? 0) - (usage?.reservedUnits ?? 0);
        if (units > free) {
          throw new AppError(
            'ITEMS_UNAVAILABLE',
            HttpStatus.CONFLICT,
            free > 0
              ? `De «${line.name}» solo quedan ${free} sin pagar`
              : `«${line.name}» ya está pagado o lo está pagando otro comensal`,
          );
        }
        allocations.push({
          kind: 'ITEM',
          posLineId: lineId,
          units,
          amountCents: units * line.unitPriceCents,
        });
      }
      const amountCents = allocations.reduce((s, a) => s + a.amountCents, 0);
      if (amountCents > availableCents) {
        throw new AppError(
          'SPLIT_AMOUNT_TOO_HIGH',
          HttpStatus.CONFLICT,
          `Tus platos suman ${formatEur(amountCents)} pero solo quedan ${formatEur(availableCents)} por pagar`,
        );
      }
      return { amountCents, allocations };
    }

    default:
      throw new AppError(
        'SPLIT_INVALID',
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Modo de reparto no válido',
      );
  }
}
