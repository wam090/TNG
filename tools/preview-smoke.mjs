// Private-preview smoke test (WO-004 C2/C3/C4).
//   npm run preview:smoke
// Builds the itch.io zip, extracts it, serves it from an itch-like SUBPATH, and
// boots it in headless Chromium twice:
//   1. embedded in an iframe at 1280×720 (how itch.io shows it) → must render a frame;
//   2. opened directly with ?debug=1 → the F1 overlay must be visible and name the build.
// Fails on ANY console error or uncaught exception. Needs the system `unzip`.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { buildPreviewZip } from './preview-zip.mjs';

const SUBPATH = '/html/0000000/'; // itch.io serves uploads from html.itch.zone/html/<id>/
const EMBED = { width: 1280, height: 720 };
const BOOT_WAIT_MS = 2000;
const MIN_COLOURS = 12; // a blank or failed canvas is one flat sky colour
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

function chromiumExecutable() {
  if (process.env.STILLMOTE_CHROMIUM) return process.env.STILLMOTE_CHROMIUM;
  const managed = chromium.executablePath();
  if (managed && fs.existsSync(managed)) return undefined;
  const preinstalled = '/opt/pw-browsers/chromium';
  return fs.existsSync(preinstalled) ? preinstalled : undefined;
}

function serve(root) {
  const host = `<!doctype html><title>itch-like host</title><link rel="icon" href="data:,"><body style="margin:0;background:#111">
    <iframe id="game" src="${SUBPATH}index.html" width="${EMBED.width}" height="${EMBED.height}" style="border:0"></iframe></body>`;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html' }).end(host);
      return;
    }
    if (!url.pathname.startsWith(SUBPATH)) {
      res.writeHead(404).end();
      return;
    }
    const file = path.join(root, decodeURIComponent(url.pathname.slice(SUBPATH.length)) || 'index.html');
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** Count distinct (quantised) colours in a PNG, decoded inside the browser — no image deps. */
async function colourCount(page, png) {
  return page.evaluate(async (dataUri) => {
    const img = new Image();
    img.src = dataUri;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < px.length; i += 4) seen.add(((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4));
    return seen.size;
  }, `data:image/png;base64,${png.toString('base64')}`);
}

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};

const { zip, buildId } = await buildPreviewZip();
const listing = execFileSync('unzip', ['-Z1', zip]).toString().split('\n').filter(Boolean);
check(listing.includes('index.html'), `zip has index.html at its root (${path.basename(zip)}, ${listing.length} files)`);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stillmote-preview-'));
execFileSync('unzip', ['-q', zip, '-d', root]);
const server = await serve(root);
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({
  executablePath: chromiumExecutable(),
  args: ['--enable-unsafe-swiftshader', '--force-color-profile=srgb'],
});
try {
  // 1. Embedded in an iframe from a subpath, like itch.io.
  const page = await browser.newPage({ viewport: { width: EMBED.width + 40, height: EMBED.height + 40 } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(`${base}/`, { waitUntil: 'load' });
  const frame = page.frame({ url: (u) => u.pathname.startsWith(SUBPATH) });
  check(frame !== null, `game loads inside an iframe from ${SUBPATH}`);
  if (frame) {
    await frame.waitForSelector('canvas', { timeout: 10_000 });
    await page.waitForTimeout(BOOT_WAIT_MS);
    const shot = await (await page.$('#game')).screenshot();
    const colours = await colourCount(page, shot);
    check(colours >= MIN_COLOURS, `renders a frame (${colours} distinct colours in the embed, need ≥ ${MIN_COLOURS})`);
    fs.mkdirSync('preview', { recursive: true });
    fs.writeFileSync(path.join('preview', 'smoke-embed.png'), shot);
  }
  check(errors.length === 0, `no console errors or exceptions in the embed${errors.length ? `:\n  ${errors.join('\n  ')}` : ''}`);

  // 2. The raw game URL with ?debug=1 (what a phone tester opens — no F-keys there).
  const direct = await browser.newPage({ viewport: EMBED });
  const directErrors = [];
  direct.on('console', (m) => {
    if (m.type() === 'error') directErrors.push(`console.error: ${m.text()}`);
  });
  direct.on('pageerror', (e) => directErrors.push(`pageerror: ${e.message}`));
  await direct.goto(`${base}${SUBPATH}index.html?debug=1`, { waitUntil: 'load' });
  await direct.waitForTimeout(BOOT_WAIT_MS);
  const overlay = await direct.evaluate(() => {
    const panel = [...document.querySelectorAll('div')].find((d) => (d.textContent ?? '').startsWith('build'));
    return panel ? { text: panel.textContent ?? '', visible: getComputedStyle(panel.parentElement ?? panel).display !== 'none' } : null;
  });
  check(overlay?.visible === true, '?debug=1 shows the F1 stats overlay in the production build');
  check((overlay?.text ?? '').includes(buildId), `F1 overlay names the build (${buildId})`);
  check(directErrors.length === 0, `no console errors or exceptions with ?debug=1${directErrors.length ? `:\n  ${directErrors.join('\n  ')}` : ''}`);
} finally {
  await browser.close();
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`\npreview:smoke FAILED (${failures.length})`);
  process.exit(1);
}
console.log(`\npreview:smoke passed — ${path.relative(process.cwd(), zip)} boots from a subpath (frame: preview/smoke-embed.png)`);
