import { defineConfig } from 'vite';

// base './' so the built bundle works from any static host subpath (itch.io).
export default defineConfig({
  base: './',
});
