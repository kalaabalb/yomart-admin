import fs from 'node:fs/promises';
import path from 'node:path';
import { isIP } from 'node:net';

const KNOWN_PRODUCTION_API_HOSTS = new Set([
  'yonasmarketplace-backend.onrender.com',
  'ecommerce-backend-api-jet.vercel.app',
]);

const PLACEHOLDER_HOSTS = new Set(['example', 'example.com', 'example.org', 'example.net', 'example.invalid']);

function parseOrigin(value, name, { allowLocalHttp = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required.`);
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error(`${name} must be an absolute HTTP(S) URL.`); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error(`${name} must be a public HTTP(S) origin without credentials, path, query, or fragment.`);
  }
  const host = url.hostname.toLowerCase();
  if (host.includes('*')) throw new Error(`${name} cannot contain wildcard hosts.`);
  if (host.includes('replace-with') || host.includes('placeholder') || host.includes('your-api-domain') || host.endsWith('.example') || PLACEHOLDER_HOSTS.has(host)) {
    throw new Error(`${name} cannot contain a placeholder host.`);
  }
  const normalizedIp = host.replace(/^\[|\]$/g, '');
  const loopback = ['localhost', '::1'].includes(normalizedIp) || host.endsWith('.localhost') ||
    (isIP(normalizedIp) === 4 && Number(normalizedIp.split('.')[0]) === 127);
  if (url.protocol !== 'https:' && !(loopback && allowLocalHttp)) {
    throw new Error(`${name} must use HTTPS; HTTP is allowed only for a deliberate local build.`);
  }
  return { origin: url.origin, hostname: host, loopback };
}

function parseOrigins(value, name, { allowExplicitEmpty = false } = {}) {
  if (typeof value !== 'string') {
    if (allowExplicitEmpty && value === undefined) return new Set();
    throw new Error(`${name} is required for environment separation.`);
  }
  if (!value.trim()) {
    if (allowExplicitEmpty) return new Set();
    throw new Error(`${name} is required for environment separation.`);
  }
  const entries = value.split(',').map((item) => item.trim());
  if (entries.some((item) => !item)) throw new Error(`${name} must contain only valid comma-separated origins.`);
  return new Set(entries.map((item) => parseOrigin(item, name).origin));
}

export function resolveAdminBuildTarget(env) {
  const buildEnv = env.YOMART_BUILD_ENV;
  if (!['local', 'staging', 'production'].includes(buildEnv)) {
    throw new Error('YOMART_BUILD_ENV must be local, staging, or production for an admin build.');
  }
  const api = parseOrigin(env.VITE_API_BASE_URL, 'VITE_API_BASE_URL', {
    allowLocalHttp: buildEnv === 'local' && env.VITE_ALLOW_LOCAL_API === 'true',
  });
  const expected = parseOrigin(env.YOMART_EXPECTED_API_ORIGIN, 'YOMART_EXPECTED_API_ORIGIN', {
    allowLocalHttp: buildEnv === 'local' && env.VITE_ALLOW_LOCAL_API === 'true',
  });
  const site = parseOrigin(env.VITE_EXPECTED_SITE_ORIGIN, 'VITE_EXPECTED_SITE_ORIGIN', {
    allowLocalHttp: buildEnv === 'local' && env.VITE_ALLOW_LOCAL_API === 'true',
  });
  if (api.origin !== expected.origin) throw new Error('VITE_API_BASE_URL must match YOMART_EXPECTED_API_ORIGIN.');
  if (buildEnv === 'local' && !site.loopback) throw new Error('Local admin builds must target a loopback site origin.');
  if (buildEnv !== 'local' && site.loopback) throw new Error(`${buildEnv} admin builds cannot target a localhost site origin.`);
  if (buildEnv === 'local' && !api.loopback) throw new Error('Local admin builds must target a loopback API.');
  if (buildEnv !== 'local' && api.loopback) throw new Error(`${buildEnv} admin builds cannot target localhost.`);

  if (buildEnv === 'staging') {
    // Render may omit an entirely blank dashboard variable. In that case the
    // owner must explicitly assert that no production API exists. A literal
    // empty list is also accepted. Non-empty lists always use strict parsing.
    const noProductionApi = env.YOMART_NO_PRODUCTION_API;
    if (noProductionApi !== undefined && !['true', 'false'].includes(noProductionApi)) {
      throw new Error('YOMART_NO_PRODUCTION_API must be true or false when set.');
    }
    const productionApiList = env.YOMART_PRODUCTION_API_ORIGINS;
    if (noProductionApi === 'true' && typeof productionApiList === 'string' && productionApiList.trim()) {
      throw new Error('YOMART_NO_PRODUCTION_API=true cannot be combined with production API origins.');
    }
    const explicitlyEmptyList = typeof productionApiList === 'string' && !productionApiList.trim();
    const denied = parseOrigins(productionApiList, 'YOMART_PRODUCTION_API_ORIGINS', {
      allowExplicitEmpty: noProductionApi === 'true' || explicitlyEmptyList,
    });
    for (const host of KNOWN_PRODUCTION_API_HOSTS) denied.add(`https://${host}`);
    if (denied.has(api.origin)) throw new Error('A production API origin cannot be used for a staging admin build.');
  }
  if (buildEnv === 'production') {
    const stagingOrigins = parseOrigins(env.YOMART_STAGING_API_ORIGINS, 'YOMART_STAGING_API_ORIGINS');
    if (stagingOrigins.has(api.origin)) throw new Error('A staging API origin cannot be used for a production admin build.');
  }
  if (buildEnv === 'staging') {
    const deniedSites = parseOrigins(env.YOMART_PRODUCTION_SITE_ORIGINS, 'YOMART_PRODUCTION_SITE_ORIGINS');
    if (deniedSites.has(site.origin)) throw new Error('A production site origin cannot be used for a staging admin build.');
  }
  if (buildEnv === 'production') {
    const stagingSites = parseOrigins(env.YOMART_STAGING_SITE_ORIGINS, 'YOMART_STAGING_SITE_ORIGINS');
    if (stagingSites.has(site.origin)) throw new Error('A staging site origin cannot be used for a production admin build.');
  }
  return Object.freeze({ buildEnv, apiOrigin: api.origin, siteOrigin: site.origin });
}

export async function applyAdminStagingNoIndex(outputDirectory, target) {
  if (target.buildEnv !== 'staging') return;
  const indexPath = path.join(outputDirectory, 'index.html');
  const indexHtml = await fs.readFile(indexPath, 'utf8');
  if (!/<\/head\s*>/i.test(indexHtml)) throw new Error('Staging admin index.html is missing its head element.');
  const robotsMeta = /<meta\b(?=[^>]*\bname\s*=\s*['"]robots['"])[^>]*>/gi;
  const protectedHtml = indexHtml.replace(robotsMeta, '').replace(
    /<\/head\s*>/i,
    '<meta name="robots" content="noindex,nofollow,noarchive">\n</head>',
  );
  await fs.writeFile(indexPath, protectedHtml, 'utf8');
}

export async function validateAdminArtifact(outputDirectory, target) {
  const files = [];
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile() && /\.(?:js|html|css|json|txt)$/i.test(entry.name)) files.push(file);
    }
  }
  await visit(outputDirectory);
  const sources = await Promise.all(files.map((file) => fs.readFile(file, 'utf8')));
  if (target.buildEnv === 'staging') {
    const indexPath = path.join(outputDirectory, 'index.html');
    const indexHtml = await fs.readFile(indexPath, 'utf8').catch(() => '');
    const directives = [...indexHtml.matchAll(/<meta\b(?=[^>]*\bname\s*=\s*['"]robots['"])[^>]*>/gi)].map((match) => match[0]);
    if (directives.length !== 1 || !/\bcontent\s*=\s*['"]noindex\s*,\s*nofollow\s*,\s*noarchive['"]/i.test(directives[0])) {
      throw new Error('Staging admin artifact must contain one noindex robots directive in index.html.');
    }
  }
  if (!sources.some((source) => source.includes(target.apiOrigin))) {
    throw new Error('Built admin artifact does not contain the validated API origin.');
  }
  if (!sources.some((source) => source.includes(target.siteOrigin))) {
    throw new Error('Built admin artifact does not contain the validated site origin.');
  }
  const localEndpoint = /https?:\/\/(?:localhost|[^/\s"'\\]*\.localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d+)?/i;
  const placeholderEndpoint = /REPLACE-WITH-YOUR-API-DOMAIN|https?:\/\/(?:your-api-domain|placeholder(?:\.[^/\s"']+)?|[^/\s"']*\.example(?:[:/]|$)|example\.(?:com|org|net|invalid))/i;
  for (let index = 0; index < sources.length; index += 1) {
    if (target.buildEnv !== 'local' && localEndpoint.test(sources[index])) throw new Error(`Built admin artifact contains a localhost endpoint: ${path.relative(outputDirectory, files[index])}.`);
    if (placeholderEndpoint.test(sources[index])) throw new Error(`Built admin artifact contains a placeholder endpoint: ${path.relative(outputDirectory, files[index])}.`);
  }
  return { files: files.length };
}
