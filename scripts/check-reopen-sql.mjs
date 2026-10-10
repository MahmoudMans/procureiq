#!/usr/bin/env node
/**
 * Checks the purchase order reopen statement against the real database, inside a
 * transaction that is always rolled back.
 *
 *   - an order that has a goods receipt must NOT be reopened, even when it is forced into
 *     the "issued and rejected" state (the state a race between a receipt and a reopen
 *     could create)
 *   - the same statement MUST reopen such an order when it has no receipt (the control)
 *
 * The statement is read from PurchaseOrderRepository.java, so the check follows the code.
 * Run the supplier smoke test first: it records a goods receipt for this check to find.
 *
 *   node scripts/check-reopen-sql.mjs
 *
 * Optional environment variables:
 *   PROCUREIQ_DB_CONTAINER   default procureiq-postgres
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CONTAINER = process.env.PROCUREIQ_DB_CONTAINER ?? 'procureiq-postgres';
const REPOSITORY = 'backend/src/main/java/com/procureiq/purchaseorder/PurchaseOrderRepository.java';

let failures = 0;

function report(ok, name, why) {
  if (!ok) {
    failures += 1;
  }

  console.log(`  ${ok ? '✔' : '✖'} ${name}${!ok && why ? ` — ${why}` : ''}`);

  return ok;
}

function docker(args, input) {
  try {
    return execFileSync('docker', ['exec', '-i', CONTAINER, ...args], {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = String(error.stderr || error.message).trim().split('\n').slice(0, 6).join(' | ');

    throw new Error(`docker exec ${args[0]} failed: ${detail}`);
  }
}

function containerEnv(name, fallback) {
  try {
    return docker(['printenv', name]).trim() || fallback;
  } catch {
    return fallback;
  }
}

const DB_USER = containerEnv('POSTGRES_USER', 'procureiq');
const DB_NAME = containerEnv('POSTGRES_DB', 'procureiq');

function psql(sql) {
  return docker(['psql', '-U', DB_USER, '-d', DB_NAME, '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t'], sql);
}

function reopenStatement() {
  const text = readFileSync(REPOSITORY, 'utf8');
  const at = text.indexOf('int reopenRejected');

  if (at < 0) {
    throw new Error('reopenRejected was not found in PurchaseOrderRepository.java');
  }

  const close = text.lastIndexOf('"""', at);
  const open = close < 0 ? -1 : text.lastIndexOf('"""', close - 1);

  if (open < 0) {
    throw new Error('could not find the SQL text block above reopenRejected');
  }

  const sql = text.slice(open + 3, close).trim();

  if (!/^UPDATE purchase_orders/i.test(sql) || sql.split(':purchaseOrderId').length !== 2) {
    throw new Error('the statement above reopenRejected is not the shape this check expects');
  }

  return sql;
}

function fingerprint() {
  const out = psql(
    `SELECT 'FINGERPRINT:' || COALESCE(md5(string_agg(id::text || '|' || status || '|' || COALESCE(supplier_response, '') || '|' || version::text, ',' ORDER BY id)), 'empty') FROM purchase_orders;`,
  );
  const line = out
    .split('\n')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('FINGERPRINT:'));

  if (!line) {
    throw new Error('could not read the purchase orders fingerprint');
  }

  return line;
}

function main() {
  console.log('Reopen statement check (everything is rolled back)');

  const statement = reopenStatement();
  const before = fingerprint();
  const forWith = statement.replace(':purchaseOrderId', '(SELECT id FROM probe_with)');
  const forWithout = statement.replace(':purchaseOrderId', '(SELECT id FROM probe_without)');

  const output = psql(`
BEGIN;
CREATE TEMP TABLE probe_with AS
  SELECT po.id FROM purchase_orders po
  WHERE po.issued_at IS NOT NULL AND po.status <> 'CANCELLED'
    AND EXISTS (SELECT 1 FROM goods_receipts r WHERE r.purchase_order_id = po.id)
  ORDER BY po.updated_at DESC LIMIT 1;
CREATE TEMP TABLE probe_without AS
  SELECT po.id FROM purchase_orders po
  WHERE po.issued_at IS NOT NULL AND po.status <> 'CANCELLED'
    AND NOT EXISTS (SELECT 1 FROM goods_receipts r WHERE r.purchase_order_id = po.id)
  ORDER BY po.updated_at DESC LIMIT 1;
SELECT 'FOUND_WITH:' || count(*) FROM probe_with;
SELECT 'FOUND_WITHOUT:' || count(*) FROM probe_without;
UPDATE purchase_orders
  SET status = 'ISSUED',
      supplier_response = 'REJECTED',
      supplier_responded_at = CURRENT_TIMESTAMP,
      supplier_response_note = 'reopen statement check'
  WHERE id IN (SELECT id FROM probe_with UNION ALL SELECT id FROM probe_without);
WITH changed AS (${forWith} RETURNING purchase_orders.id)
  SELECT 'CHANGED_WITH:' || count(*) FROM changed;
WITH changed AS (${forWithout} RETURNING purchase_orders.id)
  SELECT 'CHANGED_WITHOUT:' || count(*) FROM changed;
ROLLBACK;
`);

  const values = {};

  for (const line of output.split('\n')) {
    const match = /^([A-Z_]+):(\d+)$/.exec(line.trim());

    if (match) {
      values[match[1]] = Number(match[2]);
    }
  }

  const haveBoth = values.FOUND_WITH === 1 && values.FOUND_WITHOUT === 1;

  report(
    haveBoth,
    'The database has an issued order with a goods receipt and one without',
    'run the supplier smoke test first, it records a goods receipt',
  );

  if (haveBoth) {
    report(
      values.CHANGED_WITH === 0,
      'An issued, rejected order with a goods receipt is NOT reopened by the statement',
      `rows changed: ${values.CHANGED_WITH}`,
    );

    report(
      values.CHANGED_WITHOUT === 1,
      'The same statement DOES reopen such an order when it has no receipt (control)',
      `rows changed: ${values.CHANGED_WITHOUT}`,
    );
  }

  report(fingerprint() === before, 'Nothing was kept: the purchase orders table is exactly as it was', 'the fingerprint changed');
}

try {
  main();
} catch (error) {
  console.log(`■ ${error instanceof Error ? error.message : String(error)}`);
  failures += 1;
}

console.log('');
console.log(failures === 0 ? '✔ All reopen statement checks passed' : `✖ ${failures} problem(s)`);
process.exitCode = failures === 0 ? 0 : 1;
