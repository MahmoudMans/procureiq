#!/usr/bin/env node
/**
 * ProcureIQ demo seed: a supplier portal login and two issued purchase orders to click through.
 *
 * Runs against a LOCAL backend only. Everything it creates is labelled "DEMO".
 *
 *   node scripts/seed-supplier-po-demo.mjs            create the demo data
 *   node scripts/seed-supplier-po-demo.mjs --revoke   revoke the demo supplier login again
 *
 * Optional environment variables:
 *   API_BASE_URL          default http://localhost:8080/api/v1 (must point at localhost)
 *   FRONTEND_URL          default http://localhost:3000 (only used to print links)
 *   SMOKE_STAFF_PASSWORD  default is the demo password
 */
import { readFileSync, writeFileSync } from 'node:fs';

const API = (process.env.API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '');
const FRONTEND = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const STAFF_PASSWORD = process.env.SMOKE_STAFF_PASSWORD ?? 'ProcureIQ!Demo2026';
const PORTAL_PASSWORD = 'Demo-Portal-2026!x';
const STATE = '/tmp/procureiq_demo_seed.json';
const STAMP = Date.now();
const TAG = `DEMO ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

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
  console.log(`✖ Refusing to run: API_BASE_URL (${API}) is not a localhost address.`);
  process.exit(2);
}

if (typeof fetch !== 'function') {
  console.log('✖ This Node version has no built-in fetch. Use Node 18 or newer.');
  process.exit(2);
}

/* ------------------------------------------------------------------ */
/* HTTP and reporting                                                  */
/* ------------------------------------------------------------------ */

class Abort extends Error {}

async function step(name, fn) {
  try {
    const value = await fn();

    console.log(`  ✔ ${name}`);

    return value;
  } catch (error) {
    console.log(`  ✖ ${name} — ${error instanceof Error ? error.message : String(error)}`);

    throw new Abort(name);
  }
}

function heading(title) {
  console.log(`\n── ${title} ──`);
}

async function http(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;

  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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

function problem(response) {
  return String(
    response.json?.detail ?? response.json?.title ?? response.json?.message ?? response.text ?? '',
  ).slice(0, 300);
}

async function call(method, path, options) {
  const response = await http(method, path, options);

  if (!response.ok) {
    throw new Error(`${method} ${path} → HTTP ${response.status}: ${problem(response)}`);
  }

  return response.json;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const pad = (n) => String(n).padStart(2, '0');

function inDays(days) {
  const date = new Date();

  date.setDate(date.getDate() + days);

  return date;
}

const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isoLocalDateTime = (d) => `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

function tokenFrom(auth) {
  for (const key of ['accessToken', 'token', 'sessionToken', 'sessionId', 'bearerToken']) {
    if (typeof auth?.[key] === 'string') {
      return auth[key];
    }
  }

  const key = Object.keys(auth ?? {}).find((k) => /token/i.test(k) && typeof auth[k] === 'string');

  if (key) {
    return auth[key];
  }

  throw new Error(
    `the portal login response has no token field (fields: ${Object.keys(auth ?? {}).join(', ')})`,
  );
}

async function staffLogin(email) {
  const response = await call('POST', '/auth/login', {
    body: { email, password: STAFF_PASSWORD },
  });

  if (!response?.accessToken) {
    throw new Error(`login for ${email} returned no accessToken`);
  }

  return { email, token: response.accessToken };
}

async function revokeAccount(token, id) {
  const response = await http('POST', `/supplier-portal-admin/accounts/${id}/revoke`, { token });

  console.log(
    `  ${response.ok ? '✔' : '✖'} Revoke portal account ${String(id).slice(0, 8)}…${
      response.ok ? '' : ` — HTTP ${response.status}: ${problem(response)}`
    }`,
  );
}

/* ------------------------------------------------------------------ */
/* Revoke mode                                                         */
/* ------------------------------------------------------------------ */

if (process.argv.includes('--revoke')) {
  let state = null;

  try {
    state = JSON.parse(readFileSync(STATE, 'utf8'));
  } catch {
    console.log(`Nothing to revoke: ${STATE} does not exist.`);
    process.exit(0);
  }

  const manager = await staffLogin('manager@procureiq.local');

  for (const id of state.accountIds ?? []) {
    await revokeAccount(manager.token, id);
  }

  process.exit(0);
}

/* ------------------------------------------------------------------ */
/* Scenarios                                                           */
/* ------------------------------------------------------------------ */

const SCENARIOS = [
  {
    title: 'Office paper and markers',
    expected: 'PENDING',
    items: [
      { itemName: 'A4 copy paper, box of 5 reams', quantity: 40, estimatedUnitPrice: 18 },
      { itemName: 'Whiteboard markers, pack of 12', quantity: 25, estimatedUnitPrice: 6 },
    ],
    prices: { a: [17, 5.5], b: [18.5, 6] },
    rejection: null,
  },
  {
    title: 'Ergonomic chairs and footrests',
    expected: 'REJECTED',
    items: [
      { itemName: 'Ergonomic office chair', quantity: 6, estimatedUnitPrice: 95 },
      { itemName: 'Adjustable footrest', quantity: 6, estimatedUnitPrice: 20 },
    ],
    prices: { a: [92, 19], b: [97, 21] },
    rejection:
      'The delivery date is too early for this quantity. Please move it back by one week and issue the order again.',
  },
];

let buyer;
let manager;
let admin;
let template;
const ctx = { A: null, B: null };

async function loadTemplate() {
  const response = await http('GET', '/purchase-requests', { token: buyer.token });
  const rows = Array.isArray(response.json) ? response.json : [];
  const withCost = rows.find((row) => row.costCenter);
  const category = rows.flatMap((row) => row.items ?? []).find((item) => item.category)?.category;

  return {
    costCenter: withCost?.costCenter ?? 'DEMO',
    currency: withCost?.currency ?? 'EUR',
    category: category ?? 'Office Supplies',
  };
}

async function createApprovedRequest(label, items) {
  const request = await call('POST', '/purchase-requests', {
    token: buyer.token,
    body: {
      title: `${TAG} ${label}`,
      description: 'Created by the demo seed script.',
      businessJustification: 'Demo data for trying out the purchase order screens.',
      costCenter: template.costCenter,
      currency: template.currency,
      desiredDeliveryDate: isoDate(inDays(30)),
      items: items.map((item) => ({
        itemName: item.itemName,
        description: 'Demo line',
        category: template.category,
        quantity: item.quantity,
        unit: 'pcs',
        estimatedUnitPrice: item.estimatedUnitPrice,
      })),
    },
  });

  const id = request?.id;

  if (!id) {
    throw new Error(
      `the purchase request response has no id (fields: ${Object.keys(request ?? {}).join(', ')})`,
    );
  }

  const submitted = await call('POST', `/purchase-requests/${id}/submit`, { token: buyer.token });
  let status = submitted?.status;

  for (let round = 0; round < 6 && status !== 'APPROVED'; round += 1) {
    if (['REJECTED', 'CANCELLED'].includes(status)) {
      throw new Error(`the purchase request ended as ${status}`);
    }

    const tasks = await call('GET', `/approvals/by-request/${id}`, { token: admin.token });
    const pending = (tasks ?? []).filter((task) => task.status === 'PENDING');

    if (pending.length === 0) {
      throw new Error(`the request is ${status} but no approval task is pending`);
    }

    for (const task of pending) {
      const approval = { body: { comment: 'Approved by the demo seed script.' } };
      let response = await http('POST', `/approvals/${task.id}/approve`, {
        token: admin.token,
        ...approval,
      });

      if (!response.ok) {
        response = await http('POST', `/approvals/${task.id}/approve`, {
          token: manager.token,
          ...approval,
        });
      }

      if (!response.ok) {
        throw new Error(
          `could not approve task ${task.id}: HTTP ${response.status}: ${problem(response)}`,
        );
      }
    }

    status = (await call('GET', `/purchase-requests/${id}`, { token: buyer.token })).status;
  }

  if (status !== 'APPROVED') {
    throw new Error(`the purchase request is still ${status} after the approval rounds`);
  }

  return { id, number: request.requestNumber };
}

async function createPublishedRfq(label, items, supplierIds) {
  const request = await createApprovedRequest(label, items);

  const rfq = await call('POST', '/rfqs', {
    token: buyer.token,
    body: {
      purchaseRequestId: request.id,
      title: `${TAG} ${label}`,
      description: 'Created by the demo seed script.',
      responseDeadline: isoLocalDateTime(inDays(2)),
      supplierIds,
    },
  });

  return call('POST', `/rfqs/${rfq.id}/publish`, { token: buyer.token });
}

async function setUpPortalAccount(letter, supplier, name) {
  const email = `${letter === 'a' ? 'demo-supplier' : 'demo-rival'}-${STAMP}@demo.test`;

  const invitation = await call('POST', '/supplier-portal-admin/invitations', {
    token: manager.token,
    body: {
      supplierId: supplier.id,
      email,
      displayName: `Demo ${letter.toUpperCase()} (${name})`.slice(0, 220),
    },
  });

  await call('POST', '/supplier-portal/activate', {
    body: { invitationToken: invitation.invitationToken, password: PORTAL_PASSWORD },
  });

  const auth = await call('POST', '/supplier-portal/login', {
    body: { email, password: PORTAL_PASSWORD },
  });

  return {
    letter,
    supplierId: supplier.id,
    name,
    email,
    accountId: invitation?.account?.id ?? null,
    token: tokenFrom(auth),
  };
}

function quotePayload(rfq, prices, leadTimeDays) {
  return {
    leadTimeDays,
    paymentTerms: '30 days net',
    validityDate: isoDate(inDays(30)),
    discountAmount: 0,
    shippingAmount: 0,
    taxAmount: 0,
    lines: rfq.lineItems.map((line, index) => ({
      rfqLineItemId: line.id,
      unitPrice: prices[index] ?? prices[prices.length - 1],
    })),
  };
}

async function submitQuotation(portal, rfq, prices, leadTimeDays) {
  const path = `/supplier-portal/rfqs/${rfq.id}/quotation`;
  const body = quotePayload(rfq, prices, leadTimeDays);

  let saved = await http('PUT', path, { token: portal.token, body });

  if (saved.status === 405) {
    saved = await http('POST', path, { token: portal.token, body });
  }

  if (!saved.ok) {
    throw new Error(`could not save the quotation: HTTP ${saved.status}: ${problem(saved)}`);
  }

  const submitted = await call('POST', `${path}/submit`, { token: portal.token });
  const id = submitted?.quotation?.id;

  if (!id) {
    throw new Error(
      `the submit response has no quotation id (fields: ${Object.keys(submitted ?? {}).join(', ')})`,
    );
  }

  return id;
}

async function seedOrder(scenario, suppliers) {
  const label = scenario.title;

  heading(label);

  const rfq = await step('Create, approve and publish the RFQ for both suppliers', async () =>
    createPublishedRfq(
      label,
      scenario.items,
      suppliers.map((supplier) => supplier.id),
    ),
  );

  if (ctx.A === null) {
    const nameOf = (supplier) =>
      rfq.invitations?.find((invitation) => invitation.supplierId === supplier.id)?.supplierName ??
      supplier.legalName ??
      supplier.id;

    await step('Invite, activate and sign in a portal login for each supplier', async () => {
      ctx.A = await setUpPortalAccount('a', suppliers[0], nameOf(suppliers[0]));
      ctx.B = await setUpPortalAccount('b', suppliers[1], nameOf(suppliers[1]));
    });
  }

  const quotationIds = {};

  for (const portal of [ctx.A, ctx.B]) {
    quotationIds[portal.letter] = await step(
      `Supplier ${portal.letter.toUpperCase()} submits a quotation`,
      async () =>
        submitQuotation(
          portal,
          rfq,
          scenario.prices[portal.letter],
          portal.letter === 'a' ? 10 : 14,
        ),
    );
  }

  await step('Buyer closes the RFQ and evaluates the quotations', async () => {
    const closed = await call('POST', `/rfqs/${rfq.id}/close`, { token: buyer.token });

    if (closed.status !== 'CLOSED') {
      throw new Error(`RFQ is ${closed.status}, expected CLOSED`);
    }

    await call('PUT', `/rfqs/${rfq.id}/evaluation`, {
      token: buyer.token,
      body: {
        priceWeight: 40,
        deliveryWeight: 20,
        supplierRatingWeight: 15,
        riskWeight: 15,
        qualityWeight: 10,
        qualityScores: [
          { quotationId: quotationIds.a, qualityScore: 80 },
          { quotationId: quotationIds.b, qualityScore: 75 },
        ],
      },
    });
  });

  await step('Manager awards the RFQ to the demo supplier', async () => {
    await call('POST', `/rfqs/${rfq.id}/award`, {
      token: manager.token,
      body: { selectedQuotationId: quotationIds.a, rationale: 'Selected by the demo seed script.' },
    });
  });

  const issued = await step('Buyer creates and issues the purchase order', async () => {
    const draft = await call('POST', '/purchase-orders', {
      token: buyer.token,
      body: {
        rfqId: rfq.id,
        expectedDeliveryDate: isoDate(inDays(14)),
        deliveryAddress: 'Demo Warehouse, 12 Example Street',
        buyerNotes: 'Internal note: demo order. The supplier must not see this.',
      },
    });

    return call('POST', `/purchase-orders/${draft.id}/issue`, { token: buyer.token });
  });

  if (scenario.rejection) {
    await step('The supplier rejects the order with a reason', async () => {
      const rejected = await call('POST', `/supplier-portal/purchase-orders/${issued.id}/reject`, {
        token: ctx.A.token,
        body: { note: scenario.rejection },
      });

      if (rejected.supplierResponse !== 'REJECTED') {
        throw new Error(`the order shows ${rejected.supplierResponse}, expected REJECTED`);
      }
    });
  }

  await step('The buyer sees the expected response on the order', async () => {
    const seen = await call('GET', `/purchase-orders/${issued.id}`, { token: buyer.token });

    if (seen.status !== 'ISSUED' || seen.supplierResponse !== scenario.expected) {
      throw new Error(`the order is ${seen.status} / ${seen.supplierResponse}`);
    }
  });

  return { id: issued.id, poNumber: issued.poNumber, title: label, expected: scenario.expected };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  heading('Setup');

  await step('Sign in as buyer, manager and admin', async () => {
    buyer = await staffLogin('buyer@procureiq.local');
    manager = await staffLogin('manager@procureiq.local');
    admin = await staffLogin('admin@procureiq.local');
  });

  const suppliers = await step('Pick two active suppliers', async () => {
    const list = await call('GET', '/suppliers?status=ACTIVE', { token: buyer.token });
    const active = (list ?? []).filter((supplier) => !supplier.status || supplier.status === 'ACTIVE');

    if (active.length < 2) {
      throw new Error(`need at least 2 active suppliers, found ${active.length}`);
    }

    template = await loadTemplate();

    return [active[0], active[1]];
  });

  const orders = [];

  for (const scenario of SCENARIOS) {
    orders.push(await seedOrder(scenario, suppliers));
  }

  heading('Check');

  await step('The demo supplier sees both orders in its portal', async () => {
    const list = await call('GET', '/supplier-portal/purchase-orders', { token: ctx.A.token });
    const rows = Array.isArray(list) ? list : [];

    for (const order of orders) {
      const row = rows.find((entry) => entry.id === order.id);

      if (!row) {
        throw new Error(`${order.poNumber} is not in the supplier's list`);
      }

      if (row.supplierResponse !== order.expected) {
        throw new Error(`${order.poNumber} shows ${row.supplierResponse}, expected ${order.expected}`);
      }
    }
  });

  writeFileSync(
    STATE,
    JSON.stringify({ accountIds: [ctx.A.accountId].filter(Boolean), email: ctx.A.email, orders }, null, 2),
  );

  console.log('\n════════════════ READY TO CLICK THROUGH ════════════════');
  console.log(`Supplier portal  ${FRONTEND}/supplier-portal/login`);
  console.log(`  email          ${ctx.A.email}`);
  console.log(`  password       ${PORTAL_PASSWORD}`);
  console.log(`  supplier       ${ctx.A.name}`);
  console.log(`Buyer app        ${FRONTEND}  (buyer@procureiq.local / ${STAFF_PASSWORD})`);
  console.log('');

  for (const order of orders) {
    console.log(
      `${order.poNumber}  ${order.expected === 'PENDING' ? 'waiting for the supplier to answer' : 'rejected by the supplier, ready to reopen'}`,
    );
    console.log(`  ${order.title}`);
    console.log(`  buyer page: ${FRONTEND}/purchase-orders/${order.id}`);
  }

  console.log('\nTo revoke the demo supplier login later: node scripts/seed-supplier-po-demo.mjs --revoke');
}

let success = false;

try {
  await main();
  success = true;
} catch (error) {
  if (error instanceof Abort) {
    console.log(`\n■ Stopped at "${error.message}" because the steps after it depend on it.`);
  } else {
    console.log(`\n■ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  }
} finally {
  if (manager?.token) {
    const toRevoke = [ctx.B?.accountId, success ? null : ctx.A?.accountId].filter(Boolean);

    if (toRevoke.length > 0) {
      heading('Cleanup');

      for (const id of toRevoke) {
        try {
          await revokeAccount(manager.token, id);
        } catch (error) {
          console.log(`  ✖ Revoke failed — ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  process.exitCode = success ? 0 : 1;
}
