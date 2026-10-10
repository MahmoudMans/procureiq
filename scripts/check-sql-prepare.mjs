#!/usr/bin/env node
/**
 * ProcureIQ SQL check: prepares every SQL string the repositories send through JdbcTemplate
 * against the local database, without running it.
 *
 * PREPARE makes PostgreSQL parse and plan a statement (syntax, tables, columns, GROUP BY rules)
 * but executes nothing and changes no data. SQL assembled from text blocks, string literals,
 * constants and no-argument helper methods is rebuilt from the Java source; SQL built any other
 * way is listed as "not checked".
 *
 *   node scripts/check-sql-prepare.mjs
 *
 * Optional environment variables: PROCUREIQ_DB_CONTAINER, PROCUREIQ_DB_USER, PROCUREIQ_DB_NAME
 */
import { appendFileSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const JAVA = join(ROOT, 'backend/src/main/java');
const REPORT = '/tmp/procureiq_sqlcheck_report.txt';
const CONTAINER = process.env.PROCUREIQ_DB_CONTAINER ?? 'procureiq-postgres';
const DB_USER = process.env.PROCUREIQ_DB_USER ?? 'procureiq';
const DB_NAME = process.env.PROCUREIQ_DB_NAME ?? 'procureiq';
const PREPARABLE = /^\s*(?:(?:--[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*(?:SELECT|WITH|INSERT|UPDATE|DELETE|VALUES|MERGE)\b/i;
const UNCLEAR_TYPE = new Set(['42P18', '42P08']);

writeFileSync(REPORT, '');

function log(line = '') {
  console.log(line);
  appendFileSync(REPORT, `${line}\n`);
}

/* ------------------------------------------------------------------ */
/* Reading SQL out of the Java source                                  */
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

function unescapeJava(s) {
  return s
    .replace(/\\\r?\n\s*/g, '')
    .replace(/\\(["'\\])/g, '$1')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');
}

function analyse(file) {
  const text = readFileSync(file, 'utf8');

  if (!/jdbc|template/i.test(text)) return [];

  const memo = new Map();
  const lineAt = (index) => text.slice(0, index).split('\n').length;

  function skipSpace(start) {
    let i = start;

    for (;;) {
      while (i < text.length && /\s/.test(text[i])) i++;

      if (text.startsWith('//', i)) {
        const e = text.indexOf('\n', i);

        i = e < 0 ? text.length : e;
        continue;
      }

      if (text.startsWith('/*', i)) {
        const e = text.indexOf('*/', i + 2);

        i = e < 0 ? text.length : e + 2;
        continue;
      }

      return i;
    }
  }

  function resolveNamed(kind, name, before, depth) {
    if (depth > 12) return { error: 'SQL helpers nested too deeply' };

    let at = -1;

    if (kind === 'call') {
      const m = new RegExp(`\\bString\\s+${name}\\s*\\(\\s*\\)\\s*(?:throws[^{]*)?\\{\\s*return\\s+`).exec(text);

      if (m) at = m.index + m[0].length;
    } else {
      const re = new RegExp(`\\bString\\s+${name}\\s*=\\s*`, 'g');
      let m;
      let first = -1;
      let last = -1;

      while ((m = re.exec(text))) {
        const end = m.index + m[0].length;

        if (first < 0) first = end;
        if (m.index < before) last = end;
      }

      at = last >= 0 ? last : first;
    }

    if (at < 0) return { error: `${name}${kind === 'call' ? '()' : ''} is not a plain SQL string` };

    const key = `${kind}:${name}:${at}`;

    if (memo.has(key)) return memo.get(key);

    memo.set(key, { error: 'circular SQL helper' });

    const result = readExpr(at, depth + 1, at);

    memo.set(key, result);

    return result;
  }

  function readExpr(start, depth, before) {
    let i = start;
    let sql = '';

    for (;;) {
      i = skipSpace(i);

      if (text.startsWith('"""', i)) {
        const nl = text.indexOf('\n', i + 3);
        const close = nl < 0 ? -1 : text.indexOf('"""', nl + 1);

        if (close < 0) return { error: 'unterminated text block' };

        sql += unescapeJava(text.slice(nl + 1, close));
        i = close + 3;
      } else if (text[i] === '"') {
        let j = i + 1;

        while (j < text.length && text[j] !== '"') {
          if (text[j] === '\\') j++;
          j++;
        }

        sql += unescapeJava(text.slice(i + 1, j));
        i = j + 1;
      } else {
        const m = /^([A-Za-z_]\w*)(\s*\(\s*\))?/.exec(text.slice(i, i + 120));

        if (!m) {
          return { error: `unsupported expression near "${text.slice(i, i + 28).replace(/\s+/g, ' ')}"` };
        }

        const r = resolveNamed(m[2] ? 'call' : 'value', m[1], before, depth);

        if (r.error) return r;

        sql += r.sql;
        i += m[0].length;
      }

      i = skipSpace(i);

      if (text[i] === '+') {
        i += 1;
        continue;
      }

      if (',);'.includes(text[i] ?? '')) return { sql, end: i };

      return { error: `SQL is followed by "${text.slice(i, i + 18).replace(/\s+/g, ' ')}" (built at run time)` };
    }
  }

  const sites = [];
  const re =
    /\b(\w*(?:[jJ][dD][bB][cC]|[tT]emplate)\w*)\s*\.\s*(query|queryForObject|queryForList|queryForMap|queryForRowSet|queryForStream|update|batchUpdate|execute)\s*\(/g;
  let m;

  while ((m = re.exec(text))) {
    const site = { file: relative(ROOT, file), line: lineAt(m.index), call: `${m[1]}.${m[2]}` };
    const r = readExpr(m.index + m[0].length, 0, m.index);

    sites.push(r.error ? { ...site, error: r.error } : { ...site, sql: r.sql });
  }

  return sites;
}

/** Turns ? and :name placeholders into $1, $2 ... outside strings, identifiers and comments. */
function toPositional(sql) {
  let out = '';
  let n = 0;
  const names = new Map();
  let i = 0;

  while (i < sql.length) {
    const c = sql[i];

    if (c === "'") {
      let j = i + 1;

      while (j < sql.length) {
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") {
            j += 2;
            continue;
          }

          break;
        }

        j++;
      }

      out += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (c === '"') {
      const j = sql.indexOf('"', i + 1);
      const e = j < 0 ? sql.length - 1 : j;

      out += sql.slice(i, e + 1);
      i = e + 1;
      continue;
    }

    if (c === '-' && sql[i + 1] === '-') {
      const j = sql.indexOf('\n', i);
      const e = j < 0 ? sql.length : j;

      out += sql.slice(i, e);
      i = e;
      continue;
    }

    if (c === '/' && sql[i + 1] === '*') {
      const j = sql.indexOf('*/', i + 2);
      const e = j < 0 ? sql.length : j + 2;

      out += sql.slice(i, e);
      i = e;
      continue;
    }

    if (c === '?') {
      n += 1;
      out += `$${n}`;
      i += 1;
      continue;
    }

    if (c === ':' && sql[i - 1] !== ':' && sql[i + 1] !== ':' && /[A-Za-z_]/.test(sql[i + 1] ?? '')) {
      const name = /^[A-Za-z_]\w*/.exec(sql.slice(i + 1))[0];

      if (!names.has(name)) names.set(name, n + names.size + 1);

      out += `$${names.get(name)}`;
      i += 1 + name.length;
      continue;
    }

    out += c;
    i += 1;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Asking PostgreSQL                                                   */
/* ------------------------------------------------------------------ */

function runBatch(statements) {
  const blocks = statements.map((sql, idx) =>
    [
      'DO $chk$ BEGIN',
      `  EXECUTE 'PREPARE chk AS ' || $sqlchk$${sql}$sqlchk$;`,
      "  EXECUTE 'DEALLOCATE chk';",
      'EXCEPTION WHEN OTHERS THEN',
      `  RAISE NOTICE 'FAIL|${idx}|%|%', SQLSTATE, replace(replace(SQLERRM, E'\\n', ' '), '|', '/');`,
      'END $chk$;',
    ].join('\n'),
  );

  blocks.push("DO $chk$ BEGIN RAISE NOTICE 'DONE|%', 1; END $chk$;");

  const res = spawnSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', DB_USER, '-d', DB_NAME, '-X', '-q', '-v', 'ON_ERROR_STOP=0', '-f', '-'],
    { input: `${blocks.join('\n')}\n`, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
  );
  const out = `${res.stdout ?? ''}\n${res.stderr ?? ''}`;

  if (res.error || !/DONE\|1/.test(out)) {
    throw new Error(
      `psql did not finish (${res.error?.message ?? `exit ${res.status}`}): ${out.replace(/\s+/g, ' ').slice(0, 300)}`,
    );
  }

  const failed = new Map();

  for (const line of out.split('\n')) {
    const m = line.match(/FAIL\|(\d+)\|([0-9A-Z]{5})\|(.*)$/);

    if (m) failed.set(Number(m[1]), { code: m[2], message: m[3].trim() });
  }

  return failed;
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

/** Declares the parameter types PostgreSQL cannot infer when preparing. Used on the checker's copy of the SQL only. */
function assumeTypes(sql) {
  return sql
    .replace(/(CURRENT_DATE\s*[+-]\s*)\$(\d+)/gi, (all, head, n) => `${head}CAST($${n} AS integer)`)
    .replace(/\$(\d+)(\s+IS\s+(?:NOT\s+)?NULL\b)/gi, (all, n, tail) => `CAST($${n} AS text)${tail}`);
}


function firstLine(sql) {
  return (
    sql
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('--'))
      ?.slice(0, 70) ?? ''
  );
}

function main() {
  log(`ProcureIQ SQL check — every SQL string sent through JdbcTemplate, prepared against ${CONTAINER}`);
  log('Nothing is executed and no data is changed.');

  const selfTest = runBatch([
    'SELECT 1 FROM app_users WHERE id = $1',
    'SELECT count(*) FROM app_users GROUP BY id WHERE id = $1',
    'SELECT no_such_column FROM app_users',
  ]);

  if (selfTest.has(0) || selfTest.get(1)?.code !== '42601' || selfTest.get(2)?.code !== '42703') {
    log('✖ The checker failed its own self-test, so its results cannot be trusted.');
    log(`  valid statement rejected: ${selfTest.has(0)}`);
    log(`  bad GROUP BY order: ${selfTest.get(1)?.code ?? 'accepted'} (expected 42601)`);
    log(`  unknown column: ${selfTest.get(2)?.code ?? 'accepted'} (expected 42703)`);

    return 2;
  }

  log('✔ Self-test: valid SQL accepted; a bad GROUP BY order and an unknown column rejected');

  const files = javaFiles(JAVA);
  const sites = files.flatMap(analyse);
  const resolved = sites.filter((s) => s.sql !== undefined);
  const unresolved = sites.filter((s) => s.sql === undefined);
  const distinct = new Map();

  for (const s of resolved) {
    const sql = s.sql.trim().replace(/;+\s*$/, '');

    if (!distinct.has(sql)) distinct.set(sql, []);

    distinct.get(sql).push(s);
  }

  log(
    `\nFound ${sites.length} JdbcTemplate call sites in ${new Set(sites.map((s) => s.file)).size} files; ` +
      `${resolved.length} rebuilt as SQL (${distinct.size} distinct statements)`,
  );

  const items = [];
  const notPrepared = [];

  for (const [sql, where] of distinct) {
    if (!PREPARABLE.test(sql)) {
      notPrepared.push({ sql, where });
      continue;
    }

    items.push({ sql: toPositional(sql), raw: sql, where });
  }

  const failed = runBatch(items.map((i) => i.sql));
  const RETRYABLE = new Set(['42883', '42725', '42P18', '42P08']);
  const retry = [];

  items.forEach((item, idx) => {
    const f = failed.get(idx);

    if (!f || !RETRYABLE.has(f.code)) return;

    const typed = assumeTypes(item.sql);

    if (typed !== item.sql) retry.push({ idx, typed });
  });

  const retried = retry.length ? runBatch(retry.map((r) => r.typed)) : new Map();
  const assumed = [];
  const rejected = [];
  const unclear = [];

  items.forEach((item, idx) => {
    let f = failed.get(idx);

    if (!f) return;

    const at = retry.findIndex((r) => r.idx === idx);

    if (at >= 0) {
      const again = retried.get(at);

      if (!again) {
        assumed.push({ ...item, ...f });
        return;
      }

      f = again;
    }

    (UNCLEAR_TYPE.has(f.code) ? unclear : rejected).push({ ...item, ...f });
  });

  const valid = items.length - rejected.length - unclear.length - assumed.length;

  log('\n── Result ──');
  log(`  ✔ ${valid} statements accepted by PostgreSQL`);
  log(`  ✔ ${assumed.length} accepted once parameter types were declared (listed below)`);
  log(`  ${rejected.length ? '✖' : '✔'} ${rejected.length} rejected`);
  log(`  ? ${unclear.length} could not be checked (PostgreSQL cannot infer a parameter type)`);
  log(`  – ${notPrepared.length} not prepared (not SELECT / INSERT / UPDATE / DELETE)`);
  log(`  – ${unresolved.length} call sites build their SQL at run time and were not checked`);

  if (assumed.length) {
    log('\n── Accepted once parameter types were declared (date ± integer, IS NULL as text) ──');

    for (const a of assumed.slice(0, 30)) {
      log(`  ${a.where[0].file}:${a.where[0].line} — ${firstLine(a.raw)}`);
    }
  }

  if (rejected.length) {
    log('\n── Rejected statements ──');

    const groups = new Map();

    for (const r of rejected) {
      const key = `${r.code} ${r.message}`.slice(0, 140);

      if (!groups.has(key)) groups.set(key, []);

      groups.get(key).push(r);
    }

    for (const [key, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
      log(`  ${list.length}× ${key}`);

      for (const r of list.slice(0, 6)) {
        const w = r.where[0];

        log(`      ${w.file}:${w.line} (${w.call}) — ${firstLine(r.raw)}${r.where.length > 1 ? `  [+${r.where.length - 1} more sites]` : ''}`);
      }
    }
  }

  if (unclear.length) {
    log('\n── Could not be checked: parameter type unclear (first 8) ──');

    for (const r of unclear.slice(0, 8)) log(`  ${r.where[0].file}:${r.where[0].line} — ${firstLine(r.raw)}`);
  }

  if (unresolved.length) {
    log('\n── Not checked: SQL built at run time ──');

    const byFile = new Map();

    for (const s of unresolved) byFile.set(s.file, [...(byFile.get(s.file) ?? []), s]);

    for (const [file, list] of [...byFile].sort((a, b) => b[1].length - a[1].length).slice(0, 12)) {
      log(`  ${list.length}× ${file} — ${list[0].error.slice(0, 90)}`);
    }

    if (byFile.size > 12) log(`  … and ${byFile.size - 12} more files`);
  }

  log(`\n${rejected.length === 0 ? '✔ No SQL problems found' : `✖ ${rejected.length} statements are rejected by PostgreSQL`}`);

  return rejected.length === 0 ? 0 : 1;
}

try {
  process.exit(main());
} catch (error) {
  log(`\n✖ ${error?.message ?? error}`);
  process.exit(2);
}
