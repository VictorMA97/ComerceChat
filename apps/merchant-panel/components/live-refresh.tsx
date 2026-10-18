'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Si el evento `ready` no llega en este tiempo, hay un proxy reteniendo el flujo SSE. */
const READY_TIMEOUT_MS = 4_000;

/**
 * Tiempo real (ARCHITECTURE §12): escucha los avisos SSE y vuelve a pedir la página al servidor.
 * Si el SSE no funciona (p. ej. tras el túnel rápido de Cloudflare, que no lo admite), refresca cada
 * `pollMs` en su lugar.
 */
export function LiveRefresh({ src, pollMs = 3_000 }: { src: string; pollMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    const refresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 150);
    };
    const startPolling = () => {
      if (poll) return;
      poll = setInterval(() => {
        if (document.visibilityState === 'visible') router.refresh();
      }, pollMs);
    };
    const stopPolling = () => {
      clearInterval(poll);
      poll = undefined;
    };

    const es = new EventSource(src);
    const readyTimer = setTimeout(startPolling, READY_TIMEOUT_MS);
    es.addEventListener('ready', () => {
      clearTimeout(readyTimer);
      stopPolling();
    });
    es.addEventListener('table.updated', refresh);
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) startPolling();
    };
    return () => {
      es.close();
      clearTimeout(readyTimer);
      clearTimeout(debounce);
      stopPolling();
    };
  }, [src, pollMs, router]);
  return null;
}
