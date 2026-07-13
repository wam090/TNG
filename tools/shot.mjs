// Deterministic screenshot harness.
//   npm run shot -- --script=idle --frames=0,60,120,240 [--debug]
// Boots a vite dev server, opens the game in headless Chromium with
// ?harness=1, drives it via window.__stillmote.step() (exact fixed sim
// steps — no rAF, no wall clock), and writes shots/<script>_<frame>.png.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const VIEWPORT = { width: 1280, height: 720 }; // fixed for golden stability
const SEED = 1; // explicit so goldens never depend on the in-game default
const DEFAULT_FRAMES = '0,60,120,240';
const SHOTS_DIR = 'shots';

function parseArgs(argv) {
  const args = { script: null, frames: DEFAULT_FRAMES, debug: false };
  for (const a of argv) {
    if (a.startsWith('--script=')) args.script = a.slice('--script='.length);
    else if (a.startsWith('--frames=')) args.frames = a.slice('--frames='.length);
    else if (a === '--debug') args.debug = true;
    else {
      console.error(`unknown argument: ${a}`);
      console.error('usage: npm run shot -- --script=<name> [--frames=0,60,120,240] [--debug]');
      process.exit(2);
    }
  }
  if (!args.script) {
    console.error('missing required --script=<name> (a file in scripts/<name>.json)');
    process.exit(2);
  }
  const frames = [...new Set(args.frames.split(',').map((s) => Number(s)))].sort((a, b) => a - b);
  if (frames.some((f) => !Number.isInteger(f) || f < 0)) {
    console.error(`--frames must be non-negative integers, got: ${args.frames}`);
    process.exit(2);
  }
  return { script: args.script, frames, debug: args.debug };
}

/** Container fallback: use the preinstalled browser when playwright's own isn't downloaded. */
function chromiumExecutable() {
  if (process.env.STILLMOTE_CHROMIUM) return process.env.STILLMOTE_CHROMIUM;
  const managed = chromium.executablePath();
  if (managed && fs.existsSync(managed)) return undefined; // playwright-managed browser installed
  const preinstalled = '/opt/pw-browsers/chromium';
  if (fs.existsSync(preinstalled)) return preinstalled;
  return undefined; // let playwright raise its own descriptive install error
}

const { script, frames, debug } = parseArgs(process.argv.slice(2));
const scriptPath = path.join('scripts', `${script}.json`);
if (!fs.existsSync(scriptPath)) {
  console.error(`no such input script: ${scriptPath}`);
  process.exit(2);
}
const scriptJson = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const maxFrame = frames[frames.length - 1];
if (maxFrame > scriptJson.steps) {
  console.error(
    `warning: max frame ${maxFrame} exceeds script "${script}" steps (${scriptJson.steps}); ` +
      'steps beyond the script run with no input',
  );
}

fs.mkdirSync(SHOTS_DIR, { recursive: true });

const server = await createServer({ logLevel: 'silent', server: { port: 0 } });
await server.listen();
const url = server.resolvedUrls?.local[0];
if (!url) {
  console.error('vite dev server reported no local URL');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: chromiumExecutable(),
  args: ['--enable-unsafe-swiftshader', '--force-color-profile=srgb'],
});
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(`console.error: ${m.text()}`);
});

await page.goto(`${url}?harness=1${debug ? '&debug=1' : ''}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__stillmote !== undefined);
await page.evaluate(
  ({ seed, inputScript }) => {
    window.__stillmote.seed(seed);
    window.__stillmote.input(inputScript);
  },
  { seed: SEED, inputScript: scriptJson },
);

const written = [];
let current = 0;
for (const frame of frames) {
  await page.evaluate((n) => {
    window.__stillmote.step(n);
  }, frame - current);
  current = frame;
  const file = path.join(SHOTS_DIR, `${script}_${frame}.png`);
  await page.screenshot({ path: file });
  written.push(file);
}

const finalState = await page.evaluate(() => window.__stillmote.state());
await browser.close();
await server.close();

if (pageErrors.length > 0) {
  console.error(`page errors during harness run:\n${pageErrors.join('\n')}`);
  process.exit(1);
}
console.log(`script=${script} seed=${SEED} finalState=${JSON.stringify(finalState)}`);
for (const f of written) console.log(`wrote ${f}`);
