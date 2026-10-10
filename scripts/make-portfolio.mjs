#!/usr/bin/env node
/**
 * ProcureIQ portfolio generator: screenshots every screen, describes each one from its own content
 * and collects the project facts into a portfolio/ folder.
 *
 *   node scripts/make-portfolio.mjs
 *   PORTFOLIO_MAX=3 node scripts/make-portfolio.mjs           quick trial: only the first 3 screens
 *   PORTFOLIO_ONLY=purchase node scripts/make-portfolio.mjs   only routes that contain "purchase"
 *
 * Needs the backend (port 8080) and the frontend dev server (port 3000) running locally.
 * Playwright is loaded from PLAYWRIGHT_DIR (default ~/.cache/procureiq-e2e) and drives the
 * installed Google Chrome. Nothing is written outside portfolio/ (and the demo seed state in /tmp).
 *
 * Optional environment variables:
 *   API_BASE_URL, FRONTEND_URL   must be localhost addresses
 *   SMOKE_STAFF_PASSWORD         default is the demo password
 *   PORTFOLIO_SCALE              screenshot scale, default 1 (2 gives sharper but much larger files)
 *   PORTFOLIO_HEADED=1           watch the browser work
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = (process.env.API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '');
const FRONTEND = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const STAFF_EMAIL = 'admin@procureiq.local';
const STAFF_PASSWORD = process.env.SMOKE_STAFF_PASSWORD ?? 'ProcureIQ!Demo2026';
const PORTAL_PASSWORD = 'Demo-Portal-2026!x'; // the password the seed script gives its supplier login
const PW_DIR = process.env.PLAYWRIGHT_DIR ?? path.join(homedir(), '.cache', 'procureiq-e2e');
const OUT = path.join(ROOT, 'portfolio');
const SHOTS = path.join(OUT, 'screenshots');
const SEED_SCRIPT = path.join(ROOT, 'scripts', 'seed-supplier-po-demo.mjs');
const STATE = '/tmp/procureiq_demo_seed.json';
const STATE_BEFORE = '/tmp/procureiq_demo_seed.before-portfolio.json';
const VIEW = { width: 1440, height: 900 };
const MAX_HEIGHT = 2400;
const SCALE = Number(process.env.PORTFOLIO_SCALE ?? 1) || 1;
const ONLY = (process.env.PORTFOLIO_ONLY ?? '').trim().toLowerCase();
const LIMIT = Number.parseInt(process.env.PORTFOLIO_MAX ?? '0', 10) || 0;
const HEADED = process.env.PORTFOLIO_HEADED === '1';
const PARTIAL = Boolean(ONLY || LIMIT);
const STARTED = Date.now();
const HIDE_CSS = 'nextjs-portal { display: none !important; }';

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
  process.exit(2);
}

const log = (...parts) => console.log(...parts);
const heading = (title) => log(`\n── ${title} ──`);
const code = (text) => `\`${text}\``;

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
    .slice(0, 2)
    .join(' | ')
    .slice(0, 220);
}

const pathOf = (url) => new URL(url, FRONTEND).pathname.replace(/\/+$/, '') || '/';
const readText = (relative) => {
  try {
    return readFileSync(path.join(ROOT, relative), 'utf8');
  } catch {
    return '';
  }
};

function sh(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    }).trim();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

function discoverRoutes() {
  const appDir = path.join(ROOT, 'frontend', 'src', 'app');
  const found = [];

  const walk = (dir, segments) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === 'api' || entry.name.startsWith('_') || entry.name.startsWith('@')) {
          continue;
        }

        const isGroup = /^\(.*\)$/.test(entry.name);

        walk(path.join(dir, entry.name), isGroup ? segments : [...segments, entry.name]);
      } else if (/^page\.(tsx|ts|jsx|js)$/.test(entry.name)) {
        found.push(`/${segments.join('/')}`);
      }
    }
  };

  walk(appDir, []);

  return [...new Set(found)].sort();
}

const AUTH_ROUTES = new Set(['/login', '/supplier-portal/login', '/supplier-portal/activate']);

function areaOf(route) {
  if (AUTH_ROUTES.has(route)) return 'public';
  if (route === '/supplier-portal' || route.startsWith('/supplier-portal/')) return 'supplier-portal';

  return 'staff';
}

const AREAS = [
  ['public', 'Sign-in screens'],
  ['staff', 'Procurement workspace'],
  ['supplier-portal', 'Supplier portal'],
];

/* ------------------------------------------------------------------ */
/* Browser helpers                                                     */
/* ------------------------------------------------------------------ */

let browser = null;

async function launchBrowser() {
  const options = { headless: !HEADED, slowMo: HEADED ? 150 : 0 };

  try {
    return await chromium.launch({ ...options, channel: 'chrome' });
  } catch (first) {
    try {
      return await chromium.launch(options);
    } catch (second) {
      throw new Error(`neither Google Chrome nor Playwright's Chromium could start (${shorten(first)} / ${shorten(second)})`);
    }
  }
}

async function newContext() {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: SCALE });

  context.setDefaultTimeout(15000);
  context.setDefaultNavigationTimeout(90000);

  await context.addInitScript(() => {
    const add = () => {
      const style = document.createElement('style');

      style.textContent = 'nextjs-portal { display: none !important; }';
      (document.head ?? document.documentElement).appendChild(style);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', add);
    } else {
      add();
    }
  });

  return context;
}

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

async function settle(page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 4000 });
  } catch {
    // Pages that keep polling never go idle; carry on.
  }

  const deadline = Date.now() + 5000;

  while (Date.now() < deadline) {
    let loading = false;

    try {
      loading = await page.evaluate(() => /\bLoading\b[^\n]{0,40}(\.{3}|…)/i.test(document.body.innerText));
    } catch {
      loading = false;
    }

    if (!loading) break;

    await page.waitForTimeout(300);
  }

  await page.waitForTimeout(600);
}

async function shoot(page, file, height) {
  if (height <= MAX_HEIGHT) {
    await page.screenshot({ path: file, fullPage: true, animations: 'disabled', caret: 'hide' });

    return;
  }

  await page.setViewportSize({ width: VIEW.width, height: MAX_HEIGHT });

  try {
    await page.waitForTimeout(250);
    await page.screenshot({ path: file, animations: 'disabled', caret: 'hide' });
  } finally {
    await page.setViewportSize(VIEW);
  }
}

/** Runs inside the page: reads what the screen says about itself. */
function extractPage() {
  const clean = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
  const shown = (element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);

    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
  const chrome = (element) => Boolean(element.closest('nav, aside, header, [role="navigation"]'));
  const unique = (list) => [...new Set(list.filter(Boolean))];

  const scope = document.querySelector('main') ?? document.body;
  const h1 = scope.querySelector('h1') ?? document.querySelector('h1');
  const holder = h1?.parentElement ?? null;
  const eyebrow = holder ? (holder.querySelector('.eyebrow') ?? holder.querySelector(':scope > span')) : null;
  const intro = holder ? (holder.querySelector('p') ?? holder.parentElement?.querySelector('p')) : null;

  const sections = unique(
    [...scope.querySelectorAll('h2')]
      .filter((element) => shown(element) && !chrome(element))
      .map((element) => clean(element.textContent)),
  ).slice(0, 12);

  const tables = [...scope.querySelectorAll('table, [role="table"], [role="grid"]')]
    .filter(shown)
    .slice(0, 4)
    .map((table) => ({
      columns: unique([...table.querySelectorAll('th, [role="columnheader"]')].map((el) => clean(el.textContent))).slice(0, 10),
      rows: [...table.querySelectorAll('tbody tr, [role="row"]')].filter(
        (row) => !row.querySelector('th, [role="columnheader"]'),
      ).length,
    }));

  const actions = unique(
    [...scope.querySelectorAll('button, a.button, a[class*="button"]')]
      .filter((element) => shown(element) && !chrome(element))
      .map((element) => clean(element.textContent))
      .filter((text) => text.length >= 2 && text.length <= 40 && !/^sign out$/i.test(text)),
  ).slice(0, 8);

  return {
    title: clean(h1?.textContent) || clean(document.title),
    eyebrow: clean(eyebrow?.textContent),
    intro: clean(intro?.textContent).slice(0, 400),
    sections,
    tables,
    actions,
    text: clean(document.body.innerText).slice(0, 30000),
  };
}

function flagsFor(meta) {
  const tableRows = meta.tables.reduce((sum, table) => sum + table.rows, 0);

  return {
    error: /(Unable to load|Request failed with status|Application error|This page could not be found|Access restricted|Something went wrong)/i.test(
      meta.text,
    ),
    empty:
      (meta.tables.length > 0 && tableRows === 0) ||
      (meta.tables.length === 0 &&
        meta.sections.length <= 1 &&
        /\bNo [\w\- ]{2,60}\b(yet|found|available|match)/i.test(meta.text)),
    testData: /\b(SMOKE|DEMO)\b/.test(meta.text),
  };
}

function describe(meta) {
  const list = (items) => items.join(', ');
  const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
  const parts = [];

  parts.push(meta.intro ? `${sentence(meta.title)} ${sentence(meta.intro)}` : sentence(meta.title));

  if (meta.sections.length > 0) {
    parts.push(`Sections: ${list(meta.sections.slice(0, 6))}.`);
  }

  const table = meta.tables.find((entry) => entry.columns.length > 0);

  if (table) {
    parts.push(`Data table with columns ${list(table.columns.slice(0, 6))}${table.rows ? ` (${table.rows} rows shown)` : ''}.`);
  }

  if (meta.actions.length > 0) {
    parts.push(`Actions: ${list(meta.actions.slice(0, 5))}.`);
  }

  return parts.join(' ');
}

/* ------------------------------------------------------------------ */
/* Capturing                                                           */
/* ------------------------------------------------------------------ */

const pages = [];
const skipped = [];
const counters = {};
let captured = 0;

function skip(route, area, reason) {
  skipped.push({ route, area, reason });
  log(`  ⚠ ${route} skipped: ${reason}`);
}

async function resolveDynamic(page, route) {
  const segments = route.split('/').filter(Boolean);
  const dynamic = segments.flatMap((segment, index) => (segment.startsWith('[') ? [index] : []));

  if (dynamic.length !== 1) return { reason: 'has more than one dynamic segment' };

  const at = dynamic[0];

  if (segments[at].startsWith('[...') || segments[at].startsWith('[[')) return { reason: 'catch-all route' };
  if (at === 0) return { reason: 'top-level dynamic route' };

  const prefix = `/${segments.slice(0, at).join('/')}`;
  const rest = segments.slice(at + 1);

  await open(page, FRONTEND + prefix);
  await settle(page);

  const hrefs = await page.$$eval('a[href]', (links) => links.map((link) => link.getAttribute('href') ?? ''));
  const pattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([^/?#]+)$`);

  for (const href of hrefs) {
    const match = pattern.exec(href);

    if (match && !['new', 'create', 'edit'].includes(match[1])) {
      return { target: [prefix, match[1], ...rest].join('/'), from: `${prefix}/${match[1]}` };
    }
  }

  return { reason: `no sample record: ${prefix} has nothing to open (empty list or no such page)` };
}

async function visit(page, route, area) {
  if (LIMIT && captured >= LIMIT) return;
  if (ONLY && !route.toLowerCase().includes(ONLY)) return;

  try {
    let target = route;
    let sample = null;

    if (route.includes('[')) {
      const resolved = await resolveDynamic(page, route);

      if (resolved.reason) {
        skip(route, area, resolved.reason);

        return;
      }

      target = resolved.target;
      sample = resolved.from;
    }

    await open(page, FRONTEND + target);
    await settle(page);
    await page.addStyleTag({ content: HIDE_CSS }).catch(() => undefined);

    const finalPath = pathOf(page.url());

    if (finalPath !== pathOf(target)) {
      skip(route, area, `redirects to ${finalPath}`);

      return;
    }

    const meta = await page.evaluate(extractPage);
    const flags = flagsFor(meta);
    const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    const index = String((counters[area] = (counters[area] ?? 0) + 1)).padStart(2, '0');
    const file = `screenshots/${area}/${index}-${slug(route.replace(/[[\]]/g, '')) || 'home'}.png`;

    mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
    await shoot(page, path.join(OUT, file), height);

    const title = meta.title || route;

    pages.push({
      route,
      target,
      area,
      file,
      title,
      eyebrow: meta.eyebrow,
      intro: meta.intro,
      sections: meta.sections,
      tables: meta.tables,
      actions: meta.actions,
      description: describe({ ...meta, title }),
      flags,
      sampleRecord: sample,
      pageHeight: height,
      cropped: height > MAX_HEIGHT,
    });

    captured += 1;

    const notes = [
      flags.error ? 'shows an error' : '',
      flags.empty ? 'looks empty' : '',
      flags.testData ? 'test labels' : '',
    ].filter(Boolean);

    log(`  ✔ ${route} → ${file}${notes.length ? `  (${notes.join(', ')})` : ''}`);
  } catch (error) {
    skip(route, area, shorten(error));
  }
}

/* ------------------------------------------------------------------ */
/* Logins                                                              */
/* ------------------------------------------------------------------ */

let seeded = false;
let seededIds = [];

async function supplierAccount() {
  if (existsSync(STATE)) {
    try {
      const saved = JSON.parse(readFileSync(STATE, 'utf8'));

      if (saved.email) {
        const response = await fetch(`${API}/supplier-portal/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ email: saved.email, password: PORTAL_PASSWORD }),
        });

        if (response.ok) {
          return { email: saved.email, reused: true };
        }
      }
    } catch {
      // Fall through to seeding a fresh login.
    }
  }

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
      .slice(0, 4)
      .map((line) => line.trim());

    throw new Error(`the seed script failed: ${lines.join(' / ') || shorten(error)}`);
  }

  const state = JSON.parse(readFileSync(STATE, 'utf8'));

  seeded = true;
  seededIds = state.accountIds ?? [];

  return { email: state.email, reused: false };
}

function cleanup() {
  if (seeded) {
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

      log('  ✔ Revoked the demo supplier login this run created');
    } catch (error) {
      log(`  ✖ Could not revoke the demo supplier login (${shorten(error)}). Account id(s) still active: ${seededIds.join(', ')}`);
    }
  }

  if (existsSync(STATE_BEFORE)) {
    copyFileSync(STATE_BEFORE, STATE);
    rmSync(STATE_BEFORE, { force: true });
  } else if (seeded) {
    rmSync(STATE, { force: true });
  }
}

async function loginStaff(page) {
  await open(page, `${FRONTEND}/login`);

  const email = page.locator('form input:not([type="password"]):not([type="checkbox"]):not([type="hidden"])').first();
  const password = page.locator('form input[type="password"]');

  await email.fill(STAFF_EMAIL);
  await password.fill(STAFF_PASSWORD);
  await password.press('Enter');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 90000 });
}

async function loginSupplier(page, email) {
  await open(page, `${FRONTEND}/supplier-portal/login`);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PORTAL_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/supplier-portal/home', { timeout: 90000 });
}

async function runArea(label, area, routes, prepare) {
  heading(label);

  if (routes.length === 0) {
    log('  (no screens)');

    return;
  }

  const context = await newContext();
  const page = await context.newPage();

  try {
    if (prepare) {
      try {
        await prepare(page);
      } catch (error) {
        log(`  ✖ Sign-in failed: ${shorten(error)}`);

        for (const route of routes) {
          skipped.push({ route, area, reason: `could not sign in: ${shorten(error)}` });
        }

        return;
      }
    }

    for (const route of routes) {
      await visit(page, route, area);
    }
  } finally {
    await context.close().catch(() => undefined);
  }
}

/* ------------------------------------------------------------------ */
/* Project facts                                                       */
/* ------------------------------------------------------------------ */

function databaseFacts() {
  const container = process.env.PROCUREIQ_DB_CONTAINER ?? 'procureiq-postgres';
  const docker = (args) =>
    execFileSync('docker', ['exec', '-i', container, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  const num = (text) => {
    const value = Number(text);

    return Number.isFinite(value) && text !== '' ? value : null;
  };
  const env = (name, fallback) => {
    try {
      return docker(['printenv', name]) || fallback;
    } catch {
      return fallback;
    }
  };

  try {
    const user = env('POSTGRES_USER', 'procureiq');
    const db = env('POSTGRES_DB', 'procureiq');
    const run = (sql) => docker(['psql', '-U', user, '-d', db, '-q', '-A', '-t', '-c', sql]);

    return {
      tables: num(
        run("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"),
      ),
      appliedMigrations: num(run('SELECT count(*) FROM flyway_schema_history WHERE success')),
    };
  } catch {
    return { tables: null, appliedMigrations: null };
  }
}

function scriptsList() {
  let names = [];

  try {
    names = readdirSync(path.join(ROOT, 'scripts'))
      .filter((name) => /\.(mjs|sh)$/.test(name))
      .sort();
  } catch {
    names = [];
  }

  return names.map((name) => {
    const text = readText(`scripts/${name}`);
    const doc = /\/\*\*\s*\n\s*\*\s*([^\n]+)/.exec(text)?.[1];
    const hash = text.split('\n').find((line, index) => index > 0 && /^#\s*\S/.test(line));
    const summary = (doc ?? hash?.replace(/^#\s*/, '') ?? '').trim();

    return { file: `scripts/${name}`, summary };
  });
}

function collectFacts(routes) {
  const files = (sh('git', ['ls-files', '-z']) ?? '').split('\0').filter(Boolean);
  const matching = (pattern) => files.filter((file) => pattern.test(file));
  const lines = (list) =>
    list.reduce((sum, file) => {
      try {
        return sum + readFileSync(path.join(ROOT, file), 'utf8').split('\n').length;
      } catch {
        return sum;
      }
    }, 0);

  const testFiles = matching(/^backend\/src\/test\/.*\.java$/);
  const testMethods = testFiles.reduce((sum, file) => {
    try {
      return sum + (readFileSync(path.join(ROOT, file), 'utf8').match(/@Test\b/g) ?? []).length;
    } catch {
      return sum;
    }
  }, 0);

  const pom = readText('backend/pom.xml');
  const compose = readText('compose.yaml');
  let pkg = {};

  try {
    pkg = JSON.parse(readText('frontend/package.json'));
  } catch {
    pkg = {};
  }

  const dates = (sh('git', ['log', '--reverse', '--format=%as']) ?? '').split('\n').filter(Boolean);
  const database = databaseFacts();

  return {
    project: 'ProcureIQ',
    generatedAt: new Date().toISOString(),
    git: {
      commits: Number(sh('git', ['rev-list', '--count', 'HEAD'])) || null,
      firstCommit: dates[0] ?? null,
      lastCommit: dates[dates.length - 1] ?? null,
      branch: sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    },
    stack: {
      springBoot: /<parent>[\s\S]*?<artifactId>spring-boot-starter-parent<\/artifactId>\s*<version>([^<]+)<\/version>/.exec(pom)?.[1] ?? null,
      java: /<java\.version>([^<]+)<\/java\.version>/.exec(pom)?.[1] ?? null,
      next: pkg.dependencies?.next ?? null,
      react: pkg.dependencies?.react ?? null,
      typescript: pkg.devDependencies?.typescript ?? pkg.dependencies?.typescript ?? null,
      frontendDependencies: pkg.dependencies ?? {},
      containerImages: [...compose.matchAll(/^\s*image:\s*(\S+)/gm)].map((match) => match[1]),
    },
    counts: {
      backendMainFiles: matching(/^backend\/src\/main\/.*\.java$/).length,
      backendTestFiles: testFiles.length,
      backendTestMethods: testMethods,
      restControllers: matching(/^backend\/src\/main\/.*Controller\.java$/).length,
      migrations: matching(/^backend\/src\/main\/resources\/db\/migration\/V\d+__.*\.sql$/).length,
      databaseTables: database.tables,
      appliedMigrations: database.appliedMigrations,
      frontendScreens: routes.length,
      frontendDynamicScreens: routes.filter((route) => route.includes('[')).length,
      frontendComponents: matching(/^frontend\/src\/components\/.*\.tsx$/).length,
    },
    linesOfCode: {
      java: lines(matching(/\.java$/)),
      typescript: lines(matching(/\.(ts|tsx)$/)),
      sql: lines(matching(/\.sql$/)),
      css: lines(matching(/\.css$/)),
      scripts: lines(matching(/\.(mjs|sh)$/)),
    },
    scripts: scriptsList(),
  };
}

/* ------------------------------------------------------------------ */
/* Writing the folder                                                  */
/* ------------------------------------------------------------------ */

const fmt = (value) => (value === null || value === undefined ? 'n/a' : Number(value).toLocaleString('en-US'));

function galleryMarkdown() {
  const out = [];
  const sparse = (page) => page.flags.error || page.flags.empty;
  const entry = (page) => [
    `#### ${page.title}`,
    '',
    `Route: ${code(page.route)}`,
    '',
    `![${page.title.replace(/[[\]]/g, '')}](${page.file})`,
    '',
    page.description,
    '',
  ];

  for (const [area, label] of AREAS) {
    const mine = pages.filter((page) => page.area === area && !sparse(page));

    if (mine.length === 0) continue;

    out.push(`### ${label}`, '');

    for (const page of mine) out.push(...entry(page));
  }

  const rest = pages.filter(sparse);

  if (rest.length > 0) {
    out.push('### More screens', '', '<details>', '<summary>Screens with little or no data in the demo database</summary>', '');

    for (const page of rest) out.push(...entry(page));

    out.push('</details>', '');
  }

  return out;
}

function readmeMarkdown(facts) {
  const out = [];
  const c = facts.counts;
  const s = facts.stack;
  const loc = facts.linesOfCode;

  out.push('# ProcureIQ: Procurement Intelligence Platform', '');
  out.push(
    '> **To fill in before publishing:** your role, the timeline, a link to the repository and a link to a live demo.',
    '',
  );
  out.push('## Overview', '');
  out.push(
    'ProcureIQ is a full-stack procurement platform. A purchase request is approved, turned into a request for quotation (RFQ), quoted by suppliers through their own portal, evaluated and awarded, and then becomes a purchase order that the supplier acknowledges or rejects. Goods are received against the order and supplier delivery performance is tracked.',
    '',
  );

  const areas = pages.filter((page) => page.area !== 'public' && page.route.split('/').filter(Boolean).length === (page.area === 'supplier-portal' ? 2 : 1));

  if (areas.length > 0) {
    out.push('## Feature areas', '');
    out.push('Derived from the application routes and the headings on each screen.', '');

    for (const page of areas) {
      const where = page.area === 'supplier-portal' ? ' (supplier portal)' : '';

      out.push(`- **${page.title}**${where}${page.intro ? `: ${page.intro}` : ''}`);
    }

    out.push('');
  }

  out.push('## Tech stack', '');
  out.push(`- **Backend:** Spring Boot ${s.springBoot ?? 'n/a'}, Java ${s.java ?? 'n/a'}, PostgreSQL, Flyway migrations`);
  out.push(`- **Frontend:** Next.js ${s.next ?? 'n/a'}, React ${s.react ?? 'n/a'}, TypeScript ${s.typescript ?? 'n/a'}`);

  if (s.containerImages.length > 0) {
    out.push(`- **Local infrastructure:** Docker Compose (${s.containerImages.join(', ')})`);
  }

  out.push('');
  out.push('## By the numbers', '');
  out.push(`- ${fmt(facts.git.commits)} commits, from ${facts.git.firstCommit ?? 'n/a'} to ${facts.git.lastCommit ?? 'n/a'}`);
  out.push(`- ${fmt(c.migrations)} database migrations and ${fmt(c.databaseTables)} tables`);
  out.push(`- ${fmt(c.restControllers)} REST controllers across ${fmt(c.backendMainFiles)} backend source files`);
  out.push(`- ${fmt(c.frontendScreens)} screens (${fmt(c.frontendDynamicScreens)} of them detail pages) built from ${fmt(c.frontendComponents)} components`);
  out.push(`- ${fmt(c.backendTestMethods)} backend test methods in ${fmt(c.backendTestFiles)} test classes`);
  out.push(
    `- About ${fmt(loc.java)} lines of Java, ${fmt(loc.typescript)} of TypeScript, ${fmt(loc.sql)} of SQL, ${fmt(loc.css)} of CSS and ${fmt(loc.scripts)} of scripts`,
  );
  out.push('');

  out.push('## Engineering practices', '');
  out.push('- State changes are guarded in the SQL itself, so they stay correct under concurrent use. For example, a purchase order can be answered by the supplier only once, and cannot be reopened after goods have been received.');
  out.push("- Supplier access is isolated in the API and covered by tests: one supplier cannot see another's quotations or orders, and an unsuccessful bidder is never told who won.");
  out.push('- Tests come in layers: unit tests, PostgreSQL integration tests that each run in a disposable schema, end-to-end API smoke tests, a checker that prepares every repository query against the live database, and a browser test that drives the screens in Chrome.');
  out.push('');

  const scripts = facts.scripts.filter((entry) => entry.summary);

  if (scripts.length > 0) {
    out.push('### Scripts in the repository', '');

    for (const entry of scripts) out.push(`- ${code(entry.file)}: ${entry.summary}`);

    out.push('');
  }

  out.push('## Screens', '');
  out.push(...galleryMarkdown());
  out.push('---', '');
  out.push(
    `Screenshots were captured automatically on ${facts.generatedAt.slice(0, 10)} from a local development build with demo data. Screen descriptions are generated from each page's own headings, tables and buttons.`,
    '',
  );

  return out.join('\n');
}

function reviewMarkdown(facts) {
  const out = [];
  const list = (title, items, line) => {
    out.push(`## ${title}`, '');

    if (items.length === 0) {
      out.push('None.', '');

      return;
    }

    for (const item of items) out.push(line(item));

    out.push('');
  };

  out.push('# Review before publishing', '');
  out.push(
    `Generated ${facts.generatedAt.slice(0, 16).replace('T', ' ')} UTC${PARTIAL ? ' (a partial run: PORTFOLIO_MAX or PORTFOLIO_ONLY was set)' : ''}. Screens were captured in Next.js dev mode with the dev badge hidden.`,
    '',
  );

  list(
    'Screens that show test data (labels containing SMOKE or DEMO)',
    pages.filter((page) => page.flags.testData),
    (page) => `- ${code(page.route)}: ${page.file}`,
  );
  list(
    'Screens that look empty or sparse (a heuristic: a table with no rows, or almost no content)',
    pages.filter((page) => page.flags.empty),
    (page) => `- ${code(page.route)}: ${page.file}`,
  );
  list(
    'Screens that show an error message',
    pages.filter((page) => page.flags.error),
    (page) => `- ${code(page.route)}: ${page.file}`,
  );
  list(
    'Tall screens that were cropped at 2400px',
    pages.filter((page) => page.cropped),
    (page) => `- ${code(page.route)}: page height ${page.pageHeight}px`,
  );
  list('Screens not captured', skipped, (item) => `- ${code(item.route)} (${item.area}): ${item.reason}`);

  out.push('## Checklist', '');
  out.push('- [ ] Fill in the TODO line at the top of the README (role, timeline, links)');
  out.push('- [ ] Look through the screenshots and delete any you do not want to show');
  out.push('- [ ] Replace screens that show SMOKE or DEMO labels, or empty tables, with ones taken on cleaner data');
  out.push('- [ ] Edit the generated descriptions to taste');
  out.push('- [ ] Decide whether to commit this folder (the images add several MB to the repository)', '');

  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  heading('Screens');

  const routes = discoverRoutes();
  const byArea = { public: [], staff: [], 'supplier-portal': [] };

  for (const route of routes) byArea[areaOf(route)].push(route);

  log(
    `  ${routes.length} screens found in frontend/src/app (${byArea.public.length} sign-in, ${byArea.staff.length} workspace, ${byArea['supplier-portal'].length} supplier portal)`,
  );

  if (PARTIAL) {
    log(`  ℹ Partial run: ${LIMIT ? `first ${LIMIT} screens` : ''}${LIMIT && ONLY ? ', ' : ''}${ONLY ? `routes containing "${ONLY}"` : ''}`);
  }

  const backend = await fetch(`${API}/supplier-portal/purchase-orders`).catch(() => null);

  if (!backend || ![400, 401].includes(backend.status)) {
    throw new Error(`the backend did not answer as expected at ${API} (is it running?)`);
  }

  const front = await fetch(`${FRONTEND}/supplier-portal/login`).catch(() => null);

  if (!front || !front.ok) {
    throw new Error(`cannot reach ${FRONTEND}. Start it: cd frontend && npm run dev`);
  }

  rmSync(SHOTS, { recursive: true, force: true });
  mkdirSync(SHOTS, { recursive: true });

  browser = await launchBrowser();

  await runArea('Sign-in screens', 'public', byArea.public, null);
  await runArea('Procurement workspace (signed in as admin)', 'staff', byArea.staff, loginStaff);

  let account = null;

  if (byArea['supplier-portal'].length > 0 && !(LIMIT && captured >= LIMIT)) {
    try {
      account = await supplierAccount();
      log(`\n  ℹ Supplier portal login: ${account.email} (${account.reused ? 'existing demo login' : 'created for this run'})`);
    } catch (error) {
      log(`\n  ✖ No supplier login available: ${shorten(error)}`);
    }
  }

  await runArea(
    'Supplier portal (signed in as the demo supplier)',
    'supplier-portal',
    account ? byArea['supplier-portal'] : [],
    account ? (page) => loginSupplier(page, account.email) : null,
  );

  if (!account && byArea['supplier-portal'].length > 0) {
    for (const route of byArea['supplier-portal']) {
      skipped.push({ route, area: 'supplier-portal', reason: 'no supplier login was available' });
    }
  }

  heading('Project facts');

  const facts = collectFacts(routes);

  log(`  ${fmt(facts.git.commits)} commits, ${fmt(facts.counts.migrations)} migrations, ${fmt(facts.counts.databaseTables)} tables, ${fmt(facts.counts.restControllers)} controllers, ${fmt(facts.counts.backendTestMethods)} backend test methods`);
  log(`  Spring Boot ${facts.stack.springBoot ?? 'n/a'}, Java ${facts.stack.java ?? 'n/a'}, Next.js ${facts.stack.next ?? 'n/a'}, React ${facts.stack.react ?? 'n/a'}`);

  heading('Writing the portfolio folder');

  writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify({ generatedAt: facts.generatedAt, pages, skipped }, null, 2));
  writeFileSync(path.join(OUT, 'project-facts.json'), JSON.stringify(facts, null, 2));
  writeFileSync(path.join(OUT, 'REVIEW.md'), reviewMarkdown(facts));

  const readmeName = PARTIAL || existsSync(path.join(OUT, 'README.md')) ? 'README.generated.md' : 'README.md';

  writeFileSync(path.join(OUT, readmeName), readmeMarkdown(facts));

  log('  ✔ pages.json, project-facts.json, REVIEW.md');
  log(`  ✔ ${readmeName}${readmeName === 'README.generated.md' && !PARTIAL ? ' (README.md already exists and was left untouched)' : ''}`);

  heading('Summary');

  const count = (area) => pages.filter((page) => page.area === area).length;
  const seconds = Math.round((Date.now() - STARTED) / 1000);

  log(`  ${pages.length} screens captured (${count('public')} sign-in, ${count('staff')} workspace, ${count('supplier-portal')} supplier portal), ${skipped.length} skipped, in ${Math.floor(seconds / 60)}m ${seconds % 60}s`);
  log(`  ${pages.filter((page) => page.flags.testData).length} show SMOKE/DEMO labels, ${pages.filter((page) => page.flags.empty).length} look empty, ${pages.filter((page) => page.flags.error).length} show an error message`);
  log(`  Folder: ${OUT}`);
}

let failed = false;

process.on('SIGINT', async () => {
  await browser?.close().catch(() => undefined);
  cleanup();
  process.exit(130);
});

try {
  await main();
} catch (error) {
  failed = true;
  log(`\n■ ${shorten(error)}`);
} finally {
  await browser?.close().catch(() => undefined);
  cleanup();
}

process.exitCode = failed || pages.length === 0 ? 1 : 0;
