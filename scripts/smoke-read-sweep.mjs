#!/usr/bin/env node
/**
 * ProcureIQ read sweep: calls every GET endpoint declared in the backend controllers.
 *
 * Read-only and localhost-only. Signs in as admin, buyer and manager, calls each endpoint
 * plain and with parameter variants, finds real ids in the responses, calls the detail
 * endpoints, then replays what worked as buyer and manager.
 *
 *   node scripts/smoke-read-sweep.mjs
 *
 * Optional environment variables: API_BASE_URL, SMOKE_STAFF_PASSWORD
 */
import { appendFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '');
const PASSWORD = process.env.SMOKE_STAFF_PASSWORD ?? 'ProcureIQ!Demo2026';
const REPORT = '/tmp/procureiq_sweep_report.txt';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JAVA = join(ROOT, 'backend/src/main/java');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOW = new Date();
const TODAY = NOW.toISOString().slice(0, 10);
const YEAR = NOW.getFullYear();
const SEARCH_VARIANTS = ['', 'a', '%', "'", 'zzz-no-match'];
const MAX_INLINE = 40;
const STARTED = Date.now();

writeFileSync(REPORT, '');

function log(line = '') {
  console.log(line);
  appendFileSync(REPORT, `${line}\n`);
}

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

/* ------------------------------------------------------------------ */
/* HTTP                                                                */
/* ------------------------------------------------------------------ */

async function http(method, path, token, body) {
  const headers = { Accept: 'application/json, text/plain, */*' };

  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const response = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    let json = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    return { status: response.status, json, text };
  } catch (error) {
    return { status: 0, json: null, text: String(error?.cause?.code ?? error?.message ?? error) };
  }
}

function problem(r) {
  return String(r.json?.detail ?? r.json?.title ?? r.json?.message ?? r.text ?? '')
    .replace(/\s+/g, ' ')
    .slice(0, 160);
}

async function staffLogin(email) {
  let last = null;

  for (const body of [
    { email, password: PASSWORD },
    { username: email, password: PASSWORD },
  ]) {
    const r = await http('POST', '/auth/login', undefined, body);
    const token =
      r.json?.accessToken ?? r.json?.token ?? r.json?.access_token ?? r.json?.jwt ?? r.json?.tokens?.accessToken;

    if (r.status >= 200 && r.status < 300 && token) return token;

    last = r;
  }

  throw new Error(
    `Sign-in failed for ${email}: HTTP ${last.status} ${problem(last)} (response keys: ${Object.keys(last.json ?? {}).join(', ') || 'none'})`,
  );
}

/* ------------------------------------------------------------------ */
/* Reading the controllers                                             */
/* ------------------------------------------------------------------ */

function javaFiles(dir) {
  const out = [];

  for (const name of readdirSync(dir)) {
    const full = join(dir, name);

    if (statSync(full).isDirectory()) out.push(...javaFiles(full));
    else if (name.endsWith('.java')) out.push(full);
  }

  return out;
}

function matching(text, open) {
  let depth = 0;
  let quote = false;

  for (let i = open; i < text.length; i++) {
    const c = text[i];

    if (c === '"' && text[i - 1] !== '\\') quote = !quote;
    if (quote) continue;

    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

function splitTop(text) {
  const parts = [];
  let depth = 0;
  let quote = false;
  let current = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (c === '"' && text[i - 1] !== '\\') quote = !quote;

    if (!quote) {
      if (c === '(' || c === '<' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === '>' || c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
    }

    current += c;
  }

  if (current.trim()) parts.push(current);

  return parts;
}

function pathOf(args) {
  if (args == null) return '';

  const named = args.match(/\b(?:value|path)\s*=\s*(?:\{\s*)?"([^"]*)"/);

  if (named) return named[1];

  const lead = args.trim().match(/^(?:\{\s*)?"([^"]*)"/);

  return lead ? lead[1] : '';
}

function argName(args) {
  return (
    args.match(/\b(?:value|name)\s*=\s*"([^"]*)"/)?.[1] ?? args.match(/^\s*"([^"]*)"/)?.[1] ?? null
  );
}

function parseParam(raw) {
  const text = raw.trim();

  if (!text) return null;

  const anns = [...text.matchAll(/@(\w+)(?:\s*\(([^)]*)\))?/g)].map((a) => ({
    name: a[1],
    args: a[2] ?? '',
  }));
  const bare = text
    .replace(/@\w+(?:\s*\([^)]*\))?\s*/g, '')
    .replace(/\bfinal\s+/g, '')
    .trim();
  const words = bare.split(/\s+/);
  const javaName = words.pop();
  const rawType = words.join(' ');
  const wrapped = /^Optional</.test(rawType);
  const type = rawType.replace(/^Optional<(.+)>$/, '$1');
  const pv = anns.find((a) => a.name === 'PathVariable');
  const rp = anns.find((a) => a.name === 'RequestParam');

  if (pv) return { kind: 'path', name: argName(pv.args) ?? javaName, type };

  if (rp) {
    const def = rp.args.match(/defaultValue\s*=\s*"([^"]*)"/)?.[1] ?? null;
    const optional = /required\s*=\s*false/.test(rp.args) || def !== null || wrapped;

    return { kind: 'query', name: argName(rp.args) ?? javaName, type, required: !optional, def };
  }

  return null;
}

const sources = javaFiles(JAVA).map((file) => ({
  file,
  text: readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1 ')
    .replace(/\s+/g, ' '),
}));

const enums = new Map();

for (const { text } of sources) {
  for (const m of text.matchAll(/\benum (\w+)(?: implements [^{]*)? \{([^}]*)\}/g)) {
    const area = m[2].split(';')[0];
    const names = [
      ...new Set([...area.matchAll(/\b([A-Z][A-Z0-9_]*)\b(?=\s*(?:\(|,|$))/g)].map((x) => x[1])),
    ];

    if (names.length) enums.set(m[1], names);
  }
}

function discover() {
  const eps = [];
  const skipped = [];
  const seen = new Set();
  let controllers = 0;

  for (const { text } of sources) {
    if (!/@(?:Rest)?Controller\b/.test(text)) continue;

    controllers += 1;

    const classAt = text.search(/\b(?:public |final |abstract )*class \w+/);
    const head = classAt > 0 ? text.slice(0, classAt) : '';
    let base = '';
    const rm = head.match(/@RequestMapping\s*\(/);

    if (rm) {
      const open = rm.index + rm[0].length - 1;
      const close = matching(head, open);

      base = pathOf(head.slice(open + 1, close));
    }

    for (const m of text.matchAll(/@GetMapping\b/g)) {
      let cursor = m.index + m[0].length;
      let args = null;

      if (/^\s*\(/.test(text.slice(cursor))) {
        const open = text.indexOf('(', cursor);
        const close = matching(text, open);

        args = text.slice(open + 1, close);
        cursor = close + 1;
      }

      const bodyAt = text.indexOf('{', cursor);

      if (bodyAt < 0) continue;

      const segment = text
        .slice(cursor, bodyAt)
        .trim()
        .replace(/\sthrows [\w.,\s]+$/, '');
      const end = segment.lastIndexOf(')');
      let params = [];

      if (end >= 0) {
        let depth = 0;
        let start = -1;

        for (let i = end; i >= 0; i--) {
          if (segment[i] === ')') depth++;
          else if (segment[i] === '(') {
            depth--;
            if (depth === 0) {
              start = i;
              break;
            }
          }
        }

        if (start >= 0) params = splitTop(segment.slice(start + 1, end));
      }

      const full = `/${base}/${pathOf(args)}`.replace(/\/+/g, '/').replace(/\/$/, '');

      if (!full.startsWith('/api/v1/')) {
        skipped.push(`${full || '(empty)'} (not under /api/v1)`);
        continue;
      }

      const rel = full.slice('/api/v1'.length);

      if (rel.startsWith('/supplier-portal/')) {
        skipped.push(`${rel} (supplier portal session)`);
        continue;
      }

      if (seen.has(rel)) continue;

      seen.add(rel);

      const parsed = params.map(parseParam).filter(Boolean);

      eps.push({
        rel,
        module: rel.split('/').filter(Boolean)[0],
        pathVars: parsed.filter((p) => p.kind === 'path'),
        query: parsed.filter((p) => p.kind === 'query'),
      });
    }
  }

  return { eps, controllers, skipped };
}

/* ------------------------------------------------------------------ */
/* Values and ids                                                      */
/* ------------------------------------------------------------------ */

const pools = { items: [], byKey: new Map() };

function harvest(json, ep) {
  if (json == null || typeof json !== 'object') return;

  const root =
    ep.rel
      .split('/')
      .filter((s) => s && !s.startsWith('{'))
      .pop() ?? '';

  const walk = (node, container, depth) => {
    if (depth > 6 || node == null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      for (const item of node.slice(0, 15)) walk(item, container, depth + 1);

      return;
    }

    if (typeof node.id === 'string' && UUID_RE.test(node.id) && pools.items.length < 4000) {
      pools.items.push({ module: ep.module, container, id: node.id });
    }

    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string' && UUID_RE.test(value)) {
        if (key !== 'id' && /id$/i.test(key)) {
          const k = key.toLowerCase();

          if (!pools.byKey.has(k)) pools.byKey.set(k, new Set());

          pools.byKey.get(k).add(value);
        }
      } else if (value && typeof value === 'object') {
        walk(value, key, depth + 1);
      }
    }
  };

  walk(json, root, 0);
}

function collectionFor(ep, varName) {
  const segments = ep.rel.split('/').filter(Boolean);
  const at = segments.indexOf(`{${varName}}`);

  for (let i = at - 1; i >= 0; i--) {
    if (!segments[i].startsWith('{')) return segments[i];
  }

  return null;
}

function idCandidates(name, module, collection) {
  const out = [];
  const add = (id) => {
    if (id && !out.includes(id)) out.push(id);
  };
  const keyed = pools.byKey.get(name.toLowerCase());

  if (keyed) [...keyed].slice(0, 2).forEach(add);

  const here = pools.items.filter((i) => i.module === module);
  const stem = collection ? collection.toLowerCase().replace(/s$/, '') : '';

  if (stem) {
    here
      .filter((i) => i.container.toLowerCase().includes(stem))
      .slice(0, 2)
      .forEach((i) => add(i.id));
  }

  here.slice(0, 2).forEach((i) => add(i.id));

  const hint = /supplier/i.test(name)
    ? 'suppliers'
    : /rfq/i.test(name)
      ? 'rfqs'
      : /purchaseorder/i.test(name)
        ? 'purchase-orders'
        : /(purchaserequest|^requestid$)/i.test(name)
          ? 'purchase-requests'
          : /contract/i.test(name)
            ? 'contracts'
            : /invoice/i.test(name)
              ? 'invoices'
              : null;

  if (hint) {
    pools.items
      .filter((i) => i.module === hint)
      .slice(0, 2)
      .forEach((i) => add(i.id));
  }

  pools.items.slice(0, 1).forEach((i) => add(i.id));

  return out.slice(0, 4);
}

function isSearchParam(p) {
  return p.type === 'String' && /^(query|search|q|keyword|term|text)$/i.test(p.name);
}

function valuesFor(p, ep) {
  const t = p.type;

  if (enums.has(t)) return enums.get(t);
  if (t === 'UUID') return idCandidates(p.name, ep.module, null);
  if (/^(int|Integer|long|Long|short|Short)$/.test(t)) return [/year/i.test(p.name) ? String(YEAR) : '1'];
  if (/^(BigDecimal|double|Double|float|Float)$/.test(t)) return ['1'];
  if (/^(boolean|Boolean)$/.test(t)) return ['true'];
  if (t === 'LocalDate') return [TODAY];
  if (t === 'LocalDateTime') return [NOW.toISOString().slice(0, 19)];
  if (/^(Instant|OffsetDateTime|ZonedDateTime)$/.test(t)) return [NOW.toISOString()];
  if (t === 'String') return [/currency/i.test(p.name) ? 'EUR' : 'a'];

  return [];
}

function cartesian(lists, cap) {
  let out = [[]];

  for (const list of lists) {
    const next = [];

    for (const prefix of out) {
      for (const v of list) next.push([...prefix, v]);
    }

    out = next.slice(0, cap);
  }

  return out;
}

function withQuery(rel, entries) {
  const q = new URLSearchParams();

  for (const [k, v] of entries) q.append(k, v);

  const s = q.toString();

  return s ? `${rel}?${s}` : rel;
}

function requiredCombos(ep) {
  const req = ep.query.filter((q) => q.required);
  const lists = req.map((q) => valuesFor(q, ep).slice(0, 8));

  if (lists.some((l) => l.length === 0)) return null;

  return cartesian(lists, 8).map((combo) => req.map((q, i) => [q.name, combo[i]]));
}

function pathValues(ep, v) {
  if (enums.has(v.type)) return enums.get(v.type);
  if (v.type === 'UUID') return idCandidates(v.name, ep.module, collectionFor(ep, v.name));
  if (/^(int|Integer|long|Long)$/.test(v.type)) return ['1'];
  if (v.type === 'String') return ['a'];

  return [];
}

/* ------------------------------------------------------------------ */
/* Calls and verdicts                                                  */
/* ------------------------------------------------------------------ */

const tokens = {};
const calls = [];
let inline = 0;

function verdict(c) {
  if (c.status === 0 || c.status >= 500) return 'ERROR';
  if (c.status >= 200 && c.status < 300) return 'OK';
  if (c.status === 401 || c.status === 403) return 'DENIED';
  if (c.status === 404 && c.kind === 'detail') return 'NODATA';

  if (
    (c.status === 400 || c.status === 404) &&
    (c.kind === 'detail' || c.kind === 'variant') &&
    /does not exist|not found/i.test(c.msg)
  ) {
    return 'NODATA';
  }


  return 'WARN';
}

async function fire(role, kind, ep, url) {
  const r = await http('GET', url, tokens[role]);
  const call = {
    role,
    kind,
    ep: ep.rel,
    url,
    status: r.status,
    msg: r.status === 0 || r.status >= 400 ? problem(r) : '',
  };

  call.verdict = verdict(call);
  calls.push(call);

  const show =
    call.verdict === 'ERROR' ||
    call.verdict === 'WARN' ||
    (role === 'admin' && call.verdict === 'DENIED');

  if (show) {
    if (inline < MAX_INLINE) {
      log(`  ${call.verdict === 'ERROR' ? '✖' : '⚠'} [${role}] ${url} → ${r.status || 'no response'}: ${call.msg}`);
    } else if (inline === MAX_INLINE) {
      log('  … more problems are listed in the grouped summary below');
    }

    inline += 1;
  }

  return r;
}

function group(list, keyFn) {
  const m = new Map();

  for (const c of list) {
    const k = keyFn(c);

    if (!m.has(k)) m.set(k, []);

    m.get(k).push(c);
  }

  return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
}

function printGroups(title, list, limit) {
  log(`\n── ${title} ──`);

  if (!list.length) {
    log('  none');

    return;
  }

  for (const [key, items] of group(list, (c) => `${c.status || 'no response'} ${c.msg.slice(0, 110)}`).slice(0, limit)) {
    log(`  ${items.length}× HTTP ${key}  (${new Set(items.map((i) => i.ep)).size} endpoints)`);

    for (const i of items.slice(0, 3)) log(`      [${i.role}] ${i.url}`);
  }
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  log(`ProcureIQ read sweep — ${API}`);

  const { eps, controllers, skipped } = discover();
  const plainEps = eps.filter((e) => e.pathVars.length === 0);
  const detailEps = eps.filter((e) => e.pathVars.length > 0);
  const cannotRun = [];

  log(`Found ${eps.length} GET endpoints in ${controllers} controllers (${skipped.length} skipped: supplier portal sessions).`);
  log(`  ${plainEps.length} without an id, ${detailEps.length} with an id in the path`);

  for (const [role, email] of [
    ['admin', 'admin@procureiq.local'],
    ['buyer', 'buyer@procureiq.local'],
    ['manager', 'manager@procureiq.local'],
  ]) {
    tokens[role] = await staffLogin(email);
  }

  log('✔ Signed in as admin, buyer and manager');

  log('\n── Pass 1: every endpoint without an id, plain ──');

  for (const ep of plainEps) {
    const combos = requiredCombos(ep);

    if (!combos) {
      cannotRun.push(`${ep.rel} (needs a required value the sweep cannot invent)`);
      continue;
    }

    for (const entries of combos) {
      const r = await fire('admin', 'plain', ep, withQuery(ep.rel, entries));

      harvest(r.json, ep);
    }
  }

  log('\n── Pass 2: parameter variants (blank, wildcard, quote, every enum value) ──');

  for (const ep of plainEps) {
    if (!ep.query.length) continue;

    const combos = requiredCombos(ep);

    if (!combos) continue;

    const base = combos[0];
    const optional = ep.query.filter((q) => !q.required);
    const urls = [];

    for (const p of optional) {
      const values = isSearchParam(p) ? SEARCH_VARIANTS : valuesFor(p, ep).slice(0, 8);

      for (const v of values) urls.push(withQuery(ep.rel, [...base, [p.name, v]]));
    }

    if (optional.length > 1) {
      const all = optional
        .map((p) => [p.name, (isSearchParam(p) ? ['a'] : valuesFor(p, ep))[0]])
        .filter(([, v]) => v !== undefined);

      urls.push(withQuery(ep.rel, [...base, ...all]));
    }

    for (const u of [...new Set(urls)].slice(0, 14)) {
      const r = await fire('admin', 'variant', ep, u);

      harvest(r.json, ep);
    }
  }

  log('\n── Pass 3: detail endpoints with real ids ──');

  for (const ep of detailEps) {
    const lists = ep.pathVars.map((v) => pathValues(ep, v).slice(0, 3));
    const reqs = requiredCombos(ep);

    if (lists.some((l) => l.length === 0) || !reqs) continue;

    for (const combo of cartesian(lists, 6)) {
      let rel = ep.rel;

      ep.pathVars.forEach((v, i) => {
        rel = rel.replace(`{${v.name}}`, encodeURIComponent(combo[i]));
      });

      const r = await fire('admin', 'detail', ep, withQuery(rel, reqs[0]));

      harvest(r.json, ep);
    }
  }

  log('\n── Pass 4: what worked for admin, replayed as buyer and manager ──');

  const replay = [
    ...new Map(
      calls.filter((c) => c.role === 'admin' && c.verdict === 'OK' && c.kind !== 'variant').map((c) => [c.url, c]),
    ).values(),
  ];

  for (const role of ['buyer', 'manager']) {
    for (const c of replay) await fire(role, c.kind, { rel: c.ep }, c.url);
  }

  /* ---------------- Summary ---------------- */

  const counts = (role) => {
    const o = { OK: 0, DENIED: 0, ERROR: 0, WARN: 0, NODATA: 0 };

    for (const c of calls) if (c.role === role) o[c.verdict] += 1;

    return o;
  };

  log('\n── Summary ──');

  for (const role of ['admin', 'buyer', 'manager']) {
    const o = counts(role);

    log(`  ${role.padEnd(8)} ${o.OK} ok, ${o.DENIED} denied, ${o.WARN} unexpected 4xx, ${o.ERROR} server errors`);
  }

  const verified = detailEps.filter((ep) => calls.some((c) => c.role === 'admin' && c.ep === ep.rel && c.verdict === 'OK'));
  const unverified = detailEps.filter((ep) => !verified.includes(ep));

  log(`  Detail endpoints checked with real data: ${verified.length} of ${detailEps.length}`);

  printGroups('Server errors (these fail the sweep)', calls.filter((c) => c.verdict === 'ERROR'), 15);
  printGroups(
    'Unexpected 4xx',
    calls.filter((c) => c.verdict === 'WARN' || (c.role === 'admin' && c.verdict === 'DENIED')),
    10,
  );

  log('\n── Access by role (403 or 401) ──');

  for (const role of ['buyer', 'manager']) {
    const denied = [...new Set(calls.filter((c) => c.role === role && c.verdict === 'DENIED').map((c) => c.ep))];

    log(`  ${role}: denied on ${denied.length} endpoints${denied.length ? ` — ${denied.slice(0, 12).join(', ')}${denied.length > 12 ? ', …' : ''}` : ''}`);
  }

  if (unverified.length) {
    log('\n── Detail endpoints with no usable id (not verified) ──');
    log(`  ${unverified.length}: ${unverified.map((e) => e.rel).slice(0, 40).join(', ')}${unverified.length > 40 ? ', …' : ''}`);
  }

  if (cannotRun.length) {
    log('\n── Not called ──');

    for (const line of cannotRun.slice(0, 15)) log(`  ${line}`);
  }

  const errors = calls.filter((c) => c.verdict === 'ERROR').length;
  const seconds = Math.round((Date.now() - STARTED) / 1000);

  log(
    `\n${errors === 0 ? '✔' : '✖'} ${calls.length} calls in ${seconds}s — ${errors === 0 ? 'no server errors' : `${errors} server errors`}`,
  );

  return errors === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    log(`\n✖ ${error?.message ?? error}`);
    process.exit(2);
  });
