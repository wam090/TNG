// Golden-image regression check.
//   npm run shot:check [-- --threshold=0.001]
// Pixel-diffs every shots/golden/*.png against the same-named file in shots/.
// Fails (exit 1) if a golden's counterpart is missing or more than THRESHOLD
// of pixels differ (per-channel tolerance CHANNEL_TOLERANCE). Diff artifacts
// go to shots/diff/. The diff itself runs inside headless Chromium's canvas —
// no image-decoding dependencies needed beyond playwright.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const DEFAULT_THRESHOLD = 0.001; // fail if > 0.1% of pixels differ
const CHANNEL_TOLERANCE = 3; // per-channel |a-b| <= this counts as identical
const SHOTS_DIR = 'shots';
const GOLDEN_DIR = path.join(SHOTS_DIR, 'golden');
const DIFF_DIR = path.join(SHOTS_DIR, 'diff');

let threshold = DEFAULT_THRESHOLD;
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--threshold=')) threshold = Number(a.slice('--threshold='.length));
  else {
    console.error(`unknown argument: ${a}\nusage: npm run shot:check [-- --threshold=0.001]`);
    process.exit(2);
  }
}
if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
  console.error(`--threshold must be a fraction in [0,1], got ${String(threshold)}`);
  process.exit(2);
}

const pngsIn = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')) : [];
const goldens = pngsIn(GOLDEN_DIR);
if (goldens.length === 0) {
  console.error(`no goldens in ${GOLDEN_DIR}/ — run "npm run shot" then "npm run shot:bless"`);
  process.exit(1);
}
for (const f of pngsIn(SHOTS_DIR)) {
  if (!goldens.includes(f)) console.warn(`note: ${SHOTS_DIR}/${f} has no golden (bless to track it)`);
}

function chromiumExecutable() {
  if (process.env.STILLMOTE_CHROMIUM) return process.env.STILLMOTE_CHROMIUM;
  const managed = chromium.executablePath();
  if (managed && fs.existsSync(managed)) return undefined;
  const preinstalled = '/opt/pw-browsers/chromium';
  if (fs.existsSync(preinstalled)) return preinstalled;
  return undefined;
}

const browser = await chromium.launch({ executablePath: chromiumExecutable() });
const page = await browser.newPage();

const toDataUri = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;

let failures = 0;
for (const name of goldens) {
  const currentPath = path.join(SHOTS_DIR, name);
  if (!fs.existsSync(currentPath)) {
    console.error(`FAIL ${name}: golden exists but ${currentPath} is missing — run "npm run shot"`);
    failures += 1;
    continue;
  }

  const result = await page.evaluate(
    async ({ goldenUri, currentUri, tolerance }) => {
      const load = (src) =>
        new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('image decode failed'));
          img.src = src;
        });
      const [golden, current] = await Promise.all([load(goldenUri), load(currentUri)]);
      if (golden.width !== current.width || golden.height !== current.height) {
        return { sizeMismatch: `${golden.width}x${golden.height} vs ${current.width}x${current.height}` };
      }
      const w = golden.width;
      const h = golden.height;
      const read = (img) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const a = read(golden);
      const b = read(current);
      const diffCanvas = document.createElement('canvas');
      diffCanvas.width = w;
      diffCanvas.height = h;
      const diffCtx = diffCanvas.getContext('2d');
      const out = diffCtx.createImageData(w, h);
      let diffCount = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.max(
          Math.abs(a[i] - b[i]),
          Math.abs(a[i + 1] - b[i + 1]),
          Math.abs(a[i + 2] - b[i + 2]),
        );
        if (d > tolerance) {
          diffCount += 1;
          out.data[i] = 255; // changed pixels in red
          out.data[i + 1] = 0;
          out.data[i + 2] = 0;
          out.data[i + 3] = 255;
        } else {
          const dim = Math.round(a[i] * 0.25 + 191); // unchanged pixels washed out
          out.data[i] = dim;
          out.data[i + 1] = dim;
          out.data[i + 2] = dim;
          out.data[i + 3] = 255;
        }
      }
      diffCtx.putImageData(out, 0, 0);
      return {
        total: w * h,
        diffCount,
        diffUrl: diffCount > 0 ? diffCanvas.toDataURL('image/png') : null,
      };
    },
    { goldenUri: toDataUri(path.join(GOLDEN_DIR, name)), currentUri: toDataUri(currentPath), tolerance: CHANNEL_TOLERANCE },
  );

  if (result.sizeMismatch) {
    console.error(`FAIL ${name}: size mismatch ${result.sizeMismatch}`);
    failures += 1;
    continue;
  }
  const fraction = result.diffCount / result.total;
  const pct = (fraction * 100).toFixed(4);
  if (fraction > threshold) {
    fs.mkdirSync(DIFF_DIR, { recursive: true });
    const diffPath = path.join(DIFF_DIR, name);
    fs.writeFileSync(diffPath, Buffer.from(result.diffUrl.split(',')[1], 'base64'));
    console.error(`FAIL ${name}: ${result.diffCount}/${result.total} px differ (${pct}%) — diff: ${diffPath}`);
    failures += 1;
  } else {
    console.log(`ok   ${name}: ${result.diffCount} px differ (${pct}%)`);
  }
}

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} of ${goldens.length} golden(s) FAILED (threshold ${(threshold * 100).toFixed(2)}%)`);
  process.exit(1);
}
console.log(`\nall ${goldens.length} golden(s) match`);
