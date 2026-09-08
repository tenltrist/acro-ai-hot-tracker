const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const output = '/tmp/acro-main-check';

async function checkCounts(page) {
  const counts = await page.evaluate(() => {
    const items = boardItems();
    const sum = host => [...document.querySelectorAll(host + ' > button strong')].reduce((n, el) => n + Number(el.textContent), 0);
    return {
      total: items.length,
      metric: [...document.querySelectorAll('[data-main-count]')].map(el => Number(el.querySelector('strong').textContent)),
      expected: [items.filter(boardIsCritical).length, items.filter(e => e.roles.includes('competitor')).length, items.filter(e => e.roles.includes('customer')).length, items.filter(e => e.regions.some(r => overviewApacRegions.has(r))).length],
      trend: sum('#mainTrend .board-daily-chart'),
      categories: sum('#mainCategories'),
      accounts: [...document.querySelectorAll('#mainAccountMatrix [data-board-company]')].map(el => ({ count: Number(el.querySelector('b').textContent), expected: items.filter(e => e.companyIds.includes(el.dataset.boardCompany)).length })),
      cells: [...document.querySelectorAll('[data-matrix-company]')].map(el => ({ count: Number(el.textContent) || 0, expected: items.filter(e => e.companyIds.includes(el.dataset.matrixCompany) && e.category === el.dataset.boardValue).length })),
      latest: [...document.querySelectorAll('#mainLatest [data-board-row]')].map(el => el.dataset.boardRow),
      expectedLatest: items.filter(e => !e.item.signal_type || e.item.signal_type === 'news').slice(0, 3).map(e => e.id),
    };
  });
  assert.deepEqual(counts.metric, counts.expected);
  assert.equal(counts.trend, counts.total);
  assert.equal(counts.categories, counts.total);
  for (const row of [...counts.accounts, ...counts.cells]) assert.equal(row.count, row.expected);
  assert.deepEqual(counts.latest, counts.expectedLatest);
  return counts;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const width of [1440, 1024, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(process.env.MAIN_BASE_URL || pathToFileURL(path.join(root, 'web/index.html')).href);
      await page.waitForSelector('#mainMetrics strong');
      await page.waitForFunction(() => !document.querySelector('#refreshButton').classList.contains('is-loading'));
      assert.equal(await page.locator('#mainDashboard').isVisible(), true);
      assert.equal(await page.locator('#periodOverview').isVisible(), false);
      assert.match(page.url(), /#home\?/);
      let counts = await checkCounts(page);
      for (const [index, key] of ['critical', 'competitor', 'customer', 'apac'].entries()) {
        await page.locator(`[data-main-count="${key}"]`).click();
        assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), counts.metric[index]);
        assert.match(await page.locator('#periodDetail .board-breadcrumbs').innerText(), /总看板/);
        await page.locator('[data-board-back]').click();
        assert.equal(await page.locator('#mainDashboard').isVisible(), true);
      }
      const cell = page.locator('[data-matrix-company]:not(:disabled)').first();
      const cellCount = Number(await cell.innerText());
      await cell.click();
      assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), cellCount);
      await page.locator('#periodDetail .board-event-link').first().click();
      assert.ok(await page.locator('.board-evidence-links a').count() > 0);
      await page.locator('[data-board-back]').click();
      assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), cellCount);
      await page.locator('[data-board-back]').click();
      await page.locator('[data-main-days="90"]').click();
      counts = await checkCounts(page);
      assert.equal(await page.evaluate(() => boardRange().days), 90);
      if (!await page.locator('#boardFilterPanel').evaluate(el => el.open)) await page.locator('#boardFilterPanel > summary').click();
      await page.locator('#boardCompany').selectOption('acro');
      await checkCounts(page);
      await page.locator('.nav [data-period-entry="week"]').click();
      assert.equal(await page.locator('#periodOverview').isVisible(), true);
      assert.equal(await page.locator('#mainDashboard').isVisible(), false);
      assert.equal(await page.locator('#boardCompany').inputValue(), 'acro');
      assert.equal(await page.evaluate(() => boardRange().days), 7);
      await page.locator('[data-board-count="all"]').click();
      assert.match(await page.locator('#periodDetail .board-breadcrumbs').innerText(), /总看板.*周看板/s);
      await page.locator('[data-board-back]').click();
      await page.locator('.nav [data-period-entry="month"]').click();
      await page.locator('#boardMonthDate').fill('2026-08');
      await page.locator('#boardMonthDate').dispatchEvent('change');
      const historyRange = await page.locator('#boardRangeLabel').innerText();
      await page.locator('#periodControls [data-main-home]').click();
      assert.equal(await page.locator('#mainDashboard').isVisible(), true);
      assert.equal(await page.evaluate(() => boardRange().days), 90);
      await page.goBack();
      assert.equal(await page.locator('#periodOverview').isVisible(), true);
      assert.equal(await page.locator('#boardRangeLabel').innerText(), historyRange);
      await page.locator('.nav [data-page-target="overview"]').click();
      await page.locator('[data-board-clear]').click();
      await page.locator('[data-main-days="30"]').click();
      await checkCounts(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(output, `main-${width}.png`) });
      await page.locator('#mainCompetitorMatrix').screenshot({ path: path.join(output, `matrix-${width}.png`) });
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        clipped: [...document.querySelectorAll('#mainDashboard button, #periodControls button')].filter(el => el.getClientRects().length && (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3)).map(el => el.textContent),
      }));
      assert.equal(layout.overflow, false);
      assert.deepEqual(layout.clipped, []);
      assert.deepEqual(errors, []);
      console.log(`PASS main ${width}px: counts, matrices, evidence, hierarchy, history, filters and layout`);
      await page.close();
    }
    const page = await browser.newPage();
    await page.route(/^https?:/, route => route.abort());
    await page.goto(pathToFileURL(path.join(root, 'share/acro_ai_hot_tracker_dashboard.html')).href);
    await page.waitForSelector('#mainMetrics strong');
    await checkCounts(page);
    await page.locator('.nav [data-period-entry="month"]').click();
    assert.equal(await page.locator('#periodOverview').isVisible(), true);
    console.log('PASS offline main and period pages');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
