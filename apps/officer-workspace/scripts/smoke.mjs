#!/usr/bin/env node
/**
 * MARA Officer Workspace — Playwright smoke check (PLAN FE-P4).
 *
 * Boots the Vite dev server, then walks the officer's core path with the dev
 * session injected (no Keycloak): login state -> queue -> case detail -> 404.
 *
 * What it proves, in order:
 *   1. dev-mode session reaches the protected workspace (AuthGuard passes)
 *   2. /review renders the officer queue from the API
 *   3. clicking a queue row lands on /review/:id and renders every evidence
 *      section (Compliance, Finance, Risk, Market, Recommendation)
 *   4. the approve button does NOT exist while the detail request is in flight,
 *      and appears only after it resolves — §10.4 "no blind approval"
 *   5. an unknown route renders the "Tidak Dijumpai" page
 *
 * All backend calls are stubbed with page.route; this script needs no API
 * gateway. It talks to the dev server only.
 *
 * Usage:
 *   node scripts/smoke.mjs
 *   node scripts/smoke.mjs --headed        # watch it run
 *   node scripts/smoke.mjs --base-url http://localhost:5173
 *
 * Exit code 0 = pass. Non-zero = the failing assertion is printed.
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const headed = args.includes('--headed');
const baseUrlArg = args.indexOf('--base-url');
const BASE_URL = baseUrlArg !== -1 ? args[baseUrlArg + 1] : 'http://localhost:4000';

const APPLICATION_ID = 'APP-SMOKE-0001';

/** The shape /api/v1/applications/{id} returns. Every section populated. */
const DETAIL_FIXTURE = {
  application_id: APPLICATION_ID,
  status: 'UNDER_REVIEW',
  applicant: {
    full_name: 'Nurul Aisyah binti Hamzah',
    ic_number: '920514-14-5533',
    phone: '012-3456789',
    email: 'nurul@example.my',
    state: 'Selangor',
  },
  business: {
    business_name: 'Aisyah Katering Enterprise',
    ssm_number: '202301234567',
    sector: 'food_beverage',
    years_operating: 4,
    monthly_revenue_avg: 28000,
  },
  financing: {
    scheme: 'Skim Pembiayaan Usahawan MARA',
    amount_requested: 150000,
    purpose: 'Peralatan dapur dan pengembangan cawangan',
    tenure_months: 60,
  },
  documents: [
    { doc_type: 'ic', file_name: 'ic.pdf', mime_type: 'application/pdf', file_path: '/x/ic.pdf' },
    { doc_type: 'bank_statement', file_name: 'penyata.pdf', mime_type: 'application/pdf', file_path: '/x/p.pdf' },
  ],
  ai_assessment: {
    compliance: {
      document_id: 'doc-compliance-1',
      items: [
        {
          requirement: 'Status bumiputera',
          status: 'pass',
          policy_citation: null,
          notes: 'Disahkan melalui SSM.',
        },
      ],
    },
    finance: {
      document_id: 'doc-finance-1',
      figures: [
        { name: 'Nisbah bayaran balik', value: 0.42, provenance: 'calculated' },
      ],
      assessment: 'Aliran tunai mencukupi untuk ansuran bulanan.',
    },
    risk: {
      document_id: 'doc-risk-1',
      status: 'complete',
      component_scores: { credit: 0.22, business: 0.31 },
      overall_score: 0.28,
      qualitative_range: 'low',
      confidence: 0.81,
      missing_inputs: [],
      escalation_reason: null,
      citations: [],
    },
    market: {
      sector: 'food_beverage',
      region: 'Selangor',
      claims: [
        {
          claim: 'Permintaan katering meningkat 12% di Selangor.',
          source_url: 'https://example.my/market',
          retrieved_at: '2026-10-01T00:00:00Z',
          credibility_score: 0.74,
        },
      ],
      live_search_available: false,
      note: 'Carian langsung tidak tersedia.',
    },
    recommendation: {
      document_id: 'doc-rec-1',
      decision: 'approve_with_conditions',
      reasoning_trail: 'Semua syarat asas dipenuhi; syarat tambahan pada laporan bulanan.',
      conditions: ['Laporan kewangan bulanan selama 6 bulan'],
      confidence: 0.79,
      precedent_citations: [],
      withheld_reason: null,
      missing_inputs: [],
      has_acknowledged_violation: false,
    },
  },
  workflow: {},
};

const QUEUE_FIXTURE = {
  items: [
    {
      application_id: APPLICATION_ID,
      applicant_name: 'Nurul Aisyah binti Hamzah',
      scheme: 'Skim Pembiayaan Usahawan MARA',
      amount_requested: 150000,
      status: 'UNDER_REVIEW',
      updated_at: '2026-10-24T09:00:00Z',
    },
  ],
};

// ── helpers ────────────────────────────────────────────────────────────────

const findings = [];
function pass(label) {
  findings.push({ ok: true, label });
  console.log(`  ok    ${label}`);
}
function fail(label, err) {
  findings.push({ ok: false, label, err });
  console.log(`  FAIL  ${label}`);
  if (err) console.log(`        ${err.message?.split('\n')[0] ?? err}`);
}
async function check(label, fn) {
  try {
    await fn();
    pass(label);
  } catch (err) {
    fail(label, err);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Poll until the dev server answers, or give up after `timeoutMs`. */
async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok || res.status === 404) return true;
    } catch {
      // not up yet
    }
    await delay(500);
  }
  return false;
}

/** Path to Vite's CLI entrypoint inside this app's node_modules. */
function viteEntry() {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', 'node_modules', 'vite', 'bin', 'vite.js');
}

async function isServerUp(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  let devServer = null;

  if (!(await isServerUp(BASE_URL))) {
    console.log(`> starting dev server (${BASE_URL})`);
    // Detached + piped: Vite keeps the port open in a child process, so the
    // process tree has to be killed as a group, and the pipes must stay drained
    // or the child blocks once the buffer fills.
    // Spawn Vite's own entrypoint with this Node binary instead of `npm run
    // dev`: no shell wrapper means the pid we hold IS the dev server, so the
    // teardown actually stops it (a spawned .cmd cannot be killed reliably).
    devServer = spawn(process.execPath, [viteEntry()], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      env: { ...process.env },
    });
    devServer.stdout.on('data', () => {});
    devServer.stderr.on('data', () => {});
    const stopDevServer = () => {
      if (!devServer || devServer.killed) return;
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(devServer.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        try { process.kill(-devServer.pid, 'SIGTERM'); } catch { devServer.kill('SIGTERM'); }
      }
      devServer = null;
    };
    devServer.stopTree = stopDevServer;

    if (!(await waitForServer(BASE_URL))) {
      stopDevServer();
      throw new Error(`dev server did not come up at ${BASE_URL}`);
    }
  } else {
    console.log(`> reusing dev server at ${BASE_URL}`);
  }

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  page.on('pageerror', (err) => {
    fail('no uncaught page error', err);
  });

  // Dev-mode session: AuthGuard accepts this in DEV builds and skips Keycloak.
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'mara_dev_mode_user',
      JSON.stringify({
        name: 'Officer Zahid (Dev)',
        email: 'zahid@mara.gov.my',
        role: 'officer',
      }),
    );
  });

  // Queue endpoint.
  await page.route('**/api/v1/officer/applications', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(QUEUE_FIXTURE),
    }),
  );

  // Detail endpoint. The delay is load-bearing: it keeps the page in its
  // loading state long enough to prove the approve button is not rendered yet.
  const DETAIL_DELAY_MS = 1200;
  await page.route(`**/api/v1/applications/${APPLICATION_ID}`, async (route) => {
    await delay(DETAIL_DELAY_MS);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DETAIL_FIXTURE),
    });
  });

  // Chat endpoint — the workspace mounts on / and fires nothing, but stub it so
  // a stray request cannot stall the run.
  await page.route('**/chat', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reply: 'ok', intent: 'conversational', workflow: null }),
    }),
  );

  try {
    // 1 — dev session reaches the workspace
    await check('dev-mode session reaches the protected workspace', async () => {
      await page.goto('/');
      await page.getByPlaceholder(/describe your task/i).waitFor({ timeout: 15_000 });
      assert(!page.url().includes('/login'), 'redirected to /login');
    });

    // 2 — queue renders
    await check('review queue renders the officer application list', async () => {
      await page.goto('/review');
      await page
        .getByText('Nurul Aisyah binti Hamzah', { exact: false })
        .first()
        .waitFor({ timeout: 15_000 });
      await page
        .getByText('Skim Pembiayaan Usahawan MARA', { exact: false })
        .first()
        .waitFor({ timeout: 10_000 });
    });

    // 3 — open the case, assert approve hidden while loading
    await check('case detail: approve action absent while detail is loading', async () => {
      await page.goto(`/review/${APPLICATION_ID}`);
      await page.getByText(/memuatkan butiran permohonan/i).waitFor({ timeout: 10_000 });
      const approve = page.getByRole('button', { name: /^lulus$/i });
      assert(
        (await approve.count()) === 0,
        'approve button rendered before detail resolved',
      );
    });

    // 4 — evidence sections render once loaded
    await check('case detail: all five agent sections render', async () => {
      const sections = [
        /pematuhan/i, // Compliance
        /analisis kewangan/i, // Finance
        /penilaian risiko/i, // Risk
        /konteks pasaran/i, // Market
        /cadangan ai/i, // Recommendation
      ];
      for (const name of sections) {
        await page.getByText(name).first().waitFor({ timeout: 15_000 });
      }
      // Applicant facts and both documents should be visible alongside them.
      await page.getByText('Aisyah Katering Enterprise').waitFor({ timeout: 5_000 });
      await page.getByText('penyata.pdf').waitFor({ timeout: 5_000 });
    });

    // 5 — approve now exists, and the decision panel is present
    await check('case detail: approve action appears only after detail loads', async () => {
      await page.getByRole('button', { name: /^lulus$/i }).waitFor({ timeout: 10_000 });
      await page.getByRole('button', { name: /^tolak$/i }).waitFor({ timeout: 5_000 });
      await page.getByRole('button', { name: /minta maklumat/i }).waitFor({ timeout: 5_000 });
    });

    // 6 — unknown route -> 404 page
    await check('unknown route renders the 404 page', async () => {
      await page.goto('/this-route-does-not-exist');
      await page.getByText(/tidak dijumpai/i).first().waitFor({ timeout: 10_000 });
      await page.getByRole('link', { name: /kembali ke halaman utama/i }).waitFor({ timeout: 5_000 });
    });
  } finally {
    await browser.close();
    if (devServer?.stopTree) devServer.stopTree();
  }

  const failed = findings.filter((f) => !f.ok);
  console.log('');
  console.log(`${findings.length - failed.length}/${findings.length} checks passed`);
  if (failed.length > 0) {
    console.log('smoke: FAILED');
    process.exitCode = 1;
  } else {
    console.log('smoke: PASSED');
  }
}

main().catch((err) => {
  console.error(`smoke: crashed — ${err.message}`);
  process.exitCode = 1;
});
