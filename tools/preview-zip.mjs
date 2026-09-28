// Private-preview package for itch.io (WO-004 C1).
//   npm run preview:zip
// Clean production build → preview/stillmote-<build>.zip with index.html at the
// zip root (itch.io's HTML5 requirement). Uses the system `zip` (Info-ZIP) — no
// npm dependency; install it with your OS package manager if it is missing.
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const DIST = 'dist';
const OUT_DIR = 'preview';

function buildIdFromGit() {
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return dirty ? `${hash}-dirty` : hash;
  } catch {
    return 'unknown';
  }
}

/** Build from clean and zip it. Returns { zip, buildId, bytes }. */
export async function buildPreviewZip() {
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
  } catch {
    throw new Error('the system `zip` command is required (e.g. `brew install zip` / `apt install zip`)');
  }
  fs.rmSync(DIST, { recursive: true, force: true });
  await build({ logLevel: 'warn' });
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`${DIST}/index.html missing after build`);

  const buildId = buildIdFromGit();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const zip = path.resolve(OUT_DIR, `stillmote-${buildId}.zip`);
  fs.rmSync(zip, { force: true });
  // Zip the CONTENTS of dist/ so index.html sits at the zip root. -X: no extra
  // file attributes, so the same tree zips the same way every time.
  execFileSync('zip', ['-r', '-X', '-q', zip, '.'], { cwd: DIST });
  return { zip, buildId, bytes: fs.statSync(zip).size };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const { zip, buildId, bytes } = await buildPreviewZip();
    if (buildId.endsWith('-dirty')) {
      console.warn('warning: the working tree has uncommitted changes — testers will see a "-dirty" build id');
    }
    console.log(`wrote ${path.relative(process.cwd(), zip)} (${(bytes / 1024).toFixed(0)} KiB, build ${buildId})`);
    console.log('next: upload it to the RESTRICTED itch.io page as an HTML5 game (README → Preview build)');
  } catch (e) {
    console.error(`preview:zip failed: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}
