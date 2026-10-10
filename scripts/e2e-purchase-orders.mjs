#!/usr/bin/env node
/**
 * ProcureIQ browser test: the purchase order screens, as supplier and as buyer.
 *
 * Drives a real Chrome against a LOCAL backend and frontend:
 *   1. runs the demo seed (a supplier login, one waiting order, one rejected order)
 *   2. the supplier signs in, reads the orders, tries to reject without a reason, acknowledges
 *      one order, and later rejects a re-issued order with a reason
 *   3. the buyer checks the rejection flag, the filter and the response notices, and reopens
 *      the rejected order from the page
 *
 * Screenshots go to /tmp/procureiq_e2e. The demo login this test creates is revoked at the end,
 * and the previous demo seed state (used by the seed script's --revoke) is put back.
 *
 *   node scripts/e2e-purchase-orders.mjs
 *   E2E_HEADED=1 node scripts/e2e-purchase-orders.mjs     watch it run
 *
 * Playwright is not a dependency of the project. It is loaded from PLAYWRIGHT_DIR
 * (default ~/.cache/procureiq-e2e), where `npm install playwright` puts it. It drives the
 * installed Google Chrome, so no browser download is needed.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';

const API = (process.env.API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '');
const FRONTEND = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const STAFF_PASSWORD = process.env.SMOKE_STAFF_PASSWORD ?? 'ProcureIQ!Demo2026';
const PORTAL_PASSWORD = 'Demo-Portal-2026!x'; // the same password the seed script gives its login
const PW_DIR = process.env.PLAYWRIGHT_DIR ?? path.join(homedir(), '.cache', 'procureiq-e2e');
const HEADED = process.env.E2E_HEADED === '1';
const SEED_SCRIPT = path.join(import.meta.dirname, 'seed-supplier-po-demo.mjs');
const STATE = '/tmp/procureiq_demo_seed.json';
const STATE_BEFORE = '/tmp/procureiq_demo_seed.before-e2e.json';
const SHOTS = '/tmp/procureiq_e2e';
const STARTED = Date.now();
const DESKTOP = { width: 1366, height: 900 };
const PHONE = { width: 390, height: 844 };
const ACK_NOTE = 'Will ship on the expected date.';
const REASON = 'E2E: the quantities do not match the quotation.';

/* ------------------------------------------------------------------ */
/* Safety and set-up                                                   */
/* ------------------------------------------------------------------ */

function isLocal(url) {
  try {
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

if (!isLocal(API) || !isLocal(FRONTEND)) {
  console.log('✖ Refusing to run: API_BASE_URL and FRONTEND_URL must both be localhost addresses.');
  process.exit(2);
}

let chromium;

try {
  ({ chromium } = createRequire(path.join(PW_DIR, 'noop.js'))('playwright'));
} catch (error) {
  console.log(`✖ Playwright is not installed in ${PW_DIR} (${error?.code ?? error?.message}).`);
  console.log(
    `  Install it: mkdir -p "${PW_DIR}" && cd "${PW_DIR}" && npm init -y && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright`,
  );
  process.exit(2);
}

rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

/* ------------------------------------------------------------------ */
/* Reporting                                                           */
/* ------------------------------------------------------------------ */

const results = [];
const jsErrors = [];
const consoleErrors = new Set();
let shotNumber = 0;

function record(name, ok, why) {
  results.push({ name, ok, why });
  console.log(`  ${ok ? '✔' : '✖'} ${name}${!ok && why ? ` — ${why}` : ''}`);

  return ok;
}

function observe(name, ok, why) {
  console.log(`  ${ok ? '✔' : '⚠'} ${name}${!ok && why ? ` — ${why}` : ''}`);
}

function heading(title) {
  console.log(`\n── ${title} ──`);
}

class Abort extends Error {}

const slug = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

function shorten(error) {
  return String(error?.message ?? error)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' | ')
    .slice(0, 300);
}

async function shot(page, name) {
  try {
    shotNumber += 1;
    await page.screenshot({
      path: path.join(SHOTS, `${String(shotNumber).padStart(2, '0')}-${name}.png`),
      fullPage: true,
    });
  } catch {
    // A missing screenshot never fails the test.
  }
}

async function run(name, page, fn, fatal) {
  try {
    await fn();
    record(name, true);

    return true;
  } catch (error) {
    record(name, false, shorten(error));

    if (page) {
      await shot(page, `FAILED-${slug(name)}`);
    }

    if (fatal) {
      throw new Abort(name);
    }

    return false;
  }
}

const check = (name, page, fn) => run(name, page, fn, false);
const step = (name, page, fn) => run(name, page, fn, true);

function must(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const pageText = (page) => page.locator('body').innerText();
const see = (locator) => locator.first().waitFor({ state: 'visible' });
const button = (page, name, exact = false) => page.getByRole('button', { name, exact });
const portalOrder = (id) => `/supplier-portal/purchase-orders/${id}`;

async function open(page, url) {
  try {
    await page.goto(url);
  } catch (error) {
    if (!/interrupted|ERR_ABORTED/i.test(String(error?.message))) {
      throw error;
    }

    await page.waitForTimeout(1500);
    await page.goto(url);
  }
}

function watch(page, label) {
  page.on('pageerror', (error) => jsErrors.push(`${label}: ${shorten(error)}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.add(`${label}: ${message.text().slice(0, 140)}`);
    }
  });
}

async function api(method, route, { token, body } = {}) {
  const headers = { Accept: 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const raw = await response.text();
  let json = null;

  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  return { status: response.status, ok: response.ok, json, raw };
}

async function staffToken(email) {
  const response = await api('POST', '/auth/login', {
    body: { email, password: STAFF_PASSWORD },
  });

  must(response.ok && response.json?.accessToken, `login for ${email} failed: HTTP ${response.status}`);

  return response.json.accessToken;
}

/* ------------------------------------------------------------------ */
/* The seed, and putting things back                                   */
/* ------------------------------------------------------------------ */

let seeded = false;
let seededAccountIds = [];
let browser = null;

function seed() {
  if (existsSync(STATE)) {
    copyFileSync(STATE, STATE_BEFORE);
  } else {
    rmSync(STATE_BEFORE, { force: true });
  }

  try {
    execFileSync(process.execPath, [SEED_SCRIPT], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
    });
  } catch (error) {
    const lines = String(error.stdout ?? '')
      .split('\n')
      .filter((line) => /✖|■/.test(line))
      .slice(0, 6)
      .map((line) => line.trim());

    throw new Error(`the seed script failed: ${lines.join(' / ') || shorten(error)}`);
  }

  const state = JSON.parse(readFileSync(STATE, 'utf8'));

  seeded = true;
  seededAccountIds = state.accountIds ?? [];

  return state;
}

function restoreState() {
  if (existsSync(STATE_BEFORE)) {
    copyFileSync(STATE_BEFORE, STATE);
    rmSync(STATE_BEFORE, { force: true });
  } else if (seeded) {
    rmSync(STATE, { force: true });
  }
}

function cleanup() {
  if (!seeded) {
    restoreState();

    return;
  }

  heading('Cleanup');

  try {
    const out = execFileSync(process.execPath, [SEED_SCRIPT, '--revoke'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    });

    if (out.includes('✖')) {
      throw new Error(out.split('\n').find((line) => line.includes('✖'))?.trim() ?? 'revoke reported a problem');
    }

    console.log('  ✔ Revoked the demo supplier login this test created');
  } catch (error) {
    console.log(
      `  ✖ Could not revoke the demo supplier login (${shorten(error)}). Account id(s) still active: ${seededAccountIds.join(', ')}`,
    );
  }

  restoreState();
}

async function launchBrowser() {
  const options = { headless: !HEADED, slowMo: HEADED ? 200 : 0 };

  try {
    return await chromium.launch({ ...options, channel: 'chrome' });
  } catch (first) {
    try {
      return await chromium.launch(options);
    } catch (second) {
      throw new Error(
        `neither Google Chrome nor Playwright's Chromium could start (${shorten(first)} / ${shorten(second)})`,
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* The test                                                            */
/* ------------------------------------------------------------------ */

async function main() {
  heading('Setup');

  let state;
  let waiting;
  let rejected;
  let buyerToken;

  await step('The backend and the frontend both answer', null, async () => {
    const backend = await api('GET', '/supplier-portal/purchase-orders');

    must(backend.status === 400 || backend.status === 401, `the backend answered HTTP ${backend.status}`);

    let front;

    try {
      front = await fetch(`${FRONTEND}/supplier-portal/login`);
    } catch {
      throw new Error(`cannot reach ${FRONTEND}. Start it: cd frontend && npm run dev`);
    }

    must(front.ok, `the frontend answered HTTP ${front.status}`);
  });

  await step('Seed a demo supplier login with one waiting and one rejected order', null, async () => {
    state = seed();
    waiting = state.orders.find((order) => order.expected === 'PENDING');
    rejected = state.orders.find((order) => order.expected === 'REJECTED');
    must(waiting && rejected, 'the seed state has no waiting order and rejected order');
  });

  console.log(
    `  ℹ demo login ${state.email}; waiting order ${waiting.poNumber}; rejected order ${rejected.poNumber}`,
  );

  await step('Sign in to the API as the buyer (for set-up and verification)', null, async () => {
    buyerToken = await staffToken('buyer@procureiq.local');
  });

  await step('Start Chrome', null, async () => {
    browser = await launchBrowser();
  });

  /* ---------------- Supplier portal ---------------- */

  heading('Supplier portal');

  const supplierContext = await browser.newContext({ viewport: DESKTOP });

  supplierContext.setDefaultTimeout(10000);
  supplierContext.setDefaultNavigationTimeout(90000);

  const sp = await supplierContext.newPage();

  watch(sp, 'supplier portal');

  const section = (title) =>
    sp.locator('section').filter({ has: sp.getByRole('heading', { name: title }) });

  await step('Supplier signs in to the portal', sp, async () => {
    await open(sp, `${FRONTEND}/supplier-portal/login`);
    await sp.locator('input[type="email"]').fill(state.email);
    await sp.locator('input[type="password"]').fill(PORTAL_PASSWORD);
    await button(sp, 'Sign in').click();
    await sp.waitForURL('**/supplier-portal/home');
  });

  await check('Home lists the waiting order under "Awaiting your response"', sp, async () => {
    await see(sp.getByRole('heading', { name: 'Awaiting your response' }));
    await see(sp.locator(`a[href="${portalOrder(waiting.id)}"]`));
    await shot(sp, 'portal-home');
  });

  await check('The waiting orders are shown above the RFQ outcomes on the home page', sp, async () => {
    const orders = await sp.getByRole('heading', { name: 'Awaiting your response' }).first().boundingBox();
    const outcomes = await sp.getByRole('heading', { name: 'RFQ outcomes' }).first().boundingBox();

    must(orders !== null && outcomes !== null, 'one of the two panels is missing');
    must(orders.y < outcomes.y, 'the RFQ outcomes are still above the waiting orders');
  });

  const viaHeader = await check('The header link opens the purchase orders list', sp, async () => {
    await sp.getByRole('link', { name: 'Purchase orders', exact: true }).click();
    await sp.waitForURL('**/supplier-portal/purchase-orders');
    await see(sp.getByRole('heading', { name: 'Purchase orders', level: 1 }));
  });

  if (!viaHeader) {
    await step('Open the purchase orders list by its address instead', sp, async () => {
      await open(sp, `${FRONTEND}/supplier-portal/purchase-orders`);
      await see(sp.getByRole('heading', { name: 'Purchase orders', level: 1 }));
    });
  }

  await check('The waiting order sits under "Awaiting your response" and says so', sp, async () => {
    const card = section('Awaiting your response').locator(`a[href="${portalOrder(waiting.id)}"]`);

    await see(card);

    const t = await card.first().innerText();

    must(t.includes(waiting.poNumber), `the card shows "${t.replace(/\s+/g, ' ')}"`);
    must(/awaiting your response/i.test(t), 'the card does not say it is waiting for a response');
  });

  await check('The rejected order sits under "Other purchase orders" as "Rejected by you"', sp, async () => {
    const card = section('Other purchase orders').locator(`a[href="${portalOrder(rejected.id)}"]`);

    await see(card);

    const t = await card.first().innerText();

    must(
      t.includes(rejected.poNumber) && /rejected by you/i.test(t),
      `the card shows "${t.replace(/\s+/g, ' ')}"`,
    );

    await shot(sp, 'portal-list');
  });

  await step('Supplier opens the waiting order', sp, async () => {
    await sp.locator(`a[href="${portalOrder(waiting.id)}"]`).first().click();
    await sp.waitForURL(`**${portalOrder(waiting.id)}`);
    await see(sp.getByRole('heading', { name: `Purchase order ${waiting.poNumber}` }));
    await see(sp.getByRole('heading', { name: 'Order lines' }));
  });

  await check('The page shows the delivery address and every order line', sp, async () => {
    const t = await pageText(sp);

    must(t.includes('Demo Warehouse, 12 Example Street'), 'the delivery address is not shown');

    const rows = await sp.locator('.portal-po-table tbody tr').count();

    must(rows === 2, `${rows} order lines shown, expected 2`);
  });

  await check('The buyer’s internal note is not on the page', sp, async () => {
    const t = await pageText(sp);

    must(!/internal note|must not see this/i.test(t), 'the internal note is visible to the supplier');
  });

  await check('Rejecting without a reason shows an error and sends nothing', sp, async () => {
    await see(sp.getByRole('heading', { name: 'Acknowledge or reject this order' }));
    await shot(sp, 'portal-order-waiting');
    await button(sp, 'Reject order').click();
    await sp.locator('textarea').fill('   ');
    await button(sp, 'Send rejection').click();
    await see(sp.getByText('Tell the buyer why you are rejecting this purchase order.'));

    must(
      (await sp.getByText('You rejected this purchase order').count()) === 0,
      'the page says the order was rejected',
    );

    const order = await api('GET', `/purchase-orders/${waiting.id}`, { token: buyerToken });

    must(
      order.ok && order.json?.supplierResponse === 'PENDING',
      `the backend shows ${order.json?.supplierResponse}, expected PENDING`,
    );
  });

  await check('Back returns to the two answer buttons', sp, async () => {
    await button(sp, 'Back', true).click();
    await see(button(sp, 'Acknowledge order'));
    await see(button(sp, 'Reject order'));
  });

  await check('Supplier acknowledges the order with a note', sp, async () => {
    await button(sp, 'Acknowledge order').click();
    await sp.locator('textarea').fill(ACK_NOTE);
    await button(sp, 'Send acknowledgement').click();
    await see(sp.getByText('You acknowledged this purchase order'));

    const t = await pageText(sp);

    must(t.includes(ACK_NOTE), 'the supplier’s note is not shown after sending');

    await see(sp.locator('.portal-rfq-pill', { hasText: 'Acknowledged' }));

    must(
      (await button(sp, 'Acknowledge order').count()) === 0 &&
        (await button(sp, 'Reject order').count()) === 0,
      'the answer buttons are still shown',
    );

    await shot(sp, 'portal-order-acknowledged');
  });

  await check('The answer survives a page reload', sp, async () => {
    await sp.reload();
    await see(sp.getByText('You acknowledged this purchase order'));

    must((await button(sp, 'Reject order').count()) === 0, 'the answer buttons came back after a reload');
  });

  await check('The rejected order shows the rejection and no answer buttons', sp, async () => {
    await open(sp, `${FRONTEND}${portalOrder(rejected.id)}`);
    await see(sp.getByText('You rejected this purchase order'));

    const t = await pageText(sp);

    must(t.includes('The delivery date is too early'), 'the rejection reason is not shown');
    must(!/internal note|must not see this/i.test(t), 'the internal note is visible to the supplier');
    must((await button(sp, 'Acknowledge order').count()) === 0, 'an answer button is shown');

    await shot(sp, 'portal-order-rejected');
  });

  /* ---------------- Buyer app ---------------- */

  heading('Buyer app');

  const buyerContext = await browser.newContext({ viewport: DESKTOP });

  buyerContext.setDefaultTimeout(10000);
  buyerContext.setDefaultNavigationTimeout(90000);

  const bp = await buyerContext.newPage();

  watch(bp, 'buyer app');

  const rowOf = (order) => bp.locator('tr, [role="row"]').filter({ hasText: order.poNumber });
  const search = () => bp.getByPlaceholder('Search PO, supplier or RFQ');
  const deliveryHeading = () => bp.getByRole('heading', { name: 'Delivery tracking' });

  await step('Buyer signs in', bp, async () => {
    await open(bp, `${FRONTEND}/login`);

    const email = bp
      .locator('form input:not([type="password"]):not([type="checkbox"]):not([type="hidden"])')
      .first();
    const password = bp.locator('form input[type="password"]');

    await email.fill('buyer@procureiq.local');
    await password.fill(STAFF_PASSWORD);
    await password.press('Enter');
    await bp.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 90000 });
  });

  await check('The list flags the rejected order with a "Supplier rejected" badge', bp, async () => {
    await open(bp, `${FRONTEND}/purchase-orders`);
    await search().fill(rejected.poNumber);
    await see(rowOf(rejected));

    const t = await rowOf(rejected).first().innerText();

    must(/supplier rejected/i.test(t), `the row shows "${t.replace(/\s+/g, ' ')}"`);
    must(/issued/i.test(t), 'the row does not show the Issued status');

    await shot(bp, 'buyer-list-rejected');
  });

  await check('The "Rejected by supplier" filter keeps the rejected order', bp, async () => {
    await bp.getByText('Rejected by supplier', { exact: true }).click();
    await see(rowOf(rejected));
  });

  await check('The same filter hides an order the supplier acknowledged', bp, async () => {
    await search().fill(waiting.poNumber);
    await see(bp.getByText('No purchase orders match these filters'));
    await shot(bp, 'buyer-list-filter-empty');
  });

  await check('The rejected order page explains the rejection and offers a reopen, not a receipt', bp, async () => {
    await open(bp, `${FRONTEND}/purchase-orders/${rejected.id}`);
    await see(button(bp, 'Reopen for revision'));
    await see(deliveryHeading());
    await see(bp.getByText(/^Supplier response$/i));

    const t = await pageText(bp);

    must(/rejected this purchase order/i.test(t), 'the rejection warning is missing');
    must(t.includes('The delivery date is too early'), 'the supplier’s reason is missing');
    must((await button(bp, 'Record receipt').count()) === 0, 'the Record receipt button is shown');
    must(!t.includes('Record each delivery below'), 'the "Record each delivery" hint is shown');

    await shot(bp, 'buyer-order-rejected');
  });

  await check('The acknowledged order shows the supplier’s note and still offers Record receipt', bp, async () => {
    await open(bp, `${FRONTEND}/purchase-orders/${waiting.id}`);
    await see(deliveryHeading());
    await see(bp.getByText(/^Supplier response$/i));

    const t = await pageText(bp);

    must(/acknowledged this purchase order/i.test(t), 'the acknowledgement notice is missing');
    must(t.includes(ACK_NOTE), 'the supplier’s note is missing');

    await see(button(bp, 'Record receipt'));

    must(
      (await button(bp, 'Reopen for revision').count()) === 0,
      'Reopen is offered for an acknowledged order',
    );

    await shot(bp, 'buyer-order-acknowledged');
  });

  const reopened = await check('Buyer reopens the rejected order from the page', bp, async () => {
    await open(bp, `${FRONTEND}/purchase-orders/${rejected.id}`);
    await button(bp, 'Reopen for revision').click();
    await see(bp.getByText('Reopen this purchase order?'));
    await shot(bp, 'buyer-reopen-dialog');
    await button(bp, 'Reopen as draft').click();
    await see(button(bp, 'Save PO draft'));
    await see(button(bp, 'Issue purchase order'));

    must(
      (await bp.getByText(/rejected this purchase order/i).count()) === 0,
      'the rejection warning is still shown on the draft',
    );

    await shot(bp, 'buyer-order-reopened');
  });

  await check('The backend agrees: a draft, same PO number, no supplier response', null, async () => {
    const order = await api('GET', `/purchase-orders/${rejected.id}`, { token: buyerToken });

    must(
      order.ok &&
        order.json?.status === 'DRAFT' &&
        order.json?.supplierResponse === 'PENDING' &&
        order.json?.poNumber === rejected.poNumber,
      `${order.json?.status} / ${order.json?.supplierResponse} / ${order.json?.poNumber}`,
    );
  });

  /* ---------------- Round trip ---------------- */

  heading('Round trip after the reopen');

  let reissued = false;

  if (reopened) {
    reissued = await check('Buyer issues the revised order again (through the API)', null, async () => {
      const response = await api('POST', `/purchase-orders/${rejected.id}/issue`, { token: buyerToken });

      must(
        response.ok && response.json?.status === 'ISSUED' && response.json?.supplierResponse === 'PENDING',
        `HTTP ${response.status}: ${response.json?.status} / ${response.json?.supplierResponse}`,
      );
    });
  } else {
    console.log('  ℹ Skipped: the reopen did not work, so there is nothing to re-issue.');
  }

  if (reissued) {
    await check('Supplier sees the re-issued order waiting and rejects it from the page', sp, async () => {
      await open(sp, `${FRONTEND}${portalOrder(rejected.id)}`);
      await see(sp.getByRole('heading', { name: 'Acknowledge or reject this order' }));
      await button(sp, 'Reject order').click();
      await sp.locator('textarea').fill(REASON);
      await button(sp, 'Send rejection').click();
      await see(sp.getByText('You rejected this purchase order'));

      const t = await pageText(sp);

      must(t.includes(REASON), 'the reason the supplier typed is not shown');

      await see(sp.locator('.portal-rfq-pill', { hasText: 'Rejected by you' }));
    });

    await check('Buyer sees the new rejection with the new reason, and can reopen again', bp, async () => {
      await open(bp, `${FRONTEND}/purchase-orders/${rejected.id}`);
      await see(button(bp, 'Reopen for revision'));

      const t = await pageText(bp);

      must(t.includes(REASON), 'the new reason is not shown to the buyer');

      await shot(bp, 'buyer-order-rejected-again');
    });
  }

  /* ---------------- Phone width ---------------- */

  heading('Phone width (observations, not failures)');

  await sp.setViewportSize(PHONE);

  const phonePages = [
    [
      'portal purchase orders list',
      '/supplier-portal/purchase-orders',
      () => see(sp.getByRole('heading', { name: 'Purchase orders', level: 1 })),
    ],
    [
      'portal purchase order page',
      portalOrder(rejected.id),
      () => see(sp.getByRole('heading', { name: 'Order lines' })),
    ],
  ];

  for (const [label, route, ready] of phonePages) {
    try {
      await open(sp, `${FRONTEND}${route}`);
      await ready();
      await sp.waitForTimeout(500);

      const extra = await sp.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );

      observe(
        `The ${label} does not scroll sideways at 390px`,
        extra <= 1,
        `the page is ${extra}px wider than the screen`,
      );

      await shot(sp, `phone-${slug(label)}`);
    } catch (error) {
      observe(`The ${label} at 390px`, false, shorten(error));
    }
  }

  /* ---------------- Whole run ---------------- */

  heading('Whole run');

  await check('No uncaught JavaScript errors on any screen', null, async () => {
    must(jsErrors.length === 0, jsErrors.slice(0, 3).join(' || '));
  });

  if (consoleErrors.size > 0) {
    console.log('  ℹ Browser console errors seen (informational):');

    for (const message of [...consoleErrors].slice(0, 6)) {
      console.log(`      ${message}`);
    }
  }
}

function finish() {
  const failed = results.filter((result) => !result.ok);
  const seconds = Math.round((Date.now() - STARTED) / 1000);

  console.log('');
  console.log(
    `${failed.length === 0 ? '✔' : '✖'} ${results.length - failed.length} of ${results.length} checks passed in ${seconds}s`,
  );

  if (failed.length > 0) {
    console.log('Failed:');

    for (const result of failed) {
      console.log(`  • ${result.name}${result.why ? ` — ${result.why}` : ''}`);
    }
  }

  console.log(`Screenshots: ${SHOTS}`);

  process.exitCode = failed.length === 0 ? 0 : 1;
}

try {
  await main();
} catch (error) {
  if (error instanceof Abort) {
    console.log(`\n■ Stopped at "${error.message}" because the steps after it depend on it.`);
  } else {
    console.log(`\n■ Unexpected error: ${shorten(error)}`);
    results.push({ name: 'Unexpected error', ok: false, why: shorten(error) });
  }
} finally {
  await browser?.close().catch(() => undefined);
  cleanup();
  finish();
}
