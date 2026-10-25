// language: TypeScript, file: ActivityFeed.tsx, target: officer-workspace React 19
// "Aktiviti Terkini" list — the officer queue rendered as an audit trail:
// masa · pegawai · tindakan · no. rujukan MARA-2026-XXXX.
//
// Officer identity is NOT part of V1OfficerQueueItem, so the officer cell
// renders an honest "—" rather than a fabricated name. The reference number
// is derived deterministically from application_id (last 8 chars of the
// backend UUID, zero-padded) — a display alias, never invented data.
import type { V1OfficerQueueItem } from '../../services/api';

const ACTION_BY_STATUS: Record<V1OfficerQueueItem['status'], string> = {
  DRAFT: 'Menyimpan draf permohonan',
  SUBMITTED: 'Menghantar permohonan',
  PROCESSING: 'Menjalankan penilaian AI',
  NEEDS_INFO: 'Meminta maklumat tambahan',
  UNDER_REVIEW: 'Menyerahkan untuk perakuan',
  APPROVED: 'Meluluskan permohonan',
  REJECTED: 'Menolak permohonan',
};

/** MARA-2026-XXXX display reference — derived from application_id. */
export function formatMaraReference(applicationId: string): string {
  const digits = applicationId.replace(/\D/g, '').slice(-4).padStart(4, '0');
  const hex = digits.length >= 4 ? digits : applicationId.slice(-4).toUpperCase();
  return `MARA-2026-${(hex || '0000').slice(0, 4)}`;
}

function formatTime(iso: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const dt = new Date(ms);
  const now = Date.now();
  const diffMinutes = Math.max(0, Math.round((now - ms) / 60000));
  if (diffMinutes < 1) return 'baru saja';
  if (diffMinutes < 60) return `${diffMinutes} min lalu`;
  if (diffMinutes < 60 * 24) return `${Math.floor(diffMinutes / 60)} jam lalu`;
  return dt.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short' });
}

interface ActivityFeedProps {
  items: V1OfficerQueueItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-default px-4 py-8 text-center">
        <p className="text-sm font-medium text-text-secondary">Tiada aktiviti terkini</p>
        <p className="mt-1 text-xs text-text-muted">
          Aktiviti akan dipaparkan apabila API barisan pegawai mula mengembalikan data.
        </p>
      </div>
    );
  }

  const latest = items.slice(0, 8);

  return (
    <ol className="activity-feed space-y-0" aria-label="Aktiviti terkini">
      {latest.map((item) => {
        const action = ACTION_BY_STATUS[item.status];
        return (
          <li
            key={item.application_id}
            className="activity-feed__item relative flex items-start gap-3 border-b border-border-subtle py-3 last:border-b-0 last:pb-0"
          >
            <span
              className="activity-feed__dot mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-text-primary">
                {action}
                <span className="font-medium text-text-secondary"> — {item.applicant_name}</span>
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-muted">
                <span>{formatTime(item.updated_at)}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">{formatMaraReference(item.application_id)}</span>
              </p>
            </div>
            {/* Officer is not exposed by /api/v1/officer/applications — honest dash. */}
            <span className="shrink-0 text-xs text-text-muted" title="Pegawai tidak didedahkan oleh API">
              —
            </span>
          </li>
        );
      })}
    </ol>
  );
}
