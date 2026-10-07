const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadTs(path, dependencies) {
  const output = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { exports: module.exports, module, require: (name) => dependencies[name] ?? require(name), URL, Response, Buffer });
  return module.exports;
}

async function run() {
  const { parseUlasanFile } = loadTs('lib/parser.ts', {});
  const fixture = parseUlasanFile(fs.readFileSync('contoh-data/ulasan-testing-15.csv'), 'test.csv');
  assert.equal(fixture.ulasan.length, 15);
  for (const rating of [5, 3, 1]) assert.equal(fixture.ulasan.filter((row) => row.rating === rating).length, 5);
  assert.ok(fixture.ulasan.every((row) => row.namaPengulas && row.teksUlasan && row.tanggalUlasan));

  let user = { role: 'admin' };
  let parent = [{ status: 'selesai' }];
  let deleted = [{ id: 2 }];
  let available = true;
  let fail = false;
  let queries = [];
  const sql = { begin: async (callback) => callback(async (strings, ...values) => {
    const query = strings.join('?');
    queries.push({ query, values });
    if (fail) throw new Error('Database unavailable');
    if (query.startsWith('SELECT')) return parent;
    if (query.startsWith('DELETE')) return deleted;
    return [];
  }) };
  const { DELETE } = loadTs('app/api/analisis/[id]/ulasan/[ulasanId]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/auth': { getCurrentUser: async () => user, isAdmin: (value) => value?.role === 'admin' },
    '@/lib/db': { getSqlClient: () => available ? sql : null },
  });
  async function check(expected, id = '1', ulasanId = '2', origin = 'http://localhost:3000') {
    queries = [];
    const response = await DELETE(new Request('http://localhost:3000/api/analisis/1/ulasan/2', { method: 'DELETE', headers: { origin } }), { params: Promise.resolve({ id, ulasanId }) });
    assert.equal(response.status, expected);
    return response.json();
  }
  user = null;
  await check(401);
  assert.equal(queries.length, 0);
  user = { role: 'pkrs' };
  await check(403);
  assert.equal(queries.length, 0);
  user = { role: 'admin' };
  await check(403, '1', '2', 'https://other.example');
  for (const value of ['0', '-1', '1.5', 'abc', '9007199254740992']) await check(400, '1', value);
  available = false;
  await check(503);
  available = true;
  parent = [];
  await check(404);
  for (const status of ['menunggu', 'berjalan']) {
    parent = [{ status }];
    await check(409);
    assert.equal(queries.length, 1);
  }
  parent = [{ status: 'selesai' }];
  deleted = [];
  await check(404);
  assert.equal(queries.length, 2);
  deleted = [{ id: 2 }];
  const result = await check(200);
  assert.equal(result.terhapus, true);
  assert.equal(queries.length, 3);
  assert.match(queries[0].query, /FOR UPDATE/);
  assert.deepEqual(queries[1].values, [2, 1]);
  assert.match(queries[2].query, /count\(\*\)/);
  assert.match(queries[2].query, /sidik_jari = NULL/);
  fail = true;
  await check(500);
  console.log('PASS: CSV parses 15 reviews (5/5/5); delete authentication, role, origin, IDs, missing configuration, active analysis, missing review, scoped deletion, recount, and database failure.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
