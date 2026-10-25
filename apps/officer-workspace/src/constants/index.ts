export const CONFIDENCE = {
  HIGH_THRESHOLD: 0.85,
  MEDIUM_THRESHOLD: 0.6,
  HIGH_LABEL: 'High',
  MEDIUM_LABEL: 'Medium',
  LOW_LABEL: 'Low',
} as const;

export const MOCK_AUTH = {
  DEV_ROLE: 'Officer',
  DEV_BRANCH: 'Cawangan Ibu Pejabat',
  DEV_NAME: 'Pegawai MARA',
} as const;

export const API = {
  BASE_PATH: '/api',
  ENDPOINTS: {
    CREATE_ASSESSMENT: '/loans/assessments',
    SUBMIT_DECISION: (threadId: string) => `/loans/assessments/${threadId}/decision`,
  },
} as const;

export const UI = {
  DEFAULT_CONFIDENCE_THRESHOLD: 0.85,
  DEBOUNCE_MS: 300,
  TOAST_DURATION: 4000,
  LOCALE: 'en-MY',
  BRAND_ORANGE: '#F97316',
  BRAND_ORANGE_HOVER: '#EA580C',
  /**
   * Placeholder values only. They must never be sent as if the officer had
   * chosen them: 'general' gives the Market agent nothing to research and
   * 'unknown' leaves Finance/Risk without a regional cost base. WorkspacePage
   * refuses to start an assessment on these and asks the officer instead.
   */
  DEFAULT_SECTOR: 'general',
  DEFAULT_REGION: 'unknown',
  PLACEHOLDER_MOCK_FILE_NAME: 'document.pdf',
  ACCEPTED_FILE_TYPES: '.pdf,.doc,.docx,.png,.jpg,.jpeg',
  DATE_FORMAT_OPTIONS: { hour: '2-digit' as const, minute: '2-digit' as const },
  INPUT_BAR_HEIGHT: 58,
  BUTTON_DIMENSION: 42,
  ICON_BUTTON_DIMENSION: 9,
} as const;

/**
 * Sector options for a loan assessment. The value is what goes to the backend
 * (`sector` form field) and to the Market agent's search; the label is what the
 * officer reads. Keep values stable — they appear in stored assessments.
 */
export const SECTORS = [
  { value: 'food_beverage', label: 'Makanan & Minuman (F&B)' },
  { value: 'retail', label: 'Peruncitan' },
  { value: 'services', label: 'Perkhidmatan' },
  { value: 'manufacturing', label: 'Pembuatan' },
  { value: 'agriculture', label: 'Pertanian & Perladangan' },
  { value: 'construction', label: 'Pembinaan' },
  { value: 'technology', label: 'Teknologi & Digital' },
  { value: 'tourism', label: 'Pelancongan & Hospitaliti' },
  { value: 'education', label: 'Pendidikan' },
  { value: 'healthcare', label: 'Kesihatan' },
  { value: 'transport', label: 'Pengangkutan & Logistik' },
  { value: 'other', label: 'Lain-lain' },
] as const;

/** 13 states + 3 federal territories. Value = backend `region` field. */
export const REGIONS = [
  { value: 'Johor', label: 'Johor' },
  { value: 'Kedah', label: 'Kedah' },
  { value: 'Kelantan', label: 'Kelantan' },
  { value: 'Melaka', label: 'Melaka' },
  { value: 'Negeri Sembilan', label: 'Negeri Sembilan' },
  { value: 'Pahang', label: 'Pahang' },
  { value: 'Perak', label: 'Perak' },
  { value: 'Perlis', label: 'Perlis' },
  { value: 'Pulau Pinang', label: 'Pulau Pinang' },
  { value: 'Sabah', label: 'Sabah' },
  { value: 'Sarawak', label: 'Sarawak' },
  { value: 'Selangor', label: 'Selangor' },
  { value: 'Terengganu', label: 'Terengganu' },
  { value: 'W.P. Kuala Lumpur', label: 'W.P. Kuala Lumpur' },
  { value: 'W.P. Labuan', label: 'W.P. Labuan' },
  { value: 'W.P. Putrajaya', label: 'W.P. Putrajaya' },
] as const;

export const WORKSPACE = {
  PAGE_TITLE: 'Officer Workspace',
  PAGE_SUBTITLE: 'Chat & task view',
  CHAT_HEADING: 'Workspace',
  CHAT_PLACEHOLDER: 'Describe your task — e.g. Assess the loan application from Ahmad bin Abdullah',
  FILE_ATTACH_TITLE: 'Attach file',
  VOICE_INPUT_TITLE: 'Voice input',
  SEND_MESSAGE_TITLE: 'Send message',
  TASK_HEADING: 'Tasks',
  CHIP_ACTIVE_LABEL: 'active',
  CHIP_AWAITING_LABEL: 'awaiting',
  TOAST_ASSESSMENT_STARTED: 'Assessment started',
  TOAST_ASSESSMENT_FAILED: 'Failed to start assessment',
  TOAST_CONTEXT_REQUIRED: 'Sila pilih sektor dan negeri sebelum mula.',
  DOT_AGENT_COLOR: 'bg-emerald-500',
  FONT_XS_11: 'text-[11px]',
  CONTEXT_PROMPT_HEADING: 'Skop penilaian diperlukan',
  CONTEXT_PROMPT_BODY:
    'Ejen Pasaran dan Kewangan memerlukan sektor dan negeri sebenar. ' +
    'Pilih kedua-duanya — sistem tidak akan menghantar nilai lalai.',
  CONTEXT_PROMPT_FILE_LABEL: 'Dokumen',
  CONTEXT_PROMPT_SECTOR_LABEL: 'Sektor',
  CONTEXT_PROMPT_REGION_LABEL: 'Negeri / Wilayah',
  CONTEXT_PROMPT_SECTOR_PLACEHOLDER: 'Pilih sektor',
  CONTEXT_PROMPT_REGION_PLACEHOLDER: 'Pilih negeri',
  CONTEXT_PROMPT_CONFIRM: 'Mula penilaian',
  CONTEXT_PROMPT_CANCEL: 'Batal',
} as const;
