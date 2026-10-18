'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Vuelve a pedir la página al servidor mientras el pago espera la confirmación del PSP. */
export function AutoRefresh({ everyMs = 1_500 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
