const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const http = require('node:http');
const model = require('../web/overview-model.js');
const root = path.resolve(__dirname, '..');

function unitTests() {
  assert.equal(model.date('2026-9-2'), '2026-09-02');
  assert.equal(model.date('2026-02-30'), '');
  assert.equal(model.date('2026-09'), '');
  assert.equal(model.period('week', '2026-09-06').start, '2026-08-31');
  assert.equal(model.period('month', '2024-02-15').end, '2024-02-29');
  assert.equal(model.shift(model.period('month', '2026-01-15'), -1), '2025-12-01');
  const companies = [{ id: 'a', business_role: 'competitor' }, { id: 'b', business_role: 'customer' }];
  const base = { title: 'Company A launches a specific new antibody platform', published: '2026-09-02', company_id: 'a', url: 'https://example.org/story', source_label: 'Official', signal_type: 'news', summary: 'The original source gives specific product facts.', intelligence: { product_needs: ['GMP protein'], targets: ['HER2'] } };
  const records = [
    { ...base, id: 'one', score: 1 },
    { ...base, id: 'two', url: 'https://example.org/story?utm_source=news', matched_company_ids: ['a', 'b'] },
    { ...base, id: 'three', url: 'https://publisher.org/same-story', source_label: 'Publisher' },
    { ...base, id: 'later', title: base.title + ' phase two', published: '2026-09-03', url: 'https://example.org/later', score: 0 },
    { ...base, id: 'old-event', published: '2026-09-02', event_start_at: '2026-09-02', signal_type: 'event', url: 'https://example.org/event' },
    { ...base, id: 'sitemap', evidence: { source_types: ['sitemap_urls'] }, url: 'https://example.org/map' },
    { ...base, id: 'trial', evidence: { source_types: ['clinical_trials'] }, url: 'https://example.org/trial' },
    { ...base, id: 'future', published: '2026-10-03', url: 'https://example.org/future' },
  ];
  const events = model.buildEvents(records, { companies, classify: () => 'product_platform', regions: () => ['japan', 'europe'] });
  const merged = events.find(event => event.reports.length === 3);
  assert.ok(merged);
  assert.equal(merged.evidence.length, 2);
  assert.deepEqual(merged.companyIds, ['a', 'b']);
  assert.deepEqual(merged.topics, ['抗体']);
  const range = model.period('month', '2026-09-08');
  const scoped = model.select(events, { today: '2026-09-08', regions: ['japan'], topic: '抗体' }, range);
  assert.equal(scoped.length, 2);
  assert.equal(scoped[0].id, 'later', 'Publication date, not score, determines latest');
  assert.equal(model.select(events, {}, range, 'unknown').length, 3);
  assert.equal(model.buckets(scoped, 'published').reduce((sum, [, n]) => sum + n, 0), scoped.length);
  assert.equal(model.select(events, { regions: ['china'] }, range).length, 0);
  console.log('PASS model: dates, week/month boundaries, evidence merge, independent filters, unknown/future dates, newest ordering');
}

async function snapshot(page) {
  return page.evaluate(() => ({
    range: boardRange(), total: boardItems().length,
    companies: new Set(boardItems().flatMap(event => event.companyIds)).size,
    products: boardItems().filter(event => ['product_platform', 'target_therapy'].includes(event.category)).length,
    partnerships: boardItems().filter(event => event.category === 'partnership_deal').length,
    ids: boardItems().map(event => event.id),
    latest: boardItems().filter(event => event.item.signal_type === 'news' || !event.item.signal_type).slice(0, 3).map(event => event.id),
    dates: boardItems().map(event => event.published),
  }));
}

async function assertSynced(page) {
  const expected = await snapshot(page);
  for (const [key, count] of [['all', expected.total], ['companies', expected.companies], ['products', expected.products], ['partnerships', expected.partnerships]]) {
    assert.equal(Number(await page.locator(`[data-board-count="${key}"] > strong`).innerText()), count);
  }
  const sum = selector => page.locator(selector).evaluateAll(elements => elements.reduce((total, element) => total + (Number(element.textContent) || 0), 0));
  assert.equal(await sum('#boardCategoryBars .board-bar-row > strong'), expected.total);
  assert.equal(await sum('#boardTrend .board-day > strong'), expected.total);
  const latest = await page.locator('#boardLatestRows [data-board-row]').evaluateAll(rows => rows.map(row => row.dataset.boardRow));
  assert.deepEqual(latest, expected.latest);
  for (const date of expected.dates) assert.ok(date >= expected.range.start && date <= expected.range.end);
  const bars = await page.locator('#boardTrend .board-day:not(:disabled) i b').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
  if (expected.total) assert.ok(bars.some(height => height > 10), 'Daily chart must have visible nonblank bars');
  return expected;
}

async function assertLayout(page, width) {
  const issues = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('#periodControls button, #periodOverview button, #periodDetail button')].filter(el => el.getClientRects().length);
    const overflowing = nodes.filter(el => el.scrollHeight > el.clientHeight + 3 && !el.classList.contains('board-day')).map(el => el.className);
    return { pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 2, overflowing };
  });
  assert.equal(issues.pageOverflow, false, `Page overflow at ${width}`);
  assert.deepEqual(issues.overflowing, [], `Button overflow at ${width}`);
}

(async () => {
  unitTests();
  const output = '/tmp/acro-period-check';
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const baseUrl = process.env.PERIOD_BASE_URL || pathToFileURL(path.join(root, 'web/index.html')).href;
  try {
    for (const width of [1440, 1024, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(baseUrl);
      await page.waitForFunction(() => document.querySelector('#boardMetrics strong'));
      await page.waitForFunction(() => !document.querySelector('#refreshButton').classList.contains('is-loading'));
      await assertSynced(page);
      await page.locator('[data-board-mode="month"]').click();
      const monthly = await assertSynced(page);
      await assertLayout(page, width);
      await page.screenshot({ path: path.join(output, `month-${width}.png`) });
      for (const key of ['all', 'products', 'partnerships', 'companies']) {
        await page.locator(`[data-board-count="${key}"]`).click();
        const expectedCount = key === 'all' || key === 'companies' ? monthly.total : monthly[key];
        assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), expectedCount);
        if (key === 'companies') assert.equal(await page.locator('.board-company-directory > button').count(), monthly.companies);
        await page.locator('[data-board-back]').click();
      }
      await page.locator('#boardCategoryBars [data-board-field]').first().click();
      const firstCount = await page.locator('[data-board-result-count]').getAttribute('data-board-result-count');
      assert.ok(Number(firstCount) > 0);
      await page.locator('#periodDetail .board-event-link').first().click();
      assert.ok(await page.locator('.board-evidence-links a').count() > 0);
      assert.match(await page.locator('.board-breadcrumbs').innerText(), /总览.*事件与证据/s);
      const detailUrl = page.url();
      await assertLayout(page, width);
      await page.screenshot({ path: path.join(output, `evidence-${width}.png`) });
      await page.goBack();
      assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), firstCount);
      await page.locator('[data-board-back]').click();
      if (!await page.locator('#boardFilterPanel').evaluate(el => el.open)) await page.locator('#boardFilterPanel > summary').click();
      await page.locator('#boardRegionsSummary').click();
      await page.locator('[data-board-region][value="japan"]').check();
      await page.locator('[data-board-region][value="europe"]').check();
      await assertSynced(page);
      assert.equal(await page.evaluate(() => boardItems().every(event => event.regions.includes('japan') || event.regions.includes('europe'))), true);
      await page.locator('#boardRegionsSummary').click();
      const category = await page.evaluate(() => boardItems()[0]?.category);
      if (category) { await page.locator('#boardCategory').selectOption(category); await assertSynced(page); }
      const topic = await page.evaluate(() => boardItems()[0]?.topics[0]);
      if (topic) { await page.locator('#boardTopic').selectOption(topic); await assertSynced(page); }
      await page.locator('[data-board-clear]').click();
      await page.locator('#boardMonthDate').fill('2026-08');
      await page.locator('#boardMonthDate').dispatchEvent('change');
      const historical = await assertSynced(page);
      assert.match(await page.locator('#boardCoverage').innerText(), /回溯样本|历史覆盖/);
      assert.notDeepEqual(historical.ids, monthly.ids);
      for (const role of ['competitor', 'customer', 'self']) {
        await page.locator(`[data-board-tab="${role}"]`).click();
        const rows = await page.locator('.board-company-row').count();
        const count = Number(await page.locator(`[data-board-tab="${role}"] b`).innerText());
        assert.equal(rows, count);
      }
      await page.locator('[data-board-tab="customer"]').click();
      if (await page.locator('.board-company-row').count()) {
        const row = page.locator('.board-company-row').first();
        const n = Number(await row.locator(':scope > b').innerText());
        await row.click();
        assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), n);
        await page.locator('[data-board-company-scope="history"]').click();
        assert.ok(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')) >= n);
        await page.locator('[data-board-source-profile]').click();
        assert.equal(await page.locator('[data-page="company-sources"]').isVisible(), true);
        await page.locator('#boardProfileReturn').click();
        assert.equal(await page.locator('#periodDetail').isVisible(), true);
        await page.locator('[data-board-back]').click();
      }
      await page.locator('[data-board-unknown]').click();
      assert.equal(await page.locator('#periodDetail time').evaluateAll(nodes => nodes.every(node => node.textContent.includes('日期待核对'))), true);
      await page.locator('[data-board-back]').click();
      await page.locator('#boardMonthDate').fill('2000-01');
      await page.locator('#boardMonthDate').dispatchEvent('change');
      assert.equal((await assertSynced(page)).total, 0);
      assert.match(await page.locator('#boardCoverage').innerText(), /尚无可查询历史/);
      await assertLayout(page, width);
      if (width === 1440) {
        const shared = await browser.newPage();
        await shared.goto(detailUrl);
        await shared.waitForSelector('[data-board-detail-event]');
        assert.ok(await shared.locator('.board-evidence-links a').count() > 0);
        await shared.close();
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: shared counts, charts, filters, historical queries, drilldowns, company archives, return paths, no overflow or JS errors`);
      await page.close();
    }
    const share = await browser.newPage();
    await share.route(/^https?:/, route => route.abort());
    await share.goto(pathToFileURL(path.join(root, 'share/acro_ai_hot_tracker_dashboard.html')).href);
    await share.waitForSelector('[data-board-count="all"]');
    await assertSynced(share);
    console.log('PASS offline standalone bundle');
    await share.close();
    const server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + pathname);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404).end(); return; }
      response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html');
      response.end(fs.readFileSync(file));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const live = await browser.newPage();
      const errors = [];
      live.on('pageerror', error => errors.push(error.message));
      await live.goto(`http://127.0.0.1:${server.address().port}/web/index.html`);
      await live.waitForFunction(() => document.querySelector('#boardMetrics strong') && !document.querySelector('#refreshButton').classList.contains('is-loading'));
      assert.equal(await live.evaluate(() => state.eventArchive.items.length), JSON.parse(fs.readFileSync(path.join(root, 'data/event_archive.json'))).items.length);
      await assertSynced(live);
      const before = await snapshot(live);
      await live.locator('.nav [data-page-target="signals"]').click();
      assert.equal(Number(await live.locator('[data-board-result-count]').getAttribute('data-board-result-count')), before.total);
      await live.locator('[data-board-back]').click();
      for (const target of ['companies', 'timeline', 'japan-customers', 'relationships', 'sources', 'company-sources', 'source-health', 'methodology', 'pipeline']) {
        await live.locator('.nav details').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
        const button = live.locator(`.nav [data-page-target="${target}"]`);
        if (await button.count()) { await button.click(); assert.equal(await live.locator(`[data-page="${target}"]`).first().isVisible(), true); }
      }
      await live.locator('.nav [data-page-target="overview"]').click();
      await live.route(/\/data\/event_archive\.json(?:\?|$)/, route => route.abort());
      await live.locator('[data-board-refresh]').click();
      await live.waitForFunction(() => state.archiveSyncFailed && !document.querySelector('#refreshButton').classList.contains('is-loading'));
      assert.match(await live.locator('#boardCoverage').innerText(), /历史文件同步失败/);
      await live.route(/\/data\/latest_run\.json(?:\?|$)/, route => route.abort());
      await live.locator('[data-board-refresh]').click();
      await live.waitForFunction(() => state.payloadSyncFailed && !document.querySelector('#refreshButton').classList.contains('is-loading'));
      assert.match(await live.locator('#boardSnapshot').innerText(), /同步失败/);
      assert.deepEqual(errors, []);
      console.log('PASS HTTP archive loading, shared sidebar list, existing pages and honest sync failure fallback');
      await live.close();
    } finally { await new Promise(resolve => server.close(resolve)); }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
