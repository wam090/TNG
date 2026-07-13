// Promote current screenshots to goldens.
//   npm run shot:bless
// Copies every shots/*.png into shots/golden/. Warns about stale goldens
// whose current counterpart no longer exists (delete them manually if the
// script/frame was intentionally retired — bless never deletes).
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SHOTS_DIR = 'shots';
const GOLDEN_DIR = path.join(SHOTS_DIR, 'golden');

const current = fs.existsSync(SHOTS_DIR)
  ? fs.readdirSync(SHOTS_DIR).filter((f) => f.endsWith('.png'))
  : [];
if (current.length === 0) {
  console.error(`nothing to bless: no PNGs in ${SHOTS_DIR}/ — run "npm run shot" first`);
  process.exit(1);
}

fs.mkdirSync(GOLDEN_DIR, { recursive: true });
for (const f of current) {
  fs.copyFileSync(path.join(SHOTS_DIR, f), path.join(GOLDEN_DIR, f));
  console.log(`blessed ${path.join(GOLDEN_DIR, f)}`);
}

for (const f of fs.readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.png'))) {
  if (!current.includes(f)) {
    console.warn(`stale golden (no current counterpart): ${path.join(GOLDEN_DIR, f)}`);
  }
}
