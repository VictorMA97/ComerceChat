'use client';

import { useState } from 'react';

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const dayLabel = new Intl.DateTimeFormat('es-ES', {
  weekday: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * Ventas por día (una sola serie de magnitud): barras de un tono, extremo redondeado anclado a la
 * base, eje discreto y tooltip al pasar por cada barra. La tabla de abajo da los mismos datos.
 */
export function DailyChart({
  days,
}: {
  days: { date: string; volumeCents: number; payments: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640;
  const H = 180;
  const pad = { top: 16, bottom: 28, left: 8, right: 8 };
  const max = Math.max(1, ...days.map((d) => d.volumeCents));
  const slot = (W - pad.left - pad.right) / Math.max(1, days.length);
  const barW = Math.min(36, slot - 2);
  const y = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / max);
  const base = H - pad.bottom;

  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ventas por QR de cada día del periodo">
        <line x1={pad.left} x2={W - pad.right} y1={base} y2={base} className="chart-axis" />
        {days.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const top = y(d.volumeCents);
          const h = Math.max(0, base - top);
          const r = Math.min(4, h);
          // Extremo superior redondeado (4px) y base recta, anclada al eje.
          const path = `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${base} Z`;
          const label = dayLabel.format(new Date(`${d.date}T00:00:00Z`));
          return (
            <g
              key={d.date}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
            >
              {/* Zona de interacción más grande que la barra. */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={base - pad.top}
                fill="transparent"
              />
              {h > 0 && (
                <path d={path} className={hover === i ? 'chart-bar active' : 'chart-bar'} />
              )}
              {days.length <= 10 && (
                <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="chart-tick">
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && days[hover] && (
        <div
          className="chart-tooltip"
          style={{ left: `${((hover + 0.5) / days.length) * 100}%` }}
          role="status"
        >
          <strong>{dayLabel.format(new Date(`${days[hover].date}T00:00:00Z`))}</strong>
          <span>{eur.format(days[hover].volumeCents / 100)}</span>
          <span className="muted">{days[hover].payments} pagos</span>
        </div>
      )}
    </div>
  );
}
