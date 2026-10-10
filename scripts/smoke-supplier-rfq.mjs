#!/usr/bin/env node
/**
 * ProcureIQ end-to-end smoke test: the supplier RFQ flow.
 *
 * Runs against a LOCAL backend only and creates records in its database, all labelled
 * "SMOKE". Portal accounts it creates are revoked again at the end.
 *
 *   node scripts/smoke-supplier-rfq.mjs
 *
 * Optional environment variables:
 *   API_BASE_URL          default http://localhost:8080/api/v1 (must point at localhost)
 *   SMOKE_STAFF_PASSWORD  default is the demo password
 */
import { appendFileSync, writeFileSync } from 'node:fs';

const API = (process.env.API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '');
const STAFF_PASSWORD = process.env.SMOKE_STAFF_PASSWORD ?? 'ProcureIQ!Demo2026';
const PORTAL_PASSWORD = 'Smoke-Portal-2026!x';
const REPORT = '/tmp/procureiq_smoke_report.txt';
const STAMP = Date.now();
const TAG = `SMOKE ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
const STARTED = Date.now();

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

/** A step later steps depend on: if it fails, the run stops. */
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

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

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

/** Like http, but throws when the server answers with an error. */
async function call(method, path, options) {
  const response = await http(method, path, options);

  if (!response.ok) {
    throw new Error(`${method} ${path} → HTTP ${response.status}: ${problem(response)}`);
  }

  return response.json;
}

/** Records a check that passes only if the server refuses the request. */
async function expectRejected(name, method, path, options, mustMention) {
  const response = await http(method, path, options);
  const message = problem(response);

  if (response.ok) {
    return record(name, false, `the server accepted it (HTTP ${response.status})`);
  }

  if (response.status >= 500) {
    return record(name, false, `server error HTTP ${response.status}: ${message}`);
  }

  if (mustMention && !message.toLowerCase().includes(mustMention.toLowerCase())) {
    return record(
      name,
      false,
      `rejected with HTTP ${response.status}, but the message was: "${message}"`,
    );
  }

  return record(name, true);
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
const rfqIdOf = (row) => row?.id ?? row?.rfqId;

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

let buyer;
let manager;
let admin;
let template;
let suppliers = [];
const accountIds = [];
const created = [];

async function staffLogin(email) {
  const response = await call('POST', '/auth/login', {
    body: { email, password: STAFF_PASSWORD },
  });

  if (!response?.accessToken) {
    throw new Error(`login for ${email} returned no accessToken`);
  }

  return { email, token: response.accessToken };
}

async function loadTemplate() {
  const response = await http('GET', '/purchase-requests', { token: buyer.token });
  const rows = Array.isArray(response.json) ? response.json : [];
  const withCost = rows.find((row) => row.costCenter);
  const category = rows.flatMap((row) => row.items ?? []).find((item) => item.category)?.category;

  return {
    costCenter: withCost?.costCenter ?? 'SMOKE',
    currency: withCost?.currency ?? 'EUR',
    category: category ?? 'Office Supplies',
  };
}

async function createApprovedRequest(label) {
  const request = await call('POST', '/purchase-requests', {
    token: buyer.token,
    body: {
      title: `${TAG} ${label}`,
      description: 'Created by the smoke test script.',
      businessJustification: 'Automated end-to-end verification of the supplier RFQ flow.',
      costCenter: template.costCenter,
      currency: template.currency,
      desiredDeliveryDate: isoDate(inDays(30)),
      items: [
        {
          itemName: 'Smoke test item A',
          description: 'Smoke test line',
          category: template.category,
          quantity: 10,
          unit: 'pcs',
          estimatedUnitPrice: 25,
        },
        {
          itemName: 'Smoke test item B',
          description: 'Smoke test line',
          category: template.category,
          quantity: 5,
          unit: 'pcs',
          estimatedUnitPrice: 40,
        },
      ],
    },
  });

  const id = request?.id;

  if (!id) {
    throw new Error(
      `the purchase request response has no id (fields: ${Object.keys(request ?? {}).join(', ')})`,
    );
  }

  created.push(`Purchase request ${request.requestNumber ?? id}`);

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
      const approval = { body: { comment: 'Approved by the smoke test.' } };
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

async function createPublishedRfq(label, supplierIds) {
  const request = await createApprovedRequest(label);

  const rfq = await call('POST', '/rfqs', {
    token: buyer.token,
    body: {
      purchaseRequestId: request.id,
      title: `${TAG} ${label}`,
      description: 'Created by the smoke test script.',
      responseDeadline: isoLocalDateTime(inDays(2)),
      supplierIds,
    },
  });

  const published = await call('POST', `/rfqs/${rfq.id}/publish`, { token: buyer.token });

  created.push(`RFQ ${published.rfqNumber ?? published.id}`);

  return { ...published, requestNumber: request.number };
}

async function setUpPortalAccount(letter, supplier, name) {
  const email = `smoke-${letter}-${STAMP}@smoke.test`;

  const invitation = await call('POST', '/supplier-portal-admin/invitations', {
    token: manager.token,
    body: {
      supplierId: supplier.id,
      email,
      displayName: `Smoke ${letter.toUpperCase()} (${name})`.slice(0, 220),
    },
  });

  if (invitation?.account?.id) {
    accountIds.push(invitation.account.id);
  }

  await call('POST', '/supplier-portal/activate', {
    body: { invitationToken: invitation.invitationToken, password: PORTAL_PASSWORD },
  });

  const auth = await call('POST', '/supplier-portal/login', {
    body: { email, password: PORTAL_PASSWORD },
  });

  created.push(`Portal account ${email} (revoked at the end)`);

  return { letter, supplierId: supplier.id, name, email, token: tokenFrom(auth) };
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

async function bellCount(token, type, rfqId) {
  const list = await call('GET', '/notifications?unreadOnly=false', { token });

  return (list ?? []).filter(
    (item) => item.notificationType === type && item.entityId === rfqId,
  ).length;
}

async function expectBells(title, type, rfqId, owner, managerCount, adminCount = 0) {
  const got = {
    owner: await bellCount(buyer.token, type, rfqId),
    manager: await bellCount(manager.token, type, rfqId),
    admin: await bellCount(admin.token, type, rfqId),
  };

  check(
    `${title}: owner ${owner}, manager ${managerCount}, admin ${adminCount}`,
    got.owner === owner && got.manager === managerCount && got.admin === adminCount,
    `got owner ${got.owner}, manager ${got.manager}, admin ${got.admin}`,
  );
}

const portalRfq = (portal, rfqId) =>
  call('GET', `/supplier-portal/rfqs/${rfqId}`, { token: portal.token });

const portalUpdates = (portal) =>
  call('GET', '/supplier-portal/rfq-updates', { token: portal.token });

const buyerRfq = (rfqId) => call('GET', `/rfqs/${rfqId}`, { token: buyer.token });

const invitationStatus = (rfq, supplierId) =>
  rfq.invitations?.find((invitation) => invitation.supplierId === supplierId)?.status;

/* ------------------------------------------------------------------ */
/* The flow                                                            */
/* ------------------------------------------------------------------ */

async function main() {
  log(`ProcureIQ supplier RFQ smoke test — ${API}`);

  heading('Preflight');

  await step('Backend reachable and running the latest code', async () => {
    const updates = await http('GET', '/supplier-portal/rfq-updates');

    if (updates.status === 404) {
      throw new Error('/supplier-portal/rfq-updates not found: restart the backend');
    }

    const decline = await http(
      'POST',
      '/supplier-portal/rfqs/00000000-0000-0000-0000-000000000000/decline',
    );

    if (decline.status === 404 || decline.status === 405) {
      throw new Error('the decline endpoint was not found: restart the backend');
    }
  });

  heading('Setup');

  await step('Sign in as buyer, manager and admin', async () => {
    buyer = await staffLogin('buyer@procureiq.local');
    manager = await staffLogin('manager@procureiq.local');
    admin = await staffLogin('admin@procureiq.local');
  });

  await step('Pick two active suppliers', async () => {
    const list = await call('GET', '/suppliers?status=ACTIVE', { token: buyer.token });
    const active = (list ?? []).filter((supplier) => !supplier.status || supplier.status === 'ACTIVE');

    if (active.length < 2) {
      throw new Error(`need at least 2 active suppliers, found ${active.length}`);
    }

    suppliers = [active[0], active[1]];
    template = await loadTemplate();
  });

  let rfq1;

  await step('Create and approve a purchase request, then publish RFQ 1 for both suppliers', async () => {
    rfq1 = await createPublishedRfq(
      'RFQ one',
      suppliers.map((supplier) => supplier.id),
    );

    if (rfq1.status !== 'PUBLISHED') {
      throw new Error(`RFQ is ${rfq1.status}, expected PUBLISHED`);
    }
  });

  const nameOf = (supplier) =>
    rfq1.invitations.find((invitation) => invitation.supplierId === supplier.id)?.supplierName ??
    supplier.legalName ??
    supplier.id;

  let A;
  let B;

  await step('Invite, activate and sign in a portal account for each supplier', async () => {
    A = await setUpPortalAccount('a', suppliers[0], nameOf(suppliers[0]));
    B = await setUpPortalAccount('b', suppliers[1], nameOf(suppliers[1]));
  });

  await step('Both suppliers see RFQ 1 in their portal', async () => {
    for (const portal of [A, B]) {
      const list = await call('GET', '/supplier-portal/rfqs', { token: portal.token });
      const row = (list ?? []).find((entry) => rfqIdOf(entry) === rfq1.id);

      if (!row) {
        throw new Error(`supplier ${portal.letter.toUpperCase()} cannot see the RFQ`);
      }
    }
  });

  /* ---------------- Decline ---------------- */

  heading('Decline and reconsider');

  const declined = await step('Supplier A declines the invitation', async () =>
    call('POST', `/supplier-portal/rfqs/${rfq1.id}/decline`, { token: A.token }),
  );

  check(
    'Portal shows A as declined',
    declined?.invitationStatus === 'DECLINED',
    `status was ${declined?.invitationStatus}`,
  );

  const afterDecline = await buyerRfq(rfq1.id);

  check(
    'Buyer sees A DECLINED and B still INVITED',
    invitationStatus(afterDecline, A.supplierId) === 'DECLINED' &&
      invitationStatus(afterDecline, B.supplierId) === 'INVITED',
    `A ${invitationStatus(afterDecline, A.supplierId)}, B ${invitationStatus(afterDecline, B.supplierId)}`,
  );

  await expectBells('Decline notification', 'SUPPLIER_INVITATION_DECLINED', rfq1.id, 1, 1, 0);

  const listAfterDecline = await call('GET', '/supplier-portal/rfqs', { token: A.token });

  check(
    'A’s RFQ list marks the RFQ as declined',
    (listAfterDecline ?? []).find((row) => rfqIdOf(row) === rfq1.id)?.invitationStatus ===
      'DECLINED',
  );

  await expectRejected(
    'A cannot save a quotation while declined',
    'PUT',
    `/supplier-portal/rfqs/${rfq1.id}/quotation`,
    { token: A.token, body: quotePayload(rfq1, [24, 38], 14) },
    'declined',
  );

  await expectRejected(
    'A cannot decline twice',
    'POST',
    `/supplier-portal/rfqs/${rfq1.id}/decline`,
    { token: A.token },
    'already declined',
  );

  await expectRejected(
    'The server refuses a buyer recording a quotation for the declined supplier',
    'POST',
    `/rfqs/${rfq1.id}/quotations`,
    {
      token: buyer.token,
      body: { supplierId: A.supplierId, ...quotePayload(rfq1, [24, 38], 14) },
    },
    'declined',
  );

  const reconsidered = await step('Supplier A reconsiders', async () =>
    call('POST', `/supplier-portal/rfqs/${rfq1.id}/reconsider`, { token: A.token }),
  );

  check(
    'Portal shows A as invited again',
    reconsidered?.invitationStatus === 'INVITED',
    `status was ${reconsidered?.invitationStatus}`,
  );

  await expectBells('Reconsider notification', 'SUPPLIER_INVITATION_RECONSIDERED', rfq1.id, 1, 1, 0);

  /* ---------------- Quotations ---------------- */

  heading('Quotations');

  const draftA = await step('A saves a draft quotation', async () =>
    call('PUT', `/supplier-portal/rfqs/${rfq1.id}/quotation`, {
      token: A.token,
      body: quotePayload(rfq1, [24, 38], 14),
    }),
  );

  check('A’s quotation is a draft', draftA?.quotation?.status === 'DRAFT', draftA?.quotation?.status);

  await expectBells('No submit notification for a draft', 'SUPPLIER_QUOTATION_SUBMITTED', rfq1.id, 0, 0, 0);

  /* ---------------- Buyer edits a draft (regression: HTTP 409 when replacing lines) ---------------- */

  {
    const findBuyerQuote = async () => {
      const list = await call('GET', `/rfqs/${rfq1.id}/quotations`, { token: buyer.token });

      return (list ?? []).find(
        (q) =>
          q.supplierId === A.supplierId ||
          q.supplier?.id === A.supplierId ||
          q.id === draftA?.quotation?.id,
      );
    };

    try {
      const before = await findBuyerQuote();

      if (!before?.id) {
        throw new Error('the buyer cannot see supplier A’s draft quotation');
      }

      const totalBefore = Number(before.totalAmount);

      const edited = await http('PUT', `/quotations/${before.id}`, {
        token: buyer.token,
        body: quotePayload(rfq1, [26, 41], 14),
      });

      check(
        'Buyer edits the draft quotation (replaces its lines)',
        edited.ok,
        `HTTP ${edited.status}: ${problem(edited)}`,
      );

      if (edited.ok) {
        const after = await findBuyerQuote();

        check(
          'The edit is saved: the total went up',
          Number(after?.totalAmount) > totalBefore,
          `total was ${totalBefore}, now ${after?.totalAmount}`,
        );

        const restored = await http('PUT', `/quotations/${before.id}`, {
          token: buyer.token,
          body: quotePayload(rfq1, [24, 38], 14),
        });

        const restoredQuote = restored.ok ? await findBuyerQuote() : null;

        check(
          'Buyer edits the draft again and restores the original prices',
          restored.ok && Number(restoredQuote?.totalAmount) === totalBefore,
          restored.ok
            ? `total is ${restoredQuote?.totalAmount}, expected ${totalBefore}`
            : `HTTP ${restored.status}: ${problem(restored)}`,
        );
      }
    } catch (error) {
      record('Buyer edits a draft quotation', false, error instanceof Error ? error.message : String(error));
    }
  }


  const submittedA = await step('A submits the quotation', async () =>
    call('POST', `/supplier-portal/rfqs/${rfq1.id}/quotation/submit`, { token: A.token }),
  );

  check(
    'A’s quotation is submitted',
    submittedA?.quotation?.status === 'SUBMITTED',
    submittedA?.quotation?.status,
  );

  await expectBells('Submit notification (A)', 'SUPPLIER_QUOTATION_SUBMITTED', rfq1.id, 1, 1, 0);

  await expectRejected(
    'A cannot decline while a quotation is submitted',
    'POST',
    `/supplier-portal/rfqs/${rfq1.id}/decline`,
    { token: A.token },
    'withdraw',
  );

  await step('B saves and submits a quotation', async () => {
    await call('PUT', `/supplier-portal/rfqs/${rfq1.id}/quotation`, {
      token: B.token,
      body: quotePayload(rfq1, [26, 36], 10),
    });

    const result = await call('POST', `/supplier-portal/rfqs/${rfq1.id}/quotation/submit`, {
      token: B.token,
    });

    if (result?.quotation?.status !== 'SUBMITTED') {
      throw new Error(`B’s quotation is ${result?.quotation?.status}`);
    }
  });

  await expectBells('Submit notification (A and B)', 'SUPPLIER_QUOTATION_SUBMITTED', rfq1.id, 2, 2, 0);

  const detailA = await portalRfq(A, rfq1.id);
  const detailB = await portalRfq(B, rfq1.id);
  const quotationA = detailA.quotation;
  const quotationB = detailB.quotation;

  const textA = JSON.stringify(detailA);
  const textB = JSON.stringify(detailB);

  check(
    'A’s portal view contains nothing about B (id, name or quotation)',
    !textA.includes(B.supplierId) &&
      !textA.includes(B.name) &&
      !(quotationB?.quotationNumber && textA.includes(quotationB.quotationNumber)),
  );

  check(
    'B’s portal view contains nothing about A (id, name or quotation)',
    !textB.includes(A.supplierId) &&
      !textB.includes(A.name) &&
      !(quotationA?.quotationNumber && textB.includes(quotationA.quotationNumber)),
  );

  check(
    'Neither portal view exposes the purchase request',
    !rfq1.requestNumber || (!textA.includes(rfq1.requestNumber) && !textB.includes(rfq1.requestNumber)),
  );

  const afterBoth = await buyerRfq(rfq1.id);

  check(
    'Buyer sees both invitations as responded',
    invitationStatus(afterBoth, A.supplierId) === 'RESPONDED' &&
      invitationStatus(afterBoth, B.supplierId) === 'RESPONDED',
    `A ${invitationStatus(afterBoth, A.supplierId)}, B ${invitationStatus(afterBoth, B.supplierId)}`,
  );

  const buyerQuotations = await call('GET', `/rfqs/${rfq1.id}/quotations`, { token: buyer.token });

  check(
    'Buyer sees two submitted quotations',
    (buyerQuotations ?? []).filter((q) => q.status === 'SUBMITTED').length === 2,
  );

  const withdrawn = await step('A withdraws the quotation', async () =>
    call('POST', `/supplier-portal/rfqs/${rfq1.id}/quotation/withdraw`, { token: A.token }),
  );

  check(
    'A’s quotation is withdrawn',
    withdrawn?.quotation?.status === 'WITHDRAWN',
    withdrawn?.quotation?.status,
  );

  await expectBells('Withdraw notification', 'SUPPLIER_QUOTATION_WITHDRAWN', rfq1.id, 1, 1, 0);

  const revised = await step('A revises the withdrawn quotation (reopens it as a draft)', async () =>
    call('PUT', `/supplier-portal/rfqs/${rfq1.id}/quotation`, {
      token: A.token,
      body: quotePayload(rfq1, [24, 38], 12),
    }),
  );

  check('The revision is a draft', revised?.quotation?.status === 'DRAFT', revised?.quotation?.status);

  const resubmitted = await step('A submits the revised quotation', async () =>
    call('POST', `/supplier-portal/rfqs/${rfq1.id}/quotation/submit`, { token: A.token }),
  );

  check(
    'The revised quotation is submitted',
    resubmitted?.quotation?.status === 'SUBMITTED',
    resubmitted?.quotation?.status,
  );

  await expectBells('Submit notification (A, B and A again)', 'SUPPLIER_QUOTATION_SUBMITTED', rfq1.id, 3, 3, 0);

  /* ---------------- Close and award ---------------- */

  heading('Close and award');

  await step('Buyer closes RFQ 1', async () => {
    const closed = await call('POST', `/rfqs/${rfq1.id}/close`, { token: buyer.token });

    if (closed.status !== 'CLOSED') {
      throw new Error(`RFQ is ${closed.status}, expected CLOSED`);
    }
  });

  for (const portal of [A, B]) {
    const entry = (await portalUpdates(portal)).find((update) => update.rfqId === rfq1.id);

    check(
      `Supplier ${portal.letter.toUpperCase()} sees "RFQ closed" and that the quotation is being evaluated`,
      entry?.kind === 'RFQ_CLOSED' && /being evaluated/i.test(entry?.message ?? ''),
      entry ? `${entry.kind}: ${entry.message}` : 'no update shown',
    );
  }

  const finalA = await portalRfq(A, rfq1.id);
  const finalB = await portalRfq(B, rfq1.id);

  await step('Buyer evaluates the quotations', async () => {
    await call('PUT', `/rfqs/${rfq1.id}/evaluation`, {
      token: buyer.token,
      body: {
        priceWeight: 40,
        deliveryWeight: 20,
        supplierRatingWeight: 15,
        riskWeight: 15,
        qualityWeight: 10,
        qualityScores: [
          { quotationId: finalA.quotation.id, qualityScore: 80 },
          { quotationId: finalB.quotation.id, qualityScore: 75 },
        ],
      },
    });
  });

  await step('Manager awards RFQ 1 to supplier A', async () => {
    await call('POST', `/rfqs/${rfq1.id}/award`, {
      token: manager.token,
      body: {
        selectedQuotationId: finalA.quotation.id,
        rationale: 'Selected by the smoke test.',
      },
    });
  });

  const updatesA = await portalUpdates(A);
  const updatesB = await portalUpdates(B);
  const entryA = updatesA.find((update) => update.rfqId === rfq1.id);
  const entryB = updatesB.find((update) => update.rfqId === rfq1.id);

  check(
    'Winner A sees "Awarded to you" naming its own quotation',
    entryA?.kind === 'AWARDED_TO_YOU' &&
      (!finalA.quotation.quotationNumber || (entryA.message ?? '').includes(finalA.quotation.quotationNumber)),
    entryA ? `${entryA.kind}: ${entryA.message}` : 'no update shown',
  );

  check(
    'Unsuccessful B sees only "A decision has been made"',
    entryB?.kind === 'DECISION_MADE',
    entryB ? `${entryB.kind}: ${entryB.message}` : 'no update shown',
  );

  const bText = JSON.stringify(entryB ?? {});

  check(
    'B’s update does not reveal the winner (id, name or quotation)',
    entryB !== undefined &&
      !bText.includes(A.supplierId) &&
      !bText.includes(A.name) &&
      !(finalA.quotation.quotationNumber && bText.includes(finalA.quotation.quotationNumber)),
  );

  /* ---------------- Purchase order ---------------- */

  try {
    heading('Purchase order');

    const portalOrders = async (portal) => {
      const list = await call('GET', '/supplier-portal/purchase-orders', { token: portal.token });

      return Array.isArray(list) ? list : [];
    };
    const portalOrder = (portal, id) =>
      http('GET', `/supplier-portal/purchase-orders/${id}`, { token: portal.token });
    const portalPath = (id, action) => `/supplier-portal/purchase-orders/${id}/${action}`;
    const buyerOrder = (id) => call('GET', `/purchase-orders/${id}`, { token: buyer.token });
    const refused = (response) => !response.ok && response.status < 500;
    const outcome = (response) =>
      response.ok ? 'the server accepted it' : `HTTP ${response.status}: ${problem(response)}`;

    const internalNote = `SMOKE internal note ${STAMP}`;
    const rejectionReason = 'Unit prices do not match the agreed quotation.';
    const acknowledgementNote = 'Will ship on the expected date.';
    const correctedAddress = 'SMOKE Warehouse B, 2 Revised Street';

    const po = await step('Buyer creates a purchase order from the awarded RFQ', async () =>
      call('POST', '/purchase-orders', {
        token: buyer.token,
        body: {
          rfqId: rfq1.id,
          expectedDeliveryDate: isoDate(inDays(14)),
          deliveryAddress: 'SMOKE Warehouse, 1 Test Street',
          buyerNotes: internalNote,
        },
      }),
    );

    created.push(`Purchase order ${po.poNumber ?? po.id}`);

    check(
      'The new order is a draft that no supplier has answered',
      po.status === 'DRAFT' && po.supplierResponse === 'PENDING',
      `${po.status} / ${po.supplierResponse}`,
    );

    check(
      'A draft order is not in supplier A’s list',
      !(await portalOrders(A)).some((order) => order.id === po.id),
    );

    const draftView = await portalOrder(A, po.id);

    check('Supplier A cannot open a draft order by id (404)', draftView.status === 404, `HTTP ${draftView.status}`);

    const issued = await step('Buyer issues the purchase order', async () =>
      call('POST', `/purchase-orders/${po.id}/issue`, { token: buyer.token }),
    );

    check(
      'The issued order is waiting for the supplier',
      issued.status === 'ISSUED' && issued.supplierResponse === 'PENDING',
      `${issued.status} / ${issued.supplierResponse}`,
    );

    const rowA = (await portalOrders(A)).find((order) => order.id === po.id);

    check(
      'Supplier A sees the issued order as waiting for a response',
      rowA?.status === 'ISSUED' && rowA?.supplierResponse === 'PENDING',
      rowA ? `${rowA.status} / ${rowA.supplierResponse}` : 'not in the list',
    );

    const detailA = await portalOrder(A, po.id);

    check(
      'Supplier A can open the order and sees all its lines',
      detailA.ok &&
        Array.isArray(detailA.json?.lines) &&
        detailA.json.lines.length > 0 &&
        detailA.json.lines.length === (issued.lines ?? []).length,
      detailA.ok ? `${detailA.json?.lines?.length} lines` : outcome(detailA),
    );

    const textA = JSON.stringify(detailA.json ?? {});

    check(
      'The order shown to A leaves out the buyer’s notes, the purchase request and supplier B',
      detailA.ok &&
        !textA.includes(internalNote) &&
        !(rfq1.requestNumber && textA.includes(rfq1.requestNumber)) &&
        !textA.includes(B.supplierId) &&
        !textA.includes(B.name),
    );

    check(
      'Supplier B does not see A’s order in its list',
      !(await portalOrders(B)).some((order) => order.id === po.id),
    );

    const viewB = await portalOrder(B, po.id);

    check('Supplier B cannot open A’s order (404)', viewB.status === 404, `HTTP ${viewB.status}`);

    const ackByB = await http('POST', portalPath(po.id, 'acknowledge'), { token: B.token, body: {} });

    check('Supplier B cannot acknowledge A’s order (404)', ackByB.status === 404, outcome(ackByB));

    check(
      'A’s order is still waiting after B’s attempt',
      (await buyerOrder(po.id)).supplierResponse === 'PENDING',
    );

    const noReason = await http('POST', portalPath(po.id, 'reject'), {
      token: A.token,
      body: { note: '   ' },
    });

    check('A rejection without a reason is refused', refused(noReason), outcome(noReason));

    await expectBells('No notification for the refused rejection', 'SUPPLIER_PO_REJECTED', rfq1.id, 0, 0, 0);

    const rejected = await step('Supplier A rejects the order with a reason', async () =>
      call('POST', portalPath(po.id, 'reject'), { token: A.token, body: { note: rejectionReason } }),
    );

    check(
      'The order shows as rejected while its own status stays ISSUED',
      rejected.supplierResponse === 'REJECTED' &&
        rejected.status === 'ISSUED' &&
        rejected.supplierResponseNote === rejectionReason,
      `${rejected.status} / ${rejected.supplierResponse}`,
    );

    await expectBells('Rejection notification', 'SUPPLIER_PO_REJECTED', rfq1.id, 1, 1, 0);

    const answeredTwice = await http('POST', portalPath(po.id, 'acknowledge'), { token: A.token, body: {} });

    check('A cannot answer the same order twice', refused(answeredTwice), outcome(answeredTwice));

    const seenRejected = await buyerOrder(po.id);

    check(
      'The buyer sees the rejection, the reason and when it happened',
      seenRejected.supplierResponse === 'REJECTED' &&
        seenRejected.supplierResponseNote === rejectionReason &&
        Boolean(seenRejected.supplierRespondedAt),
      `${seenRejected.supplierResponse}`,
    );

    const reopened = await step('Buyer reopens the rejected order for revision', async () =>
      call('POST', `/purchase-orders/${po.id}/reopen`, { token: buyer.token }),
    );

    check(
      'The reopened order is a draft with the same PO number and a cleared response',
      reopened.status === 'DRAFT' &&
        reopened.supplierResponse === 'PENDING' &&
        !reopened.supplierResponseNote &&
        !reopened.issuedAt &&
        reopened.poNumber === po.poNumber,
      `${reopened.status} / ${reopened.supplierResponse} / ${reopened.poNumber}`,
    );

    check(
      'Supplier A no longer sees the reopened draft',
      !(await portalOrders(A)).some((order) => order.id === po.id),
    );

    const reopenedAgain = await http('POST', `/purchase-orders/${po.id}/reopen`, { token: buyer.token });

    check('A draft cannot be reopened again', refused(reopenedAgain), outcome(reopenedAgain));

    const edited = await step('Buyer corrects the delivery details on the draft', async () =>
      call('PUT', `/purchase-orders/${po.id}`, {
        token: buyer.token,
        body: {
          expectedDeliveryDate: isoDate(inDays(21)),
          deliveryAddress: correctedAddress,
          buyerNotes: internalNote,
        },
      }),
    );

    check(
      'The correction is saved',
      edited.status === 'DRAFT' && edited.deliveryAddress === correctedAddress,
      `${edited.status} / ${edited.deliveryAddress}`,
    );

    const reissued = await step('Buyer issues the corrected order again', async () =>
      call('POST', `/purchase-orders/${po.id}/issue`, { token: buyer.token }),
    );

    check(
      'The re-issued order is waiting for the supplier again',
      reissued.status === 'ISSUED' && reissued.supplierResponse === 'PENDING',
      `${reissued.status} / ${reissued.supplierResponse}`,
    );

    const detailAgain = await portalOrder(A, po.id);

    check(
      'Supplier A sees the corrected address and can answer again',
      detailAgain.ok &&
        detailAgain.json?.deliveryAddress === correctedAddress &&
        detailAgain.json?.supplierResponse === 'PENDING',
      detailAgain.ok ? `${detailAgain.json?.supplierResponse}` : outcome(detailAgain),
    );

    const acknowledged = await step('Supplier A acknowledges the corrected order', async () =>
      call('POST', portalPath(po.id, 'acknowledge'), { token: A.token, body: { note: acknowledgementNote } }),
    );

    check(
      'The order shows as acknowledged',
      acknowledged.supplierResponse === 'ACKNOWLEDGED' &&
        acknowledged.supplierResponseNote === acknowledgementNote,
      `${acknowledged.supplierResponse}`,
    );

    await expectBells('Acknowledgement notification', 'SUPPLIER_PO_ACKNOWLEDGED', rfq1.id, 1, 1, 0);
    await expectBells('The earlier rejection notification is not repeated', 'SUPPLIER_PO_REJECTED', rfq1.id, 1, 1, 0);

    const seenAcknowledged = await buyerOrder(po.id);

    check(
      'The buyer sees the acknowledgement on an order that is still ISSUED',
      seenAcknowledged.supplierResponse === 'ACKNOWLEDGED' && seenAcknowledged.status === 'ISSUED',
      `${seenAcknowledged.status} / ${seenAcknowledged.supplierResponse}`,
    );

    const lateReopen = await http('POST', `/purchase-orders/${po.id}/reopen`, { token: buyer.token });

    check('An acknowledged order cannot be reopened', refused(lateReopen), outcome(lateReopen));

    const lateReject = await http('POST', portalPath(po.id, 'reject'), {
      token: A.token,
      body: { note: 'Changed my mind.' },
    });

    check('An acknowledged order cannot be rejected afterwards', refused(lateReject), outcome(lateReject));
  } catch (error) {
    if (!(error instanceof Abort)) throw error;
  }

  /* ---------------- Cancelled RFQ ---------------- */

  heading('Cancelled RFQ');

  let rfq2;

  await step('Create and publish RFQ 2 for both suppliers', async () => {
    rfq2 = await createPublishedRfq(
      'RFQ two',
      suppliers.map((supplier) => supplier.id),
    );
  });

  await step('Supplier A declines RFQ 2', async () =>
    call('POST', `/supplier-portal/rfqs/${rfq2.id}/decline`, { token: A.token }),
  );

  await step('Buyer cancels RFQ 2', async () => {
    const cancelled = await call('POST', `/rfqs/${rfq2.id}/cancel`, { token: buyer.token });

    if (cancelled.status !== 'CANCELLED') {
      throw new Error(`RFQ is ${cancelled.status}, expected CANCELLED`);
    }
  });

  const cancelledForB = (await portalUpdates(B)).find((update) => update.rfqId === rfq2.id);

  check(
    'B sees "RFQ cancelled"',
    cancelledForB?.kind === 'RFQ_CANCELLED',
    cancelledForB ? `${cancelledForB.kind}: ${cancelledForB.message}` : 'no update shown',
  );

  check(
    'A, who declined RFQ 2, is not shown it',
    !(await portalUpdates(A)).some((update) => update.rfqId === rfq2.id),
  );
}

/* ------------------------------------------------------------------ */
/* Cleanup and summary                                                 */
/* ------------------------------------------------------------------ */

async function cleanup() {
  if (accountIds.length === 0 || !manager?.token) {
    return;
  }

  heading('Cleanup');

  for (const id of accountIds) {
    try {
      const response = await http('POST', `/supplier-portal-admin/accounts/${id}/revoke`, {
        token: manager.token,
      });

      record(`Revoke smoke portal account ${id.slice(0, 8)}…`, response.ok, problem(response));
    } catch (error) {
      record(`Revoke smoke portal account ${id.slice(0, 8)}…`, false, error.message);
    }
  }
}

function finish() {
  const failed = results.filter((result) => !result.ok);
  const seconds = Math.round((Date.now() - STARTED) / 1000);

  log('');
  log(
    `${failed.length === 0 ? '✔' : '✖'} ${results.length - failed.length} of ${results.length} checks passed in ${seconds}s`,
  );

  if (failed.length > 0) {
    log('Failed:');

    for (const result of failed) {
      log(`  • ${result.name}${result.why ? ` — ${result.why}` : ''}`);
    }
  }

  if (created.length > 0) {
    log('');
    log('Records created (all labelled SMOKE):');

    for (const item of created) {
      log(`  • ${item}`);
    }
  }

  process.exitCode = failed.length === 0 ? 0 : 1;
}

try {
  await main();
} catch (error) {
  if (error instanceof Abort) {
    log(`\n■ Stopped at "${error.message}" because the steps after it depend on it.`);
  } else {
    log(`\n■ Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
    results.push({ name: 'Unexpected error', ok: false, why: String(error?.message ?? error) });
  }
} finally {
  await cleanup();
  finish();
}
