import { getAccessToken } from './auth';
import { API } from '../constants';
import type { Citation } from '../types/documents';
import type { PolicyCitation } from '../types/knowledge';

const API_BASE = import.meta.env.VITE_API_GATEWAY_URL || API.BASE_PATH;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
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

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(403, 'Gate requires a different role', body.detail);
  }

  if (res.status === 503) {
    throw new ApiError(503, 'OCR/document-classifier engine not available');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.message ?? body.detail ?? `Request failed (${res.status})`,
      body.detail,
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
