import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveAdminBuildTarget } from './src/deployment/build_target.mjs';

export default defineConfig(({ mode, command }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const buildEnv = { ...fileEnv, ...process.env };
  if (command === 'build') {
    resolveAdminBuildTarget(buildEnv);
  }

  return { plugins: [react()], server: { port: 5173 } };
});
