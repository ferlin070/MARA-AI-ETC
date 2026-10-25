import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Chip, Typography } from '@openhands/ui';
import { AppLayout } from '../components/layout/AppLayout';
import {
  getApplicationDetail,
  submitOfficerApplicationDecision,
  ApiError,
  type V1ApplicationDetailOutput,
  type V1OfficerDecisionAction,
  type AiAssessmentCompliance,
  type AiAssessmentFinance,
  type AiAssessmentRisk,
  type AiAssessmentMarket,
  type AiAssessmentRecommendation,
} from '../services/api';
import { confidenceColor } from '../types/documents';

export function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<V1ApplicationDetailOutput | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [violationAcknowledged, setViolationAcknowledged] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getApplicationDetail(id)
      .then((data) => { if (!cancelled) setDetail(data); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setError('Akses ditolak — peranan Officer/Admin diperlukan.');
        } else if (err instanceof ApiError && err.status === 404) {
          setError('Permohonan tidak dijumpai.');
        } else {
          setError('Gagal memuatkan butiran permohonan. Sila cuba lagi.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  async function handleDecision(action: V1OfficerDecisionAction) {
    if (!id || actionLoading) return;
    setActionLoading(action);
    setActionError(null);
    setActionSuccess(null);
    try {
      await submitOfficerApplicationDecision(id, {
        action,
        reason:
          action === 'approve'
            ? 'Diluluskan oleh pegawai selepas semakan penuh'
            : action === 'reject'
              ? 'Ditolak oleh pegawai selepas semakan penuh'
              : 'Maklumat tambahan diperlukan',
      });
      setActionSuccess(
        action === 'approve'
          ? 'Permohonan diluluskan.'
          : action === 'reject'
            ? 'Permohonan ditolak.'
            : 'Permintaan maklumat tambahan dihantar.',
      );
      // Refresh detail to show updated status
      const updated = await getApplicationDetail(id);
      setDetail(updated);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError(err.detail ?? err.message);
      } else {
        setActionError('Keputusan gagal dihantar. Sila cuba lagi.');
      }
    } finally {
      setActionLoading(null);
    }
  }

  const isFinalised =
    detail?.status === 'APPROVED' || detail?.status === 'REJECTED';

  const hasViolation = detail?.ai_assessment?.recommendation?.has_acknowledged_violation ?? false;

  const statusChipColor = (s: string): 'green' | 'red' | 'primaryDark' | 'gray' => {
    if (s === 'APPROVED') return 'green';
    if (s === 'REJECTED') return 'red';
    if (s === 'PROCESSING' || s === 'UNDER_REVIEW') return 'primaryDark';
    return 'gray';
  };

  return (
    <AppLayout title="Butiran Kes" subtitle="Semakan permohonan">
      <div className="space-y-4 py-4">
        <button
          type="button"
          onClick={() => navigate('/review')}
          className="cursor-pointer text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          ← Kembali ke Queue
        </button>

        {loading && (
          <div className="py-12 text-center">
            <Typography.Text fontSize="m" className="text-slate-400">
              Memuatkan butiran permohonan…
            </Typography.Text>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800/60 dark:bg-red-950/40">
            <Typography.Text fontSize="s" className="text-red-700 dark:text-red-300">
              {error}
            </Typography.Text>
          </div>
        )}

        {!loading && detail && (
          <>
            {/* ── Header ── */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-[#222328] dark:bg-[#131417]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Typography.H4 className="text-slate-900 dark:text-white">
                    {detail.applicant.full_name}
                  </Typography.H4>
                  <Typography.Text fontSize="xs" className="mt-1 block text-slate-400">
                    ID: {detail.application_id}
                  </Typography.Text>
                </div>
                <Chip color={statusChipColor(detail.status)} variant="corner">
                  {detail.status.replace(/_/g, ' ')}
                </Chip>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
                <InfoItem label="IC" value={detail.applicant.ic_number} />
                <InfoItem label="Telefon" value={detail.applicant.phone} />
                <InfoItem label="E-mel" value={detail.applicant.email} />
                <InfoItem label="Negeri" value={detail.applicant.state} />
                <InfoItem label="Perniagaan" value={detail.business.business_name} />
                <InfoItem label="SSM" value={detail.business.ssm_number} />
                <InfoItem label="Sektor" value={detail.business.sector} />
                <InfoItem
                  label="Hasil Bulanan"
                  value={`RM ${detail.business.monthly_revenue_avg.toLocaleString('en-MY')}`}
                />
                <InfoItem label="Skim" value={detail.financing.scheme} />
                <InfoItem
                  label="Jumlah"
                  value={`RM ${detail.financing.amount_requested.toLocaleString('en-MY')}`}
                />
                <InfoItem label="Tempoh" value={`${detail.financing.tenure_months} bulan`} />
                <InfoItem label="Tujuan" value={detail.financing.purpose} />
              </div>
            </div>

            {/* ── AI Assessment sections ── */}
            {detail.ai_assessment.compliance && (
              <ComplianceSection data={detail.ai_assessment.compliance} />
            )}
            {detail.ai_assessment.finance && (
              <FinanceSection data={detail.ai_assessment.finance} />
            )}
            {detail.ai_assessment.risk && (
              <RiskSection data={detail.ai_assessment.risk} />
            )}
            {detail.ai_assessment.market && (
              <MarketSection data={detail.ai_assessment.market} />
            )}
            {detail.ai_assessment.recommendation && (
              <RecommendationSection data={detail.ai_assessment.recommendation} />
            )}

            {!detail.ai_assessment.compliance &&
              !detail.ai_assessment.finance &&
              !detail.ai_assessment.risk &&
              !detail.ai_assessment.market &&
              !detail.ai_assessment.recommendation && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/60 dark:bg-amber-950/40">
                <Typography.Text fontSize="s" className="text-amber-700 dark:text-amber-300">
                  Penilaian AI belum tersedia untuk permohonan ini.
                </Typography.Text>
              </div>
            )}

            {/* ── Documents ── */}
            {detail.documents.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-[#222328] dark:bg-[#131417]">
                <Typography.Text fontSize="s" fontWeight={600} className="mb-3 block text-slate-900 dark:text-slate-100">
                  Dokumen ({detail.documents.length})
                </Typography.Text>
                <div className="space-y-2">
                  {detail.documents.map((doc, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-md bg-slate-50 p-2 text-sm dark:bg-[#18191C]">
                      <Chip color="gray" variant="pill">{doc.doc_type}</Chip>
                      <span className="text-slate-600 dark:text-slate-300">{doc.file_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Decision ── §10.4: buttons only appear after detail rendered ── */}
            {actionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800/60 dark:bg-red-950/40">
                <Typography.Text fontSize="s" className="text-red-700 dark:text-red-300">
                  {actionError}
                </Typography.Text>
              </div>
            )}
            {actionSuccess && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800/60 dark:bg-green-950/40">
                <Typography.Text fontSize="s" className="text-green-700 dark:text-green-300">
                  {actionSuccess}
                </Typography.Text>
              </div>
            )}

            {!isFinalised && (
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-[#222328] dark:bg-[#131417]">
                <Typography.Text fontSize="s" fontWeight={600} className="mb-3 block text-slate-900 dark:text-slate-100">
                  Keputusan Pegawai
                </Typography.Text>

                {/* §10.4 + shared/schemas/recommendation.py: officer must explicitly
                    acknowledge any hard compliance violation before approving */}
                {hasViolation && (
                  <label className="mb-3 flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      checked={violationAcknowledged}
                      onChange={(e) => setViolationAcknowledged(e.target.checked)}
                    />
                    <Typography.Text fontSize="xs" className="text-amber-700 dark:text-amber-300">
                      Saya akui bahawa terdapat pelanggaran pematuhan keras dalam permohonan ini dan
                      memahami risiko sebelum meluluskan cadangan.
                    </Typography.Text>
                  </label>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    disabled={actionLoading !== null || (hasViolation && !violationAcknowledged)}
                    onClick={() => handleDecision('approve')}
                  >
                    {actionLoading === 'approve' ? 'Menghantar…' : 'Lulus'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={actionLoading !== null}
                    onClick={() => handleDecision('reject')}
                  >
                    {actionLoading === 'reject' ? 'Menghantar…' : 'Tolak'}
                  </Button>
                  <Button
                    variant="tertiary"
                    disabled={actionLoading !== null}
                    onClick={() => handleDecision('request_more_info')}
                  >
                    {actionLoading === 'request_more_info' ? 'Menghantar…' : 'Minta Maklumat'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

// ── Helper components ────────────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-400 dark:text-slate-500">{label}: </span>
      <span className="font-medium text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-[#222328] dark:bg-[#131417]">
      <Typography.Text fontSize="s" fontWeight={600} className="mb-3 block text-slate-900 dark:text-slate-100">
        {title}
      </Typography.Text>
      {children}
    </div>
  );
}

function ComplianceSection({ data }: { data: AiAssessmentCompliance }) {
  const failCount = data.items.filter((i) => i.status === 'fail').length;
  return (
    <SectionCard title={`Pematuhan${failCount > 0 ? ` — ${failCount} pelanggaran keras` : ''}`}>
      {failCount > 0 && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-800/60 dark:bg-red-950/40">
          <Typography.Text fontSize="xs" className="text-red-700 dark:text-red-300">
            ⚠ {failCount} pelanggaran keras — semakan wajib sebelum meluluskan
          </Typography.Text>
        </div>
      )}
      <div className="space-y-2">
        {data.items.map((item, i) => {
          const colors: Record<string, 'green' | 'red' | 'primaryDark' | 'gray'> = {
            pass: 'green', fail: 'red', exception: 'primaryDark', no_policy_found: 'gray',
          };
          return (
            <div key={i} className="flex items-start justify-between gap-2 rounded-md bg-slate-50 p-2 dark:bg-[#18191C]">
              <Typography.Text fontSize="xs" className="text-slate-700 dark:text-slate-300">
                {item.requirement}
              </Typography.Text>
              <Chip color={colors[item.status] ?? 'gray'} variant="pill">
                {item.status.replace(/_/g, ' ')}
              </Chip>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function FinanceSection({ data }: { data: AiAssessmentFinance }) {
  return (
    <SectionCard title="Analisis Kewangan">
      <div className="mb-2 flex items-center gap-2">
        <Chip color={confidenceColor(data.assessment_confidence) as 'green' | 'primaryDark' | 'red'} variant="pill">
          Keyakinan: {(data.assessment_confidence * 100).toFixed(0)}%
        </Chip>
      </div>
      <Typography.Text fontSize="s" className="mb-3 block text-slate-700 dark:text-slate-300">
        {data.assessment || 'Tiada penilaian naratif.'}
      </Typography.Text>
      {data.figures.length > 0 && (
        <div className="space-y-1">
          {data.figures.map((fig, i) => (
            <div key={i} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm dark:bg-[#18191C]">
              <span className="text-slate-500 dark:text-slate-400">{fig.name}</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {typeof fig.value === 'number' ? fig.value.toLocaleString('en-MY') : fig.value}
                </span>
                <Chip color="gray" variant="pill">{fig.provenance}</Chip>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function RiskSection({ data }: { data: AiAssessmentRisk }) {
  const scoreVal = data.overall_score ?? 0;
  const scoreColor: 'green' | 'primaryDark' | 'red' =
    scoreVal > 0.7 ? 'red' : scoreVal > 0.4 ? 'primaryDark' : 'green';
  return (
    <SectionCard title="Penilaian Risiko">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip color={data.status === 'complete' ? 'green' : 'gray'} variant="pill">
          {data.status}
        </Chip>
        {data.overall_score !== null && (
          <Chip color={scoreColor} variant="pill">
            Skor: {(data.overall_score * 100).toFixed(0)}%
          </Chip>
        )}
        {data.qualitative_range && (
          <Chip color="primaryDark" variant="pill">{data.qualitative_range}</Chip>
        )}
        <Chip color={confidenceColor(data.confidence) as 'green' | 'primaryDark' | 'red'} variant="pill">
          Keyakinan: {(data.confidence * 100).toFixed(0)}%
        </Chip>
      </div>
      {data.escalation_reason && (
        <Typography.Text fontSize="xs" className="mb-2 block text-amber-600 dark:text-amber-400">
          Eskalasi: {data.escalation_reason}
        </Typography.Text>
      )}
      {Object.keys(data.component_scores).length > 0 && (
        <div className="space-y-1">
          {Object.entries(data.component_scores).map(([key, val]) => (
            <div key={key} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-sm dark:bg-[#18191C]">
              <span className="text-slate-500 dark:text-slate-400 capitalize">{key}</span>
              <Chip color={val > 0.7 ? 'red' : val > 0.4 ? 'primaryDark' : 'green'} variant="pill">
                {(val * 100).toFixed(0)}%
              </Chip>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function MarketSection({ data }: { data: AiAssessmentMarket }) {
  return (
    <SectionCard title="Konteks Pasaran">
      <div className="mb-2 flex items-center gap-2">
        <Chip color="gray" variant="pill">{data.sector}</Chip>
        <Chip color="gray" variant="pill">{data.region}</Chip>
        {!data.live_search_available && (
          <Chip color="primaryDark" variant="pill">Carian langsung tidak tersedia</Chip>
        )}
      </div>
      {data.note && (
        <Typography.Text fontSize="xs" className="mb-2 block text-amber-600 dark:text-amber-400">
          {data.note}
        </Typography.Text>
      )}
      <div className="space-y-2">
        {data.claims.map((claim, i) => (
          <div key={i} className="rounded-md bg-slate-50 p-2 text-sm dark:bg-[#18191C]">
            <p className="text-slate-700 dark:text-slate-300">{claim.claim}</p>
            <div className="mt-1 flex items-center gap-2">
              <a
                href={claim.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-500 underline"
              >
                Sumber
              </a>
              <Chip
                color={claim.credibility_score >= 0.7 ? 'green' : 'primaryDark'}
                variant="pill"
              >
                Kredibiliti: {(claim.credibility_score * 100).toFixed(0)}%
              </Chip>
            </div>
          </div>
        ))}
        {data.claims.length === 0 && (
          <Typography.Text fontSize="xs" className="text-slate-400">
            Tiada tuntutan pasaran tersedia.
          </Typography.Text>
        )}
      </div>
    </SectionCard>
  );
}

function RecommendationSection({ data }: { data: AiAssessmentRecommendation }) {
  return (
    <SectionCard title="Cadangan AI">
      {data.has_acknowledged_violation && (
        <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/40">
          <Typography.Text fontSize="s" fontWeight={600} className="text-amber-800 dark:text-amber-200">
            ⚠ Pelanggaran Pematuhan Keras Diakui
          </Typography.Text>
          <Typography.Text fontSize="xs" className="mt-1 block text-amber-700 dark:text-amber-300">
            Cadangan ini dihasilkan melalui laluan pengecualian — pelanggaran keras telah diakui
            di peringkat atas. Semak bahagian Pematuhan sebelum menerima cadangan ini.
          </Typography.Text>
        </div>
      )}

      {data.withheld_reason ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800/60 dark:bg-red-950/40">
          <Typography.Text fontSize="s" fontWeight={600} className="text-red-700 dark:text-red-300">
            Cadangan Ditahan
          </Typography.Text>
          <Typography.Text fontSize="s" className="mt-1 block text-red-600 dark:text-red-400">
            {data.withheld_reason}
          </Typography.Text>
          {data.missing_inputs.length > 0 && (
            <Typography.Text fontSize="xs" className="mt-1 block text-red-500 dark:text-red-400">
              Input hilang: {data.missing_inputs.join(', ')}
            </Typography.Text>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {data.decision && (
              <Chip
                color={data.decision === 'approve' ? 'green' : data.decision === 'approve_with_conditions' ? 'primaryDark' : 'red'}
                variant="pill"
              >
                {data.decision.replace(/_/g, ' ')}
              </Chip>
            )}
            <Chip color={confidenceColor(data.confidence) as 'green' | 'primaryDark' | 'red'} variant="pill">
              Keyakinan: {(data.confidence * 100).toFixed(0)}%
            </Chip>
          </div>
          <Typography.Text fontSize="s" className="text-slate-700 dark:text-slate-300">
            {data.reasoning_trail}
          </Typography.Text>
          {data.conditions.length > 0 && (
            <div>
              <Typography.Text fontSize="xs" fontWeight={600} className="block text-slate-500 dark:text-slate-400">
                Syarat:
              </Typography.Text>
              {data.conditions.map((c, i) => (
                <Typography.Text key={i} fontSize="xs" className="block text-slate-500 dark:text-slate-400">
                  • {c}
                </Typography.Text>
              ))}
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
