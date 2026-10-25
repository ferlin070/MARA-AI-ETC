// language: TypeScript, file: KpiCard.tsx, target: officer-workspace React 19
// Adminator-style KPI card: soft-bg 32px icon (SVG stroke 1.9), radial
// glow ::before at 8% currentColor, hover lift -2px + shadow-lg,
// rise-in 600ms cubic-bezier(.2,.7,.2,1) staggered 60ms per nth-child.
// Styling lives in src/styles/dashboard.css; this component owns markup.
import type { ReactNode } from 'react';
import { cn } from '../ui/Card';

type KpiVariant = 'primary' | 'success' | 'danger' | 'purple';

interface KpiCardProps {
  /** Slot for a 32px icon: <svg stroke-width 1.9 …>. Inherits currentColor. */
  icon: ReactNode;
  /** Eyebrow-style label above the value. */
  label: string;
  /** Main figure. Render "—" or a banner state when data is unavailable. */
  value: ReactNode;
  /** Optional sub-line under the value (delta, window, etc.). */
  sub?: ReactNode;
  variant?: KpiVariant;
  /** Index within the KPI grid, drives the 60ms rise-in stagger. */
  index?: number;
  /** True when the figure is not yet derivable — renders honest empty state. */
  unavailable?: boolean;
  className?: string;
}

export function KpiCard({
  icon,
  label,
  value,
  sub,
  variant = 'primary',
  index = 0,
  unavailable = false,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn('kpi-card', `kpi-card--${variant}`, className)}
      style={index ? { animationDelay: `${index * 60}ms` } : undefined}
      role="group"
      aria-label={label}
    >
      <div className="kpi-card__icon" aria-hidden="true">
        {icon}
      </div>
      <div className="kpi-card__body">
        <p className="kpi-card__label">{label}</p>
        <p className="kpi-card__value">
          {unavailable ? <span className="kpi-card__empty">—</span> : value}
        </p>
        {sub && <p className="kpi-card__sub">{sub}</p>}
        {unavailable && (
          <p className="kpi-card__empty-note">Belum tersedia</p>
        )}
      </div>
    </div>
  );
}
