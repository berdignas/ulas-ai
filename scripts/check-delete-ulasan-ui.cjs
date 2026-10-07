const puppeteer = require('puppeteer-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  const browser = await puppeteer.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage();
    await page.setCookie({ name: 'ulas_ai_session', value: 'ui-fixture-only', domain: '127.0.0.1', path: '/' });
    let rows = [{ id: 2, analisisId: 1, namaPengulas: 'Pengulas Uji 01', rating: 5, teksUlasan: 'Petugas pendaftaran sangat ramah dan prosesnya cepat.', sentimen: 'positif', tanggalUlasan: '2026-10-01' }];
    let deletes = 0;
    let fail = true;
    await page.setRequestInterception(true);
    page.on('request', async (request) => {
      const path = new URL(request.url()).pathname;
      if (!path.startsWith('/api/')) return request.continue();
      let data = {};
      let status = 200;
      if (path === '/api/auth/me') data = { loggedIn: true, isAdmin: true, role: 'admin', username: 'admin' };
      else if (path === '/api/analisis') data = { analisis: [{ id: 1, status: 'selesai', totalUlasan: 1, ulasanDiproses: 1 }] };
      else if (request.method() === 'DELETE') {
        deletes++;
        if (fail) { status = 500; data = { error: 'Gangguan database. Silakan coba lagi.' }; }
        else { rows = []; data = { terhapus: true }; }
      } else if (path.endsWith('/ulasan')) data = { ulasan: rows, total: rows.length };
      await request.respond({ status, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.setViewport({ width: 1366, height: 900 });
    await page.goto('http://127.0.0.1:3000/ulasan', { waitUntil: 'networkidle0', timeout: 120000 });
    const open = async () => {
      await page.waitForSelector('button[aria-label="Hapus ulasan Pengulas Uji 01"]');
      await page.click('button[aria-label="Hapus ulasan Pengulas Uji 01"]');
      await page.waitForSelector('[role="dialog"]');
    };
    const clickText = async (text) => page.evaluate((label) => {
      const button = [...document.querySelectorAll('[role="dialog"] button')].find((item) => item.textContent.trim() === label);
      if (!button) throw new Error(`Missing button: ${label}`);
      button.click();
    }, text);
    await open();
    fs.mkdirSync('tmp/delete-ulasan', { recursive: true });
    await page.screenshot({ path: 'tmp/delete-ulasan/desktop.png' });
    await clickText('Batal');
    assert.equal(deletes, 0);
    await open();
    await clickText('Hapus ulasan');
    await page.waitForSelector('[role="alert"]');
    assert.equal(rows.length, 1);
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: 'tmp/delete-ulasan/mobile.png' });
    const bounds = await page.$eval('[role="dialog"]', (element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right }; });
    assert.ok(bounds.left >= 0 && bounds.right <= 390);
    fail = false;
    await clickText('Hapus ulasan');
    await page.waitForFunction(() => document.body.textContent.includes('Ulasan berhasil dihapus') && document.body.textContent.includes('Tidak ada ulasan yang cocok'));
    assert.equal(deletes, 2);
    console.log('PASS: desktop/mobile dialog, cancel, error/retry, successful delete, and empty state (mock API; no real data deleted).');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
