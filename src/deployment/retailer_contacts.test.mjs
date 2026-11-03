import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

test('admin contact manager uses the protected API routes and confirmation before deletion', async () => {
  const source = await readFile(new URL('../RetailerContactsManager.jsx', import.meta.url), 'utf8');
  assert.match(source, /\/retailer-contacts\/admin/);
  assert.match(source, /window\.confirm\(/);
  assert.match(source, /method: editing \? 'PUT' : 'POST'/);
  assert.match(source, /method: 'DELETE'/);
  assert.match(source, /isActive: !row\.isActive/);
});

test('contact types and placements are configuration choices, not retailer details', async () => {
  const source = await readFile(fileURLToPath(new URL('../RetailerContactsManager.jsx', import.meta.url)), 'utf8');
  for (const key of ['phone', 'telegram', 'whatsapp', 'email', 'website', 'other', 'product_details', 'support_page', 'storefront_footer', 'all']) assert.ok(source.includes(key));
  assert.doesNotMatch(source, /@yomart|\+251\s?9\d{2}/i);
});
