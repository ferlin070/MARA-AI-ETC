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

export function TaskPanel() {
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

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-[#222328] dark:bg-[#131417]">
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
        {selected && (
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
        )}
      </div>

      {assessments.length === 0 ? (
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
      )}
    </aside>
  );
}
