#!/usr/bin/env node
/**
 * ProcureIQ smoke test: policy compliance evaluation and the anomaly scan.
 *
 * Runs against a LOCAL backend only. Creates five policies labelled "SMOKE" with thresholds far
 * above any demo amount, so evaluation flags nothing, then deactivates them again (policies
 * cannot be deleted). The anomaly scan reads real data and creates findings only if the demo
 * data really contains anomalies.
 *
 *   node scripts/smoke-compliance-anomaly.mjs
 *
 * Optional environment variables: API_BASE_URL, SMOKE_STAFF_PASSWORD
 */
import { appendFileSync, writeFileSync } from 'node:fs';

const API = (process.env.API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '');
const STAFF_PASSWORD = process.env.SMOKE_STAFF_PASSWORD ?? 'ProcureIQ!Demo2026';
const REPORT = '/tmp/procureiq_compliance_anomaly_report.txt';
const STAMP = Date.now();
const TAG = `SMOKE ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
const STARTED = Date.now();
const THRESHOLD = 1_000_000_000;
const DESCRIPTION = 'Created by the compliance and anomaly smoke test. Safe to leave deactivated.';

writeFileSync(REPORT, '');

function log(line = '') {
  console.log(line);
  appendFileSync(REPORT, `${line}\n`);
}

/* ------------------------------------------------------------------ */
/* Safety                                                              */
/* ------------------------------------------------------------------ */

let hostname = '';

try {
  hostname = new URL(API).hostname;
} catch {
  hostname = '';
}

if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) {
  log(`✖ Refusing to run: API_BASE_URL (${API}) is not a localhost address.`);
  process.exit(2);
}

if (typeof fetch !== 'function') {
  log('✖ This Node version has no built-in fetch. Use Node 18 or newer.');
  process.exit(2);
}

/* ------------------------------------------------------------------ */
/* Reporting                                                           */
/* ------------------------------------------------------------------ */

const results = [];
const notExercised = [
  'Violation creation, waivers, evidence and resolution (the demo data produces no violations, and this script does not flag real records)',
];

function record(name, ok, why) {
  results.push({ name, ok, why });
  log(`  ${ok ? '✔' : '✖'} ${name}${!ok && why ? ` — ${why}` : ''}`);

  return ok;
}

function check(name, ok, why) {
  return record(name, Boolean(ok), why);
}

function heading(title) {
  log(`\n── ${title} ──`);
}

class Abort extends Error {}

/** A step later steps depend on: if it fails, the section stops. */
async function step(name, fn) {
  try {
    const value = await fn();

    record(name, true);

    return value;
  } catch (error) {
    record(name, false, error instanceof Error ? error.message : String(error));

    throw new Abort(name);
  }
}

async function section(fn) {
  try {
    await fn();
  } catch (error) {
    if (!(error instanceof Abort)) throw error;
  }
}

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

async function http(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;

  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    throw new Error(
      `cannot reach ${API} (${error?.cause?.code ?? error?.message}). Is the backend running?`,
    );
  }

  const text = await response.text();
  let json = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { status: response.status, ok: response.ok, json, text };
}

function problem(r) {
  return String(r.json?.detail ?? r.json?.title ?? r.json?.message ?? r.text ?? '')
    .replace(/\s+/g, ' ')
    .slice(0, 220);
}

const why = (r) => (r.ok ? '' : `HTTP ${r.status}: ${problem(r)}`);

async function call(method, path, options) {
  const r = await http(method, path, options);

  if (!r.ok) throw new Error(`${method} ${path} → HTTP ${r.status}: ${problem(r)}`);

  return r.json;
}

async function staffLogin(email) {
  let last = null;

  for (const body of [
    { email, password: STAFF_PASSWORD },
    { username: email, password: STAFF_PASSWORD },
  ]) {
    const r = await http('POST', '/auth/login', { body });
    const token =
      r.json?.accessToken ?? r.json?.token ?? r.json?.access_token ?? r.json?.jwt ?? r.json?.tokens?.accessToken;

    if (r.ok && token) return token;

    last = r;
  }

  throw new Error(`Sign-in failed for ${email}: HTTP ${last.status} ${problem(last)}`);
}

const numeric = (o, keys) => keys.every((k) => Number.isFinite(Number(o?.[k])));
const tokens = {};
const created = [];

/* ------------------------------------------------------------------ */
/* Policy compliance                                                   */
/* ------------------------------------------------------------------ */

const SPECS = [
  { key: 'COMP-NOCUR', label: 'competitive sourcing, no currency', type: 'COMPETITIVE_SOURCING_THRESHOLD', threshold: THRESHOLD },
  { key: 'PO-NOCUR', label: 'purchase order required, no currency', type: 'PURCHASE_ORDER_REQUIRED_THRESHOLD', threshold: THRESHOLD },
  { key: 'CONTRACT-NOCUR', label: 'contract required, no currency', type: 'CONTRACT_REQUIRED_THRESHOLD', threshold: THRESHOLD },
  { key: 'RISK-NOCUR', label: 'high-risk supplier, no currency', type: 'HIGH_RISK_SUPPLIER_RESTRICTION' },
  { key: 'COMP-EUR', label: 'competitive sourcing, EUR', type: 'COMPETITIVE_SOURCING_THRESHOLD', threshold: THRESHOLD, currency: 'EUR' },
];

async function compliance() {
  heading('Policy compliance');

  const before = await http('GET', '/compliance/policies', { token: tokens.buyer });
  const active =
    before.ok && Array.isArray(before.json) ? before.json.filter((p) => p.status === 'ACTIVE').length : 0;

  if (active > 0) {
    log(`  ℹ ${active} other active polic${active === 1 ? 'y' : 'ies'} already exist; the evaluation runs them too`);
  }

  for (const spec of SPECS) {
    const body = {
      policyCode: `SMOKE-${spec.key}-${STAMP}`,
      name: `${TAG} ${spec.label}`,
      description: DESCRIPTION,
      policyType: spec.type,
      severity: 'LOW',
      requiresWaiver: false,
    };

    if (spec.threshold !== undefined) body.thresholdAmount = spec.threshold;
    if (spec.currency) body.currency = spec.currency;

    const policy = await step(`Create policy: ${spec.label}`, async () =>
      call('POST', '/compliance/policies', { token: tokens.admin, body }),
    );

    created.push({ id: policy.id, code: body.policyCode, status: policy.status, spec });

    check(
      `Currency kept as ${spec.currency ?? 'none'}: ${spec.label}`,
      spec.currency ? policy.currency === spec.currency : !policy.currency,
      `currency is ${policy.currency}`,
    );
  }

  for (const entry of created) {
    if (entry.status === 'ACTIVE') {
      record(`Activate policy: ${entry.spec.label}`, true);
      continue;
    }

    const r = await http('POST', `/compliance/policies/${entry.id}/activate`, { token: tokens.admin });

    check(
      `Activate policy: ${entry.spec.label}`,
      r.ok && r.json?.status === 'ACTIVE',
      r.ok ? `status is ${r.json?.status}` : why(r),
    );
  }

  const policies = await http('GET', '/compliance/policies', { token: tokens.buyer });

  check(
    'Policy list loads with the new policies',
    policies.ok && Array.isArray(policies.json) && created.every((c) => policies.json.some((p) => p.id === c.id)),
    why(policies) || 'a new policy is missing from the list',
  );

  const first = await http('POST', '/compliance/evaluate', { token: tokens.manager });

  check('Evaluation succeeds with null and EUR currency filters', first.ok, why(first));

  if (first.ok) {
    check(
      'Evaluation counts are numbers',
      numeric(first.json, ['policiesEvaluated', 'candidatesEvaluated', 'createdViolations', 'refreshedViolations']),
      JSON.stringify(first.json),
    );

    check(
      'Evaluation ran every new policy',
      Number(first.json?.policiesEvaluated) >= created.length,
      `evaluated ${first.json?.policiesEvaluated}, expected at least ${created.length}`,
    );

    const second = await http('POST', '/compliance/evaluate', { token: tokens.manager });

    check(
      'A second evaluation creates no new violations',
      second.ok && Number(second.json?.createdViolations) === 0,
      second.ok ? `created ${second.json?.createdViolations}` : why(second),
    );
  }

  const list = await http('GET', '/compliance/violations', { token: tokens.buyer });

  check('Violation list loads', list.ok && Array.isArray(list.json), why(list));

  if (list.ok && Array.isArray(list.json)) {
    const mine = list.json.filter((v) => created.some((c) => c.id === v.policyId));
    const thresholdOnes = mine.filter(
      (v) => created.find((c) => c.id === v.policyId)?.spec.threshold !== undefined,
    );

    check(
      'The high-threshold policies flag nothing',
      thresholdOnes.length === 0,
      `${thresholdOnes.length} violations were created`,
    );

    log(`  ℹ The high-risk-supplier policy flagged ${mine.length - thresholdOnes.length} purchase orders`);

    for (const v of mine.slice(0, 3)) {
      const detail = await http('GET', `/compliance/violations/${v.id}`, { token: tokens.buyer });

      check(
        `Violation detail opens (${v.sourceReference ?? v.id})`,
        detail.ok && detail.json?.violation?.id === v.id,
        why(detail) || 'the detail does not match the list row',
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* Anomaly scan                                                        */
/* ------------------------------------------------------------------ */

async function anomaly() {
  heading('Anomaly scan');

  const dash = await http('GET', '/anomaly-control?currency=EUR', { token: tokens.buyer });
  const rules = Array.isArray(dash.json?.rules) ? dash.json.rules : [];

  check('Anomaly dashboard loads', dash.ok, why(dash));
  check('The dashboard lists the detection rules', rules.length > 0, `found ${rules.length}`);

  const scan1 = await http('POST', '/anomaly-control/scan?currency=EUR', { token: tokens.manager });

  check('Scan runs every enabled rule (HTTP 200)', scan1.ok, why(scan1));

  if (scan1.ok) {
    check(
      'Scan counts are numbers',
      numeric(scan1.json, ['candidatesDetected', 'createdFindings', 'refreshedFindings', 'autoResolvedFindings']),
      JSON.stringify(scan1.json),
    );

    log(`  ℹ ${scan1.json?.candidatesDetected} candidates detected, ${scan1.json?.createdFindings} findings created`);

    const scan2 = await http('POST', '/anomaly-control/scan?currency=EUR', { token: tokens.manager });

    check(
      'A second scan creates no new findings',
      scan2.ok && Number(scan2.json?.createdFindings) === 0,
      scan2.ok ? `created ${scan2.json?.createdFindings}` : why(scan2),
    );
  }

  const after = await http('GET', '/anomaly-control?currency=EUR', { token: tokens.buyer });
  const findings = Array.isArray(after.json?.findings) ? after.json.findings : [];

  check('Dashboard loads after the scan', after.ok && Array.isArray(after.json?.findings), why(after));

  for (const f of findings.slice(0, 3)) {
    const detail = await http('GET', `/anomaly-control/findings/${f.id}`, { token: tokens.buyer });

    check(`Finding detail opens (${f.id})`, detail.ok, why(detail));
  }

  if (findings.length === 0) {
    notExercised.push('Anomaly finding detail (the scan found no anomalies in the current demo data)');
  }
}

/* ------------------------------------------------------------------ */
/* Cleanup and run                                                     */
/* ------------------------------------------------------------------ */

async function cleanup() {
  if (!created.length || !tokens.admin) return;

  heading('Cleanup');

  for (const entry of created) {
    const r = await http('POST', `/compliance/policies/${entry.id}/deactivate`, { token: tokens.admin });

    check(
      `Deactivate policy: ${entry.spec.label}`,
      r.ok && r.json?.status !== 'ACTIVE',
      r.ok ? `status is still ${r.json?.status}` : why(r),
    );
  }
}

async function main() {
  log(`ProcureIQ compliance and anomaly smoke test — ${API}`);

  let fatal = null;

  try {
    heading('Preflight');

    await step('Backend reachable', async () => {
      const r = await http('GET', '/auth/me');

      if (r.status >= 500) throw new Error(`HTTP ${r.status}`);
    });

    heading('Setup');

    await step('Sign in as buyer, manager and admin', async () => {
      tokens.buyer = await staffLogin('buyer@procureiq.local');
      tokens.manager = await staffLogin('manager@procureiq.local');
      tokens.admin = await staffLogin('admin@procureiq.local');
    });

    await section(compliance);
    await section(anomaly);
  } catch (error) {
    if (!(error instanceof Abort)) fatal = error;
  } finally {
    try {
      await cleanup();
    } catch (error) {
      fatal = fatal ?? error;
    }
  }

  if (fatal) {
    log(`\n✖ ${fatal?.message ?? fatal}`);

    return 2;
  }

  const failed = results.filter((r) => !r.ok);
  const passed = results.length - failed.length;
  const seconds = Math.round((Date.now() - STARTED) / 1000);

  log('\n── Not exercised ──');

  for (const line of notExercised) log(`  – ${line}`);

  if (created.length) {
    log('\nRecords created (all labelled SMOKE, deactivated at the end; policies cannot be deleted):');

    for (const entry of created) log(`  • Policy ${entry.code}`);
  }

  if (failed.length) {
    log('\nFailed checks:');

    for (const r of failed) log(`  ✖ ${r.name}${r.why ? ` — ${r.why}` : ''}`);
  }

  log(`\n${failed.length === 0 ? '✔' : '✖'} ${passed} of ${results.length} checks passed in ${seconds}s`);

  return failed.length === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    log(`\n✖ ${error?.message ?? error}`);
    process.exit(2);
  });
