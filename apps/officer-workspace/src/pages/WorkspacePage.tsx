import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { AppLayout } from '../components/layout/AppLayout';
import { ChatPanel } from '../components/workspace/ChatPanel';
import { TaskPanel } from '../components/workspace/TaskPanel';
import { startAssessmentFull } from '../services/data';
import { sendChatMessage } from '../services/api';
import { useAssessments } from '../context/AssessmentContext';
import { REGIONS, SECTORS, UI, WORKSPACE } from '../constants';

// ─── Local intent fallback ──────────────────────────────────────────────────
// Used when the backend /api/chat is unreachable (local dev without the full
// stack). Keyword-based: deliberately simple so the backend LLM is the real
// judge in production.

const ASSESSMENT_KEYWORDS = [
  'assess', 'assessment', 'loan', 'document', 'review', 'evaluate', 'check',
  'analyse', 'analyze', 'application', 'grant', 'compliance', 'risk', 'finance',
  'market', 'report', 'submit', 'upload', 'pdf', 'semak', 'nilai', 'pinjaman',
];

// Only pure social openers — NOT question words like "how" or "apa" which can
// start legitimate questions ("how many agents do we have?").
const GREETING_KEYWORDS = [
  'hi', 'hello', 'hai', 'hey',
  'salam', 'selamat', 'assalamualaikum', 'waalaikumsalam',
];

// Questions about what the system can do / what agents exist.
const CAPABILITY_KEYWORDS = [
  'how many', 'how much', 'what agent', 'which agent', 'list agent',
  'what can you', 'what do you', 'tell me about', 'berapa agent',
  'agent ada', 'ada berapa', 'agent kita', 'agent we', 'agents we',
  'capabilities', 'features', 'fungsi', 'kemampuan',
];

function detectIntentLocally(
  text: string,
): 'greeting' | 'capability' | 'assessment' | 'unknown' {
  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // Pure greeting — short message whose first word is a social opener.
  if (text.length < 40 && GREETING_KEYWORDS.some((kw) => words[0]?.startsWith(kw))) {
    return 'greeting';
  }
  // Capability / "what can you do" questions.
  if (CAPABILITY_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'capability';
  }
  // Workflow trigger.
  if (ASSESSMENT_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'assessment';
  }
  return 'unknown';
}

const GREETING_REPLY =
  'Selamat datang, Pegawai! I\'m MARA AI — your intelligent assistant for processing ' +
  'loan and grant applications.\n\n' +
  'Ask me anything or type what you need. For example:\n' +
  '"Assess the loan application from Ahmad bin Abdullah"\n' +
  '"Review this document" (then attach a PDF)\n' +
  '"Research the F&B sector in Selangor"';

const CAPABILITY_REPLY =
  'MARA AI-ETC runs **7 specialised AI agents**, each owning a distinct stage:\n\n' +
  '1. 🗂 **Document Agent** — OCR, extraction & classification of uploaded files\n' +
  '2. ✅ **Compliance Agent** — checks MARA policy, bumiputera status & eligibility rules\n' +
  '3. 💰 **Finance Agent** — analyses cash flow, financial ratios & repayment capacity\n' +
  '4. ⚠️ **Risk Agent** — scores credit & business risk, flags severity (low → critical)\n' +
  '5. 📈 **Market Agent** — researches sector/region context for the application\n' +
  '6. 📋 **Recommendation Agent** — synthesises all agents into a final approve/reject recommendation\n' +
  '7. 🧭 **Planner** (that\'s me) — understands your intent and routes to the right workflow\n\n' +
  'All 7 run automatically when you start a **Loan Assessment**. You stay in control at every human approval gate.';

export function WorkspacePage() {
  const [uploading, setUploading] = useState(false);
  /**
   * A file the officer attached but has not scoped yet. Nothing is sent to the
   * backend while this is set — the assessment needs a real sector and region
   * (the Market agent researches against them and Finance prices against the
   * regional base). Sending the placeholder defaults would produce an
   * assessment that looks complete but is scoped to nothing.
   */
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sector, setSector] = useState<string>('');
  const [region, setRegion] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addAssessment } = useAssessments();

  function handleFileAttach() {
    fileInputRef.current?.click();
  }

  async function runAssessment(input: { file: File; sector: string; region: string }) {
    // Defence in depth: never let a placeholder scope through, even if a caller
    // slips past the prompt.
    if (
      !input.sector ||
      !input.region ||
      input.sector === UI.DEFAULT_SECTOR ||
      input.region === UI.DEFAULT_REGION
    ) {
      toast.error(WORKSPACE.TOAST_CONTEXT_REQUIRED);
      return;
    }

    setUploading(true);
    try {
      const res = await startAssessmentFull(input);
      addAssessment({
        thread_id: res.thread_id,
        title: `Loan Assessment — ${res.thread_id.slice(0, 8)}`,
        status: res.status,
        pending_gate: res.pending_gate,
        pending_payload: res.pending_payload,
        stage_log: res.stage_log,
        acted_gate: res.acted_gate,
        created_at: new Date().toISOString(),
      });
      toast.success(`${WORKSPACE.TOAST_ASSESSMENT_STARTED}: ${res.thread_id}`);
    } catch {
      toast.error(WORKSPACE.TOAST_ASSESSMENT_FAILED);
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Always release the input value so re-picking the same file fires again.
    e.target.value = '';
    if (!file) return;
    setPendingFile(file);
    setSector('');
    setRegion('');
  }

  async function handleConfirmScope() {
    const file = pendingFile;
    if (!file) return;
    if (!sector || !region) {
      toast.error(WORKSPACE.TOAST_CONTEXT_REQUIRED);
      return;
    }
    setPendingFile(null);
    await runAssessment({ file, sector, region });
  }

  function handleCancelScope() {
    setPendingFile(null);
    setSector('');
    setRegion('');
  }

  async function handleSend(text: string): Promise<string> {
    // ── Send to backend Planner AI ─────────────────────────────────────────
    // The backend LLM (GPT-4o / Claude) decides intent — the model replies
    // conversationally unless the officer explicitly uploads a document and
    // triggers a workflow via the file-attach button.
    try {
      const chatRes = await sendChatMessage(text);
      return chatRes.reply;
    } catch {
      // ── Backend unreachable — local keyword fallback ────────────────────
      const intent = detectIntentLocally(text);
      if (intent === 'greeting') return GREETING_REPLY;
      if (intent === 'capability') return CAPABILITY_REPLY;
      return (
        'I can help you assess loan applications, review documents, or research markets. ' +
        'Attach a document using the + button to begin an assessment.'
      );
    }
  }

  const needsScope = pendingFile !== null;

  const scopePrompt: ReactNode = needsScope ? (
    <div
      className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-950/30"
      data-testid="assessment-scope-prompt"
    >
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        {WORKSPACE.CONTEXT_PROMPT_HEADING}
      </p>
      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
        {WORKSPACE.CONTEXT_PROMPT_BODY}
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="assessment-sector"
            className="mb-1 block text-xs font-medium text-amber-900 dark:text-amber-200"
          >
            {WORKSPACE.CONTEXT_PROMPT_SECTOR_LABEL}
          </label>
          <select
            id="assessment-sector"
            data-testid="assessment-sector-select"
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="w-full cursor-pointer rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/40 dark:border-amber-700/60 dark:bg-dark-surface dark:text-slate-100"
          >
            <option value="">{WORKSPACE.CONTEXT_PROMPT_SECTOR_PLACEHOLDER}</option>
            {SECTORS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="min-w-0 flex-1">
          <label
            htmlFor="assessment-region"
            className="mb-1 block text-xs font-medium text-amber-900 dark:text-amber-200"
          >
            {WORKSPACE.CONTEXT_PROMPT_REGION_LABEL}
          </label>
          <select
            id="assessment-region"
            data-testid="assessment-region-select"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full cursor-pointer rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/40 dark:border-amber-700/60 dark:bg-dark-surface dark:text-slate-100"
          >
            <option value="">{WORKSPACE.CONTEXT_PROMPT_REGION_PLACEHOLDER}</option>
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-2 truncate text-xs text-amber-700 dark:text-amber-400">
        {WORKSPACE.CONTEXT_PROMPT_FILE_LABEL}: {pendingFile?.name}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          data-testid="assessment-start-button"
          onClick={handleConfirmScope}
          disabled={uploading || !sector || !region}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {WORKSPACE.CONTEXT_PROMPT_CONFIRM}
        </button>
        <button
          type="button"
          onClick={handleCancelScope}
          disabled={uploading}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-dark-surface-hover"
        >
          {WORKSPACE.CONTEXT_PROMPT_CANCEL}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <AppLayout title={WORKSPACE.PAGE_TITLE} subtitle={WORKSPACE.PAGE_SUBTITLE}>
      <div className="flex h-full gap-4">
        <TaskPanel />
        <ChatPanel
          onSend={handleSend}
          uploading={uploading}
          onFileAttach={handleFileAttach}
          startFlowPrompt={scopePrompt}
        />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={UI.ACCEPTED_FILE_TYPES}
        className="hidden"
        onChange={handleFileSelected}
      />
    </AppLayout>
  );
}
