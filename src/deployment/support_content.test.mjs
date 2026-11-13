import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Help & Support management uses authenticated backend CRUD and confirmation', async () => {
  const source = await readFile(new URL('../SupportContentManager.jsx', import.meta.url), 'utf8');
  for (const endpoint of ['/support-content/admin', "'/support-content'", '/support-content/${encodeURIComponent(editing)}', '/support-content/${encodeURIComponent(_id)}']) assert.ok(source.includes(endpoint), `missing ${endpoint}`);
  assert.match(source, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.match(source, /window\.confirm\(/);
  assert.match(source, /isActive/);
  assert.match(source, /plain text only/i);
});

test('Help content navigation is restricted to authorized admin roles and wired to the manager', async () => {
  const source = await readFile(new URL('../main.jsx', import.meta.url), 'utf8');
  assert.match(source, /id:'support-content'.*adminOnly:true/);
  assert.match(source, /activePage==='support-content'\?<SupportContentManager/);
});
