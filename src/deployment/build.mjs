#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';
import { applyAdminStagingNoIndex, resolveAdminBuildTarget, validateAdminArtifact } from './build_target.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outputDirectory = path.join(projectRoot, 'dist');

export async function buildAdmin(env = process.env, { runVite = true, outputPath = outputDirectory } = {}) {
  // Clear stale output even when preflight fails. A failed build must not leave
  // a previous environment's bundle available to publish by mistake.
  await fs.rm(outputPath, { recursive: true, force: true });
  try {
    const target = resolveAdminBuildTarget(env);
    if (runVite) {
      const viteCli = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
      const result = spawnSync(process.execPath, [viteCli, 'build'], {
        cwd: projectRoot,
        env,
        stdio: 'inherit',
      });
      if (result.error) throw new Error(`Could not start Vite: ${result.error.message}`);
      if (result.status !== 0) throw new Error(`Admin build failed with exit code ${result.status ?? 'unknown'}.`);
    }
    await applyAdminStagingNoIndex(outputPath, target);
    const artifactReport = await validateAdminArtifact(outputPath, target);
    return { target, artifactReport };
  } catch (error) {
    await fs.rm(outputPath, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const mode = process.env.MODE || 'production';
  const fileEnv = loadEnv(mode, projectRoot, '');
  const env = { ...fileEnv, ...process.env };
  buildAdmin(env).then(({ target, artifactReport }) => {
    console.log(`Built and validated ${target.buildEnv} admin artifact for ${target.apiOrigin}.`);
    console.log(`Checked ${artifactReport.files} text artifacts.`);
  }).catch((error) => {
    console.error(`YoMart admin build failed: ${error.message}`);
    process.exitCode = 1;
  });
}
