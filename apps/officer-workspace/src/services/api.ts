import { toast } from 'sonner';
import { getAccessToken, logout } from './auth';
import { API } from '../constants';
import type { Citation } from '../types/documents';
import type { PolicyCitation } from '../types/knowledge';

const API_BASE = import.meta.env.VITE_API_GATEWAY_URL || API.BASE_PATH;

/**
 * How a failed request should be surfaced. Callers branch on `kind` rather than
 * on raw status numbers so the mapping lives in exactly one place:
 *
 *   401  session gone            -> clear local session, redirect to /login
 *   403  signed in, wrong role   -> inline permission banner, no redirect
 *   5xx  upstream fault          -> one quiet retry, then a toast
 *   503  known engine down       -> explicit "OCR unavailable" message
 *   net  fetch rejected          -> network message, never a raw TypeError
 */
export type ApiErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'server'
  | 'unavailable'
  | 'http'
  | 'network';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string,
    public kind: ApiErrorKind = 'http',
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 403 — render an inline banner; the session itself is still valid. */
  get isForbidden(): boolean {
    return this.kind === 'forbidden';
  }

  /** 5xx — already retried once by `request` before this was thrown. */
  get isServerFault(): boolean {
    return this.kind === 'server' || this.kind === 'unavailable';
  }
}

const SERVER_RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

/**
 * 401 handling: the session is dead (expired, revoked, wrong audience). Clear it
 * and send the officer back to /login. Only fires when a token was actually
 * attached — a 401 from /auth/login means bad credentials, not a dead session,
 * and must not bounce an unauthenticated user around the app.
 */
function handleUnauthorized(): void {
  toast.error('Sesi tamat. Sila log masuk semula.');
  // logout() redirects on its own; swallow rejection so the caller still
  // receives the ApiError and can stop its loading state.
  void logout().catch(() => undefined);
}

function parseErrorBody(raw: unknown): { message?: string; detail?: string } {
  if (!raw || typeof raw !== 'object') return {};
  const body = raw as Record<string, unknown>;
  return {
    message: typeof body.message === 'string' ? body.message : undefined,
    detail: typeof body.detail === 'string' ? body.detail : undefined,
  };
}

async function readErrorBody(res: Response): Promise<{ message?: string; detail?: string }> {
  return parseErrorBody(await res.json().catch(() => null));
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<T> {
  const token = accessToken === undefined ? await getAccessToken() : accessToken;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    throw new ApiError(
      0,
      'Rangkaian tidak dapat dihubungi. Semak sambungan anda.',
      err instanceof Error ? err.message : undefined,
      'network',
    );
  }

  // 5xx: one quiet retry. Transient gateway restarts are the common case and a
  // single retry absorbs them without the officer seeing anything.
  if (isRetryableStatus(res.status)) {
    await sleep(SERVER_RETRY_DELAY_MS);
    try {
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (err) {
      toast.error('Pelayan tidak dapat dihubungi. Sila cuba lagi.');
      throw new ApiError(
        0,
        'Pelayan tidak dapat dihubungi selepas cubaan semula.',
        err instanceof Error ? err.message : undefined,
        'network',
      );
    }
  }

  if (res.status === 401) {
    const body = await readErrorBody(res);
    if (token) handleUnauthorized();
    throw new ApiError(
      401,
      body.message ?? 'Sesi tidak sah atau telah tamat.',
      body.detail,
      'unauthorized',
    );
  }

  if (res.status === 403) {
    const body = await readErrorBody(res);
    throw new ApiError(
      403,
      body.message ?? 'Peranan anda tidak dibenarkan untuk tindakan ini.',
      body.detail,
      'forbidden',
    );
  }

  if (res.status === 503) {
    throw new ApiError(
      503,
      'Enjin OCR/klasifikasi dokumen tidak tersedia.',
      undefined,
      'unavailable',
    );
  }

  if (isRetryableStatus(res.status)) {
    const body = await readErrorBody(res);
    toast.error('Pelayan mengalami masalah. Sila cuba lagi sebentar.');
    throw new ApiError(
      res.status,
      body.message ?? body.detail ?? `Pelayan gagal (${res.status}).`,
      body.detail,
      'server',
    );
  }

  if (!res.ok) {
    const body = await readErrorBody(res);
    throw new ApiError(
      res.status,
      body.message ?? body.detail ?? `Request failed (${res.status})`,
      body.detail,
      'http',
    );
  }

  return res.json() as Promise<T>;
}


// ─── Loan Assessment API ─────────────────────────────────────────

export type PendingGate =
  | 'confirm_extraction'
  | 'compliance_acknowledgment'
  | 'financial_sign_off'
  | 'risk_review'
  | 'recommendation_approval'
  | 'publish_approval';

export interface AssessmentResponse {
  thread_id: string;
  status: 'pending_approval' | 'completed';
  pending_gate: PendingGate | null;
  pending_payload: Record<string, unknown> | null;
  stage_log: StageLogEntry[];
  acted_gate: PendingGate | null;
}

export interface StageLogEntry {
  stage: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  agent: string;
  result: Record<string, unknown> | null;
}

export interface CreateAssessmentInput {
  file: File;
  sector: string;
  region: string;
  compliance_requirements?: string[];
  product_query?: string;
  precedent_query?: string;
}

export interface DecisionInput {
  action: 'approve' | 'reject' | 'correct';
  reason?: string;
  corrections?: {
    field_name: string;
    corrected_value: string;
    reason: string;
  }[];
}

export async function createAssessment(
  input: CreateAssessmentInput,
): Promise<AssessmentResponse> {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('sector', input.sector);
  formData.append('region', input.region);
  if (input.compliance_requirements?.length) {
    for (const req of input.compliance_requirements) {
      formData.append('compliance_requirements', req);
    }
  }
  if (input.product_query) formData.append('product_query', input.product_query);
  if (input.precedent_query) formData.append('precedent_query', input.precedent_query);

  return request<AssessmentResponse>('/loans/assessments', {
    method: 'POST',
    body: formData,
  });
}

export async function submitDecision(
  threadId: string,
  input: DecisionInput,
): Promise<AssessmentResponse> {
  return request<AssessmentResponse>(
    `/loans/assessments/${threadId}/decision`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

// ─── Chat API ─────────────────────────────────────────────────────

export interface ChatApiResponse {
  /** What to show the user. Always present. */
  reply: string;
  /** "conversational" | "workflow_started" | "clarification" | "error" */
  intent: string;
  /** Non-null when a workflow was launched by the Planner. */
  workflow: { template_name: string; confidence: number } | null;
}

/**
 * Send a free-text message to the AI gateway.  The backend Planner
 * classifies the intent and decides whether to trigger a workflow or just
 * chat — mirroring how Claude/Copilot behave: the model, not a hard-coded
 * trigger, decides when a tool is actually needed.
 */
export async function sendChatMessage(message: string): Promise<ChatApiResponse> {
  return request<ChatApiResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ─── Vertical Slice v1 API (/api/v1/*) ─────────────────────────────────────

export type V1ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'NEEDS_INFO'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export type V1OfficerDecisionAction = 'approve' | 'reject' | 'request_more_info';

export interface V1OfficerQueueItem {
  application_id: string;
  applicant_name: string;
  scheme: string;
  amount_requested: number;
  status: V1ApplicationStatus;
  updated_at: string;
}

export interface V1OfficerQueueOutput {
  items: V1OfficerQueueItem[];
}

export interface V1ApplicationStatusOutput {
  application_id: string;
  status: V1ApplicationStatus;
  stage_log: string[];
  updated_at: string;
}

export interface V1ApplicationDocument {
  doc_type: string;
  file_name: string;
  mime_type: string;
  file_path: string;
}

// ─── AI Assessment — mirrors shared/schemas/ contracts ─────────────────────

export interface AiAssessmentComplianceItem {
  requirement: string;
  status: 'pass' | 'fail' | 'exception' | 'no_policy_found';
  policy_citation: PolicyCitation | null;
  notes?: string;
}

export interface AiAssessmentCompliance {
  document_id: string;
  items: AiAssessmentComplianceItem[];
}

export interface AiAssessmentFinanceFigure {
  name: string;
  value: number;
  provenance: 'extracted' | 'calculated';
  source_citation?: Citation | null;
  formula_id?: string | null;
  formula_version?: string | null;
}

export interface AiAssessmentFinance {
  document_id: string;
  figures: AiAssessmentFinanceFigure[];
  assessment: string;
  assessment_confidence: number;
  product_term_citations: PolicyCitation[];
}

export interface AiAssessmentRisk {
  document_id: string;
  status: 'complete' | 'incomplete' | 'escalated';
  component_scores: Record<string, number>;
  overall_score: number | null;
  qualitative_range: string | null;
  confidence: number;
  missing_inputs: string[];
  escalation_reason: string | null;
  citations: PolicyCitation[];
}

export interface AiAssessmentMarketClaim {
  claim: string;
  source_url: string;
  retrieved_at: string;
  credibility_score: number;
}

export interface AiAssessmentMarket {
  sector: string;
  region: string;
  claims: AiAssessmentMarketClaim[];
  live_search_available: boolean;
  note: string;
}

export interface AiAssessmentRecommendation {
  document_id: string;
  decision: 'approve' | 'decline' | 'approve_with_conditions' | null;
  reasoning_trail: string;
  conditions: string[];
  confidence: number;
  precedent_citations: PolicyCitation[];
  withheld_reason: string | null;
  missing_inputs: string[];
  has_acknowledged_violation: boolean;
}

/** Typed shape of V1ApplicationDetailOutput.ai_assessment — mirrors shared/schemas/ */
export interface AiAssessment {
  compliance?: AiAssessmentCompliance;
  finance?: AiAssessmentFinance;
  risk?: AiAssessmentRisk;
  market?: AiAssessmentMarket;
  recommendation?: AiAssessmentRecommendation;
}

export interface V1ApplicationDetailOutput {
  application_id: string;
  status: V1ApplicationStatus;
  applicant: {
    full_name: string;
    ic_number: string;
    phone: string;
    email: string;
    state: string;
  };
  business: {
    business_name: string;
    ssm_number: string;
    sector: string;
    years_operating: number;
    monthly_revenue_avg: number;
  };
  financing: {
    scheme: string;
    amount_requested: number;
    purpose: string;
    tenure_months: number;
  };
  documents: V1ApplicationDocument[];
  ai_assessment: AiAssessment;
  workflow: Record<string, unknown>;
}

export interface V1OfficerDecisionInput {
  action: V1OfficerDecisionAction;
  reason?: string;
  conditions?: string[];
}

export interface V1OfficerDecisionOutput {
  application_id: string;
  status: V1ApplicationStatus;
  decision_recorded_at: string;
}

export interface V1AuthTokenOutput {
  user_id: string;
  role: 'applicant' | 'officer' | 'admin';
  access_token: string;
}

export interface V1CreateApplicationInput {
  applicant: V1ApplicationDetailOutput['applicant'];
  business: V1ApplicationDetailOutput['business'];
  financing: V1ApplicationDetailOutput['financing'];
  documents: Array<Record<string, unknown>>;
}

export interface V1CreateApplicationOutput {
  application_id: string;
  status: V1ApplicationStatus;
}

export async function registerApplicant(input: {
  full_name: string;
  email: string;
  password: string;
}): Promise<V1AuthTokenOutput> {
  return request<V1AuthTokenOutput>('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  }, null);
}

export async function loginApplicant(input: {
  email: string;
  password: string;
}): Promise<V1AuthTokenOutput> {
  return request<V1AuthTokenOutput>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  }, null);
}

export async function createApplicantApplication(
  input: V1CreateApplicationInput,
  accessToken: string,
): Promise<V1CreateApplicationOutput> {
  return request<V1CreateApplicationOutput>('/api/v1/applications', {
    method: 'POST',
    body: JSON.stringify(input),
  }, accessToken);
}

export interface V1UploadDocumentOutput {
  application_id: string;
  document: V1ApplicationDocument;
}

export async function listOfficerApplications(): Promise<V1OfficerQueueOutput> {
  return request<V1OfficerQueueOutput>('/api/v1/officer/applications');
}

export async function getApplicationDetail(
  applicationId: string,
): Promise<V1ApplicationDetailOutput> {
  return request<V1ApplicationDetailOutput>(`/api/v1/applications/${applicationId}`);
}

export async function getApplicationStatus(
  applicationId: string,
  accessToken?: string | null,
): Promise<V1ApplicationStatusOutput> {
  return request<V1ApplicationStatusOutput>(
    `/api/v1/applications/${applicationId}/status`,
    {},
    accessToken,
  );
}

export async function submitOfficerApplicationDecision(
  applicationId: string,
  input: V1OfficerDecisionInput,
): Promise<V1OfficerDecisionOutput> {
  return request<V1OfficerDecisionOutput>(
    `/api/v1/officer/applications/${applicationId}/decision`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function uploadApplicationDocument(
  applicationId: string,
  docType: string,
  file: File,
  accessToken?: string | null,
): Promise<V1UploadDocumentOutput> {
  const formData = new FormData();
  formData.append('doc_type', docType);
  formData.append('file', file);

  return request<V1UploadDocumentOutput>(
    `/api/v1/applications/${applicationId}/documents`,
    {
      method: 'POST',
      body: formData,
    },
    accessToken,
  );
}
