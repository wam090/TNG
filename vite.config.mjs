// Vite config. Plain JS (not .ts) because it shells out to git for the build id and
// the project deliberately has no @types/node (no new dependencies — CLAUDE.md rule 1).
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/** Short commit hash, "-dirty" if the tree has uncommitted changes, "unknown" outside git. */
function buildId() {
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return dirty ? `${hash}-dirty` : hash;
  } catch {
    return 'unknown';
  }
}

// base './' so the built bundle works from any static host subpath (itch.io).
export default defineConfig({
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
  },
});
