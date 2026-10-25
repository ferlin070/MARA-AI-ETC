// language: TypeScript, file: Card.tsx, target: officer-workspace React 19
// Adminator-style card kit. Colour/shadow/radius come from the token
// system (var(--*) via the Tailwind map); spacing/layout stays Tailwind.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { HTMLAttributes, ReactNode } from 'react';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Small uppercase label rendered above the head title. */
  eyebrow?: ReactNode;
  /** Action slot pinned to the head's right edge (buttons, links). */
  action?: ReactNode;
  /** Renders a dashed "not available" body instead of children. */
  unavailable?: boolean;
  /** Message shown under the unavailable banner. */
  unavailableMessage?: ReactNode;
  /** Removes default padding — for cards managing their own interior. */
  flush?: boolean;
}

/**
 * Card — the one container every panel is built from.
 *
 * <Card eyebrow="RINGKASAN" title="Aktiviti Terkini" action={<a/>}>
 *   …body…
 * </Card>
 *
 * title/eyebrow/action can also be used via the CardHead/CardTitle/
 * CardEyebrow/CardAction subcomponents for non-standard head layouts.
 */
export function Card({
  eyebrow,
  title,
  action,
  unavailable = false,
  unavailableMessage,
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border-default bg-surface-card shadow-card',
        !flush && 'p-5',
        className,
      )}
      {...rest}
    >
      {(eyebrow || title || action) && (
        <CardHead>
          <div className="min-w-0">
            {eyebrow && <CardEyebrow>{eyebrow}</CardEyebrow>}
            {title && <CardTitle>{title}</CardTitle>}
          </div>
          {action && <CardAction>{action}</CardAction>}
        </CardHead>
      )}
      {unavailable ? (
        <CardUnavailable message={unavailableMessage} />
      ) : (
        children
      )}
    </div>
  );
}

export function CardHead({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'mb-4 flex items-center justify-between gap-3',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'truncate text-base font-semibold text-text-primary',
        className,
      )}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardEyebrow({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn(
        'font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-text-muted',
        className,
      )}
      {...rest}
    >
      {children}
    </p>
  );
}

export function CardAction({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('shrink-0', className)} {...rest}>
      {children}
    </div>
  );
}

function CardUnavailable({ message }: { message?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-warning bg-warning-soft/60 px-4 py-6 text-center">
      <p className="text-sm font-medium text-warning">Belum tersedia</p>
      {message && (
        <p className="mt-1 text-xs text-text-muted">{message}</p>
      )}
    </div>
  );
}
