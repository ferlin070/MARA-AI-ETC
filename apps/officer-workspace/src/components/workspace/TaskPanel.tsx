import { useState } from 'react';
import { Chip, Scrollable, Typography } from '@openhands/ui';
import { useAssessments } from '../../context/AssessmentContext';
import { WORKSPACE } from '../../constants';
import type { StageLogEntry } from '../../services/api';
import type { LiveAssessment } from '../../types/workspace';

const STAGE_STATUS_CONFIG: Record<
  string,
  { label: string; color: 'green' | 'primaryDark' | 'gray'; dot: string }
> = {
  completed: { label: 'Done', color: 'green', dot: 'bg-emerald-500' },
  in_progress: { label: 'Running', color: 'primaryDark', dot: 'bg-cyan-500 animate-pulse' },
  pending: { label: 'Pending', color: 'gray', dot: 'bg-slate-300 dark:bg-slate-600' },
};

const STAGE_STATUS_DEFAULT = { label: 'Pending', color: 'gray' as const, dot: 'bg-slate-300 dark:bg-slate-600' };

const ASSESSMENT_STATUS_CONFIG: Record<
  LiveAssessment['status'],
  { label: string; className: string }
> = {
  pending_approval: {
    label: 'Awaiting gate',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/80 dark:text-amber-300',
  },
  completed: {
    label: 'Completed',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/80 dark:text-emerald-300',
  },
};

function stageLabel(stage: string | undefined | null): string {
  if (!stage) return 'Stage';
  return stage
    .replace(/^extract_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function StageRow({ entry }: { entry: StageLogEntry }) {
  const config = STAGE_STATUS_CONFIG[entry.status] ?? STAGE_STATUS_DEFAULT;

  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <div className="flex shrink-0 flex-col items-center pt-1.5">
        <span className={`h-2 w-2 rounded-full ${config.dot}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Typography.Text fontSize="s" fontWeight={600} className="text-slate-800 dark:text-slate-200">
            {stageLabel(entry.stage)}
          </Typography.Text>
          <Chip color={config.color} variant="pill">
            {config.label}
          </Chip>
        </div>
        {entry.agent && (
          <Typography.Text fontSize="xxs" className="text-slate-400 dark:text-slate-500">
            {entry.agent}
          </Typography.Text>
        )}
        {entry.completed_at && (
          <Typography.Text fontSize="xxs" className="text-slate-400 dark:text-slate-500">
            {new Date(entry.completed_at).toLocaleTimeString()}
          </Typography.Text>
        )}
      </div>
    </div>
  );
}

function AssessmentListItem({
  assessment,
  isActive,
  onSelect,
}: {
  assessment: LiveAssessment;
  isActive: boolean;
  onSelect: () => void;
}) {
  const statusConfig = ASSESSMENT_STATUS_CONFIG[assessment.status];
  const activeStages = assessment.stage_log.filter((s) => s.status === 'in_progress').length;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isActive}
      className={`w-full cursor-pointer border-l-2 px-4 py-2.5 text-left transition-colors ${
        isActive
          ? 'border-indigo-600 bg-indigo-50/60 dark:border-indigo-500 dark:bg-indigo-950/30'
          : 'border-transparent hover:bg-slate-50 dark:hover:bg-[#18191C]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <Typography.Text
          fontSize="s"
          fontWeight={isActive ? 600 : 500}
          className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-200"
        >
          {assessment.title}
        </Typography.Text>
        {activeStages > 0 && (
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-cyan-500" />
        )}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${statusConfig.className}`}
        >
          {statusConfig.label}
        </span>
        <Typography.Text fontSize="xxs" className="font-mono text-slate-400 dark:text-slate-500">
          {assessment.thread_id.slice(0, 12)}…
        </Typography.Text>
      </div>
    </button>
  );
}

function TaskPanelBody() {
  const { assessments } = useAssessments();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // Selected case falls back to the most recent assessment when nothing is
  // explicitly picked or the picked one was removed.
  const selected =
    assessments.find((a) => a.thread_id === selectedThreadId) ?? assessments[0] ?? null;

  const stages = selected?.stage_log ?? [];
  const stageCount = stages.length;
  const activeCount = stages.filter((s) => s.status === 'in_progress').length;
  const awaitingGate = selected?.pending_gate ?? null;

  const summaryChips = selected ? (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {activeCount > 0 && (
        <Chip color="aqua" variant="pill" className="border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-800/60 dark:bg-cyan-950/80 text-xs font-semibold dark:text-cyan-300">
          {activeCount} {WORKSPACE.CHIP_ACTIVE_LABEL}
        </Chip>
      )}
      {awaitingGate && (
        <Chip color="primaryDark" variant="pill" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/80 text-xs font-semibold dark:text-amber-300">
          Awaiting {awaitingGate.replace(/_/g, ' ')}
        </Chip>
      )}
    </div>
  ) : null;

  const listSection =
    assessments.length === 0 ? (
      <div className="flex items-center justify-center px-4 py-12 text-center">
        <Typography.Text fontSize="s" className="text-slate-400 dark:text-slate-500">
          Start an assessment from the chat below to see agent progress here.
        </Typography.Text>
      </div>
    ) : (
      <Scrollable className="flex-1">
        {/* Assessment selector — every case is listed and clickable */}
        <div className="divide-y divide-slate-100 border-b border-slate-100 dark:divide-[#222328] dark:border-[#222328]">
          {assessments.map((a) => (
            <AssessmentListItem
              key={a.thread_id}
              assessment={a}
              isActive={a.thread_id === selected?.thread_id}
              onSelect={() => setSelectedThreadId(a.thread_id)}
            />
          ))}
        </div>

        {/* Stage log of the selected case */}
        {stageCount > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-[#222328]">
            {stages.map((entry, i) => (
              <StageRow key={`${entry.stage}-${i}`} entry={entry} />
            ))}
          </div>
        )}
        {stageCount === 0 && (
          <div className="px-4 py-8 text-center">
            <Typography.Text fontSize="xxs" className="text-slate-400 dark:text-slate-500">
              No stages recorded for this case yet.
            </Typography.Text>
          </div>
        )}
      </Scrollable>
    );

  return (
    <>
      {/* Panel header — shared by the desktop aside and the mobile drawer */}
      <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3.5 dark:border-[#222328] dark:bg-[#18191C]/50">
        <div className="flex items-center justify-between">
          <Typography.H5 className="font-bold text-slate-900 dark:text-white">
            {WORKSPACE.TASK_HEADING}
          </Typography.H5>
          {assessments.length > 0 && (
            <span className="rounded-full bg-slate-200/60 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-[#222328] dark:text-slate-300">
              {assessments.length}
            </span>
          )}
        </div>
        {summaryChips}
      </div>
      {listSection}
    </>
  );
}

/**
 * Responsive wrapper. On >=md the panel renders as a fixed sidebar column
 * (WorkspacePage lays it out inline). On <md it collapses behind a floating
 * toggle button and opens as a slide-over drawer with a backdrop.
 */
export function TaskPanel() {
  const { assessments } = useAssessments();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeCount = assessments.reduce(
    (n, a) => n + a.stage_log.filter((s) => s.status === 'in_progress').length,
    0,
  );

  return (
    <>
      {/* Desktop sidebar panel */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white md:flex dark:border-[#222328] dark:bg-[#131417]">
        <TaskPanelBody />
      </aside>

      {/* Mobile floating toggle */}
      {assessments.length > 0 && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open task panel"
          title="Open task panel"
          className="fixed bottom-5 left-5 z-40 flex h-11 items-center gap-2 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-500 md:hidden"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span>{WORKSPACE.TASK_HEADING}</span>
          {activeCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-cyan-500 px-1 text-xs font-bold">
              {activeCount}
            </span>
          )}
        </button>
      )}

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs dark:bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl dark:border-[#222328] dark:bg-[#131417]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 pr-2 dark:border-[#222328] dark:bg-[#18191C]/50">
              <span className="flex-1">
                <Typography.H5 className="px-4 py-3.5 font-bold text-slate-900 dark:text-white">
                  {WORKSPACE.TASK_HEADING}
                </Typography.H5>
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close task panel"
                title="Close task panel"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#222328]"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <TaskPanelBody />
          </aside>
        </div>
      )}
    </>
  );
}
