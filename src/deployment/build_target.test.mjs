import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildAdmin } from './build.mjs';
import { applyAdminStagingNoIndex, resolveAdminBuildTarget, validateAdminArtifact } from './build_target.mjs';

const staging = {
  YOMART_BUILD_ENV: 'staging',
  VITE_API_BASE_URL: 'https://api.stage.yomart.test',
  VITE_EXPECTED_SITE_ORIGIN: 'https://admin.stage.yomart.test',
  YOMART_EXPECTED_API_ORIGIN: 'https://api.stage.yomart.test/',
  YOMART_PRODUCTION_API_ORIGINS: 'https://yonasmarketplace-backend.onrender.com,https://ecommerce-backend-api-jet.vercel.app',
  YOMART_PRODUCTION_SITE_ORIGINS: 'https://admin.prod.yomart.test,https://shop.prod.yomart.test',
};

test('admin staging build uses only its explicit staging API origin', () => {
  assert.deepEqual(resolveAdminBuildTarget(staging), {
    buildEnv: 'staging',
    apiOrigin: 'https://api.stage.yomart.test',
    siteOrigin: 'https://admin.stage.yomart.test',
  });
});

test('admin release build requires explicit target and matching expected origin', () => {
  assert.throws(() => resolveAdminBuildTarget({}), /YOMART_BUILD_ENV must be/);
  assert.throws(() => resolveAdminBuildTarget({ ...staging, VITE_API_BASE_URL: '' }), /VITE_API_BASE_URL is required/);
  assert.throws(() => resolveAdminBuildTarget({ ...staging, YOMART_EXPECTED_API_ORIGIN: '' }), /YOMART_EXPECTED_API_ORIGIN is required/);
  assert.throws(() => resolveAdminBuildTarget({ ...staging, VITE_EXPECTED_SITE_ORIGIN: '' }), /VITE_EXPECTED_SITE_ORIGIN is required/);
  assert.throws(() => resolveAdminBuildTarget({ ...staging, VITE_API_BASE_URL: 'https://other.stage.yomart.test' }), /must match/);
});

test('staging admin rejects local, placeholder and known production endpoints', () => {
  for (const origin of [
    'http://localhost:3000',
    'https://REPLACE-WITH-YOUR-API-DOMAIN',
    'https://api.yomart.example',
    'https://yonasmarketplace-backend.onrender.com',
  ]) {
    assert.throws(() => resolveAdminBuildTarget({
      ...staging,
      VITE_API_BASE_URL: origin,
      YOMART_EXPECTED_API_ORIGIN: origin,
    }));
  }
  assert.throws(() => resolveAdminBuildTarget({ ...staging, VITE_API_BASE_URL: 'https://127.0.0.2', YOMART_EXPECTED_API_ORIGIN: 'https://127.0.0.2' }), /cannot target localhost/);
});

test('environment origin denylists are mandatory and reject malformed entries', () => {
  assert.throws(() => resolveAdminBuildTarget({ ...staging, YOMART_PRODUCTION_API_ORIGINS: '' }), /YOMART_PRODUCTION_API_ORIGINS is required/);
  assert.throws(() => resolveAdminBuildTarget({ ...staging, YOMART_PRODUCTION_API_ORIGINS: 'https://prod.test/path' }), /without credentials, path/);
  assert.throws(() => resolveAdminBuildTarget({
    YOMART_BUILD_ENV: 'production',
    VITE_API_BASE_URL: 'https://api.prod.test',
    VITE_EXPECTED_SITE_ORIGIN: 'https://admin.prod.test',
    YOMART_EXPECTED_API_ORIGIN: 'https://api.prod.test',
    YOMART_STAGING_API_ORIGINS: '',
  }), /YOMART_STAGING_API_ORIGINS is required/);
  assert.throws(() => resolveAdminBuildTarget({ ...staging, YOMART_PRODUCTION_SITE_ORIGINS: '' }), /YOMART_PRODUCTION_SITE_ORIGINS is required/);
  assert.throws(() => resolveAdminBuildTarget({ ...staging, VITE_EXPECTED_SITE_ORIGIN: 'https://admin.prod.yomart.test' }), /production site origin cannot be used/);
  assert.throws(() => resolveAdminBuildTarget({
    YOMART_BUILD_ENV: 'production',
    VITE_API_BASE_URL: 'https://api.prod.yomart.test',
    VITE_EXPECTED_SITE_ORIGIN: 'https://admin.stage.yomart.test',
    YOMART_EXPECTED_API_ORIGIN: 'https://api.prod.yomart.test',
    YOMART_STAGING_API_ORIGINS: 'https://api.stage.yomart.test',
    YOMART_STAGING_SITE_ORIGINS: 'https://admin.stage.yomart.test',
  }), /staging site origin cannot be used/);
});

test('production admin rejects an explicitly listed staging API origin', () => {
  assert.throws(() => resolveAdminBuildTarget({
    YOMART_BUILD_ENV: 'production',
    VITE_API_BASE_URL: 'https://api.stage.yomart.test',
    VITE_EXPECTED_SITE_ORIGIN: 'https://admin.prod.test',
    YOMART_EXPECTED_API_ORIGIN: 'https://api.stage.yomart.test',
    YOMART_STAGING_API_ORIGINS: 'https://api.stage.yomart.test',
    YOMART_STAGING_SITE_ORIGINS: 'https://admin.stage.yomart.test',
  }), /staging API origin cannot be used/);
});

test('admin artifact validation checks target origin and rejects accidental endpoints', async (t) => {
  const target = resolveAdminBuildTarget(staging);
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yomart-admin-artifact-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'app.js'), `const api = "${target.apiOrigin}"; const site = "${target.siteOrigin}";`);
  await fs.writeFile(path.join(directory, 'index.html'), '<!doctype html><html><head><title>YoMart admin</title></head><body></body></html>');
  await applyAdminStagingNoIndex(directory, target);
  assert.deepEqual(await validateAdminArtifact(directory, target), { files: 2 });
  assert.match(await fs.readFile(path.join(directory, 'index.html'), 'utf8'), /name="robots" content="noindex,nofollow,noarchive"/);
  await fs.writeFile(path.join(directory, 'index.html'), '<html><head><meta name="robots" content="index,follow"></head></html>');
  await assert.rejects(validateAdminArtifact(directory, target), /must contain one noindex robots directive/);
  await applyAdminStagingNoIndex(directory, target);
  await fs.writeFile(path.join(directory, 'app.js'), `const api = "${target.apiOrigin}"; const site = "${target.siteOrigin}"; const accidental = "http://localhost:3000";`);
  await assert.rejects(validateAdminArtifact(directory, target), /localhost endpoint/);
  await fs.writeFile(path.join(directory, 'app.js'), `const api = "${target.apiOrigin}"; const site = "${target.siteOrigin}"; const bad = "https://REPLACE-WITH-YOUR-API-DOMAIN";`);
  await assert.rejects(validateAdminArtifact(directory, target), /placeholder endpoint/);
});

test('local admin artifacts permit only the explicitly configured loopback endpoints', async (t) => {
  const target = resolveAdminBuildTarget({
    YOMART_BUILD_ENV: 'local',
    VITE_API_BASE_URL: 'http://127.0.0.1:3000',
    VITE_EXPECTED_SITE_ORIGIN: 'http://localhost:5173',
    YOMART_EXPECTED_API_ORIGIN: 'http://127.0.0.1:3000',
    VITE_ALLOW_LOCAL_API: 'true',
  });
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yomart-admin-local-artifact-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'app.js'), `const api = "${target.apiOrigin}"; const site = "${target.siteOrigin}";`);
  await fs.writeFile(path.join(directory, 'index.html'), '<!doctype html><html><head><title>YoMart admin</title></head><body></body></html>');
  assert.deepEqual(await validateAdminArtifact(directory, target), { files: 2 });

  await fs.writeFile(path.join(directory, 'app.js'), `const api = "${target.apiOrigin}"; const site = "${target.siteOrigin}"; const placeholder = "https://example.invalid";`);
  await assert.rejects(validateAdminArtifact(directory, target), /placeholder endpoint/);
});

test('failed admin preflight removes any previous output artifact', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yomart-admin-stale-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, 'old.js'), 'old release');
  await assert.rejects(buildAdmin({}, { runVite: false, outputPath: directory }));
  await assert.rejects(fs.access(directory));
});
