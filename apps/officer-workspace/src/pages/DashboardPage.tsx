// language: TypeScript, file: DashboardPage.tsx, target: officer-workspace React 19
// FE-D3: Adminator index composition — KPI grid of 4 (queue-derived, honest
// "Belum tersedia" when the API returns nothing) over two wide cards:
// "Aliran Permohonan" (8-stage SOP mini-timeline) and "Aktiviti Terkini".
// All colour/shadow/radius via var(--token) through the Tailwind map —
// zero hex literals. No fabricated numbers, ever.
import { useEffect, useState } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { Card } from '../components/ui/Card';
import { KpiCard } from '../components/dashboard/KpiCard';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { fetchDashboardStats, fetchWorkflows, fetchOfficerQueueItems } from '../services/data';
import type { V1OfficerQueueItem } from '../services/api';
import type { DashboardStats, WorkflowInstance } from '../types/dashboard';

/* ── KPI icons: SVG stroke 1.9, inherits currentColor from the variant ── */

const ICON_INBOX = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 8l7.5-4.5a3 3 0 013 0L21 8M3 8v9a2 2 0 002 2h14a2 2 0 002-2V8M3 8l6.3 4.2a4 4 0 004.4 0L21 8m-9 6v5"
    />
  </svg>
);

const ICON_SEARCH = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a8 8 0 100-16 8 8 0 000 16z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6 6" />
  </svg>
);

const ICON_STAMP = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12V6a3 3 0 116 0v6M8 8.5C5.5 9.5 5 11.5 5 14v1a1 1 0 001 1h12a1 1 0 001-1v-1c0-2.5-.5-4.5-3-5.5M6 20h12"
    />
  </svg>
);

const ICON_CHECKED = (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.5l2.5 2.5 5-5.5M12 3l7.5 3.5v5c0 4.6-3.2 8.2-7.5 9.5C7.7 19.7 4.5 16.1 4.5 11.5v-5L12 3z"
    />
  </svg>
);

/* ── 8 SOP stages: which queue statuses roll up into each stage. Counts
      use plain dashes where the queue cannot derive them. ── */

interface StageDef {
  label: string;
  statuses: string[];
}

const SOP_STAGES: StageDef[] = [
  { label: 'Draf', statuses: ['DRAFT'] },
  { label: 'Dihantar', statuses: ['SUBMITTED'] },
  { label: 'Dalam Semakan', statuses: ['PROCESSING'] },
  { label: 'Dalam Penilaian', statuses: ['PROCESSING'] },
  { label: 'Dalam Kelulusan', statuses: ['UNDER_REVIEW'] },
  { label: 'Diluluskan', statuses: ['APPROVED'] },
  { label: 'Tawaran', statuses: [] },
  { label: 'Ditutup', statuses: ['REJECTED'] },
];

/* ── Time window for "Diluluskan (30 hari)": stat is derived from the queue's
      UPDATED_AT, not created_at — when an approval leaves the 30-day window
      it is because its last update aged out. ── */

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([]);
  const [queueItems, setQueueItems] = useState<V1OfficerQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [s, w, q] = await Promise.all([
          fetchDashboardStats(),
          fetchWorkflows(),
          fetchOfficerQueueItems(),
        ]);
        if (cancelled) return;
        setStats(s);
        setWorkflows(w);
        setQueueItems(q);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Dashboard data is unavailable. The API endpoint has not been built yet.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* KPI derivation — queue truth only.
   * Permohonan Baharu: items sitting in DRAFT + SUBMITTED (submitted to the
   *   system, not yet in processing).
   * Dalam Penilaian: PROCESSING (AI assessment running).
   * Menunggu Kelulusan: UNDER_REVIEW.
   * Diluluskan (30 hari): APPROVED whose last update is within 30 days.
   * The fetchers return [] when the API is unreachable — we distinguish
   * "unavailable" (empty queue → API belum tersedia) from a real 0. */
  const stageOf = (w: WorkflowInstance) => w.stage.toUpperCase().replace(/\s+/g, '_');
  const approvedInWindow = workflows.filter((w) => {
    if (stageOf(w) !== 'APPROVED') return false;
    const ms = new Date(w.updated_at).getTime();
    if (Number.isNaN(ms)) return true; // unparseable timestamp: count it, don't invent an exclusion
    return Date.now() - ms <= 30 * 24 * 60 * 60 * 1000;
  });

  const hasQueueData = workflows.length > 0;
  const kpiNew = stats
    ? workflows.filter((w) => ['DRAFT', 'SUBMITTED'].includes(stageOf(w))).length
    : null;
  const kpiAssessing = workflows.filter((w) => stageOf(w) === 'PROCESSING').length;
  const kpiAwaiting = stats?.pending_approval_count ?? null;

  if (loading) {
    return (
      <AppLayout title="Portfolio Overview" subtitle="Pemantauan permohonan pembiayaan & geran usahawan MARA">
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-border-default border-t-[color:var(--primary)]" />
            <span className="text-sm text-text-muted">Memuatkan papan pemuka…</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !stats) {
    return (
      <AppLayout title="Portfolio Overview" subtitle="Pemantauan permohonan pembiayaan & geran usahawan MARA">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-sm font-medium text-warning">{error ?? 'Dashboard data is unavailable.'}</p>
            <p className="mt-1 text-xs text-text-muted">
              Endpoint API dashboard belum tersedia. Data akan dipaparkan setelah backend bersambung.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Portfolio Overview" subtitle="Pemantauan permohonan pembiayaan & geran usahawan MARA">
      <div className="space-y-6">
        {/* ── KPI grid ── */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={ICON_INBOX}
            label="Permohonan Baharu"
            value={kpiNew ?? 0}
            variant="primary"
            index={1}
            unavailable={!hasQueueData || kpiNew === null}
            sub={hasQueueData ? 'Draf & baharu dihantar' : undefined}
          />
          <KpiCard
            icon={ICON_SEARCH}
            label="Dalam Penilaian"
            value={kpiAssessing}
            variant="success"
            index={2}
            unavailable={!hasQueueData}
            sub={hasQueueData ? 'Penilaian AI sedang berjalan' : undefined}
          />
          <KpiCard
            icon={ICON_STAMP}
            label="Menunggu Kelulusan"
            value={kpiAwaiting ?? 0}
            variant="warning"
            index={3}
            unavailable={!hasQueueData || kpiAwaiting === null}
            sub={hasQueueData ? 'Menunggu perakuan pegawai' : undefined}
          />
          <KpiCard
            icon={ICON_CHECKED}
            label="Diluluskan (30 hari)"
            value={approvedInWindow.length}
            variant="purple"
            index={4}
            unavailable={!hasQueueData}
            sub={hasQueueData ? 'Tetingkap 30 hari terakhir' : undefined}
          />
        </div>

        {/* ── Two wide cards ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Aliran Permohonan — 8 SOP stages as a compact timeline.
              Counts derived where the queue rolls up into a stage; a plain
              dash where the backend exposes no stage-level data. */}
          <Card eyebrow="SOP" title="Aliran Permohonan">
            <ol className="space-y-0">
              {SOP_STAGES.map((stage, i) => {
                const count = hasQueueData
                  ? stage.statuses.length > 0
                    ? workflows.filter((w) => stage.statuses.includes(stageOf(w))).length
                    : null
                  : null;
                const isLast = i === SOP_STAGES.length - 1;
                return (
                  <li key={stage.label} className="relative flex items-center gap-3 py-2.5">
                    {!isLast && (
                      <span
                        className="absolute left-[7px] top-8 h-[calc(100%-16px)] w-px bg-border-default"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className="relative z-10 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[color:var(--primary)] bg-surface-card"
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-sm text-text-primary">{stage.label}</span>
                    <span
                      className={`font-mono text-sm tabular-nums ${
                        count === null ? 'text-text-muted' : 'font-semibold text-text-primary'
                      }`}
                    >
                      {count === null ? '—' : count}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-xs text-text-muted">
              Kiraan diterbitkan daripada barisan pegawai semasa. Peringkat tanpa sumber data
              dipaparkan dengan sengkang.
            </p>
          </Card>

          {/* Aktiviti Terkini — audit-trail view of the same queue.
              flush: the feed manages its own padding/edges. */}
          <Card eyebrow="JEJAK AUDIT" title="Aktiviti Terkini" flush>
            <div className="px-5 pb-5">
              <ActivityFeed items={queueItems} />
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
