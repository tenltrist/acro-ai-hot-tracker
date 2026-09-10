const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { setMode } = require('./test_region_navigation.cjs');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'preview-checks');

async function verifyCounts(page) {
  const result = await page.evaluate(() => {
    const items = getFilteredItems();
    const roles = new Map(state.payload.companies.map(c => [c.id, c.business_role]));
    return {
      total: items.length,
      metrics: ['metricCandidates', 'metricDaily', 'metricImmediate', 'metricArchive'].map(id => Number(document.getElementById(id).textContent)),
      expected: ['critical', 'competitor', 'customer', 'apac'].map(key => getOverviewMetricItems(key, items, roles).length),
      trend: [...document.querySelectorAll('#trendLegend button')].reduce((sum, el) => sum + Number(el.textContent.match(/\d+$/)?.[0] || 0), 0),
      accounts: [...document.querySelectorAll('[data-fusion-account-row]')].map(el => ({ actual: Number(el.querySelector('.customer-priority-count strong').textContent), expected: fusionAccountRows(items).find(row => row.key === el.dataset.fusionAccountRow).items.length })),
      matrix: [...document.querySelectorAll('[data-matrix-company]')].map(el => ({ actual: Number(el.textContent), expected: items.filter(item => (item.matched_companies || []).includes(el.dataset.matrixCompany) && getBusinessEventType(item) === el.dataset.matrixCategory).length })),
      regions: [...document.querySelectorAll('[data-fusion-region-detail]')].map(el => ({ actual: Number(el.querySelector('strong').textContent), expected: items.filter(item => fusionRegions(item).includes(el.dataset.fusionRegionDetail)).length })),
    };
  });
  assert.deepEqual(result.metrics, result.expected);
  assert.equal(result.trend, result.total);
  for (const row of [...result.accounts, ...result.matrix, ...result.regions]) assert.equal(row.actual, row.expected);
  return result;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1440, 1024, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route(/^https?:/, route => route.abort());
      await page.goto(pathToFileURL(path.join(root, 'web/index.html')).href);
      await page.waitForFunction(() => document.querySelectorAll('#executivePoints li').length === 3);
      const duplicateIds = await page.locator('[id]').evaluateAll(els => els.map(e => e.id).filter((id, index, ids) => ids.indexOf(id) !== index));
      assert.deepEqual(duplicateIds, []);
      assert.equal(await page.locator('#signalTrendChart svg polyline').count(), 4);
      assert.equal(await page.locator('#customerPriorityMatrix .customer-priority-density').count(), await page.evaluate(() => fusionAccountRows(getFilteredItems()).length));
      assert.equal(await page.locator('#topSignalList .signal-card').count(), 3);
      assert.ok(await page.locator('#topSignalList [data-company-logo]').count() > 0);
      await verifyCounts(page);
      await page.screenshot({ path: path.join(output, `home-${width}.png`) });
      await page.locator('#topSignalList').scrollIntoViewIfNeeded();
      await page.locator('#topSignalList img').evaluateAll(images => Promise.all(images.map(img => { img.loading = 'eager'; return img.decode().catch(() => {}); })));
      await page.screenshot({ path: path.join(output, `evidence-${width}.png`) });
      await page.locator('#topSignalList .signal-card').first().screenshot({ path: path.join(output, `news-card-${width}.png`) });
      await page.locator('.trend-panel').screenshot({ path: path.join(output, `trend-${width}.png`) });
      for (const [metric, countId] of [['critical', 'metricCandidates'], ['competitor', 'metricDaily'], ['customer', 'metricImmediate'], ['apac', 'metricArchive']]) {
        const count = Number(await page.locator(`#${countId}`).innerText());
        await page.locator(`[data-overview-metric="${metric}"]`).click();
        assert.equal(Number(await page.locator('#overviewMetricCount').innerText()), count);
        assert.equal(await page.locator('#overviewMetricList .signal-card').count(), count);
        await page.locator('#overviewMetricBackButton').click();
      }
      await page.locator('[data-assistant-view="account"]').click();
      assert.match(await page.locator('#executiveHeadline').innerText(), /客户动态/);
      const assistantAction = page.locator('[data-assistant-evidence]').first();
      const assistantCount = JSON.parse(await assistantAction.getAttribute('data-assistant-evidence')).length;
      await assistantAction.click();
      assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), assistantCount);
      await page.locator('#fusionEvidenceCards .fb-up').first().click();
      assert.equal(await page.locator('#fusionEvidenceCards .fb-thanks').count(), 1);
      await page.locator('[data-fusion-back]').click();
      const account = page.locator('[data-fusion-account]').first();
      const accountCount = Number(await account.locator('strong').innerText());
      await account.click();
      assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), accountCount);
      await page.locator('[data-fusion-back]').click();
      const cell = page.locator('[data-matrix-company]').first();
      const cellCount = Number(await cell.innerText());
      await cell.click();
      assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), cellCount);
      await page.locator('[data-fusion-back]').click();
      assert.equal(await page.evaluate(() => state.timeRange), 90);
      assert.equal(await page.locator('#timeRangeControl [data-time-range]').count(), 0);
      assert.match(await page.locator('#timeRangeControl').innerText(), /近 90 天/);
      await verifyCounts(page);
      const contentRegions = await page.evaluate(() => fusionRegions({ title: 'Research in Seoul and Tokyo', summary: '', source_label: 'China news' }));
      assert.deepEqual(new Set(contentRegions), new Set(['japan', 'korea']));
      await setMode(page, 'reviewed');
      const broadRegions = await page.evaluate(() => fusionRegions({ title: 'Research in Seoul and Tokyo', summary: '', source_label: 'China news' }));
      assert.deepEqual(new Set(broadRegions), new Set(['japan', 'korea']));
      await verifyCounts(page);
      await setMode(page, 'content');
      await page.locator('#fusionRegionLabel').click();
      await page.locator('[data-fusion-region][value="japan"]').check();
      await page.locator('[data-fusion-region][value="korea"]').check();
      await verifyCounts(page);
      await page.locator('.region-family-breakdown:not([open]) > summary').first().click();
      const region = page.locator('[data-fusion-region-detail]:not(:disabled):visible').first();
      const regionCount = Number(await region.locator('strong').innerText());
      await region.click();
      assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), regionCount);
      await page.locator('[data-fusion-back]').click();
      await page.locator('[data-fusion-regions-clear]').click();
      await page.locator('#fusionRegionLabel').click();
      const homeIds = await page.evaluate(() => getFilteredItems().map(i => i.id));
      await page.locator('.nav [data-period-entry="month"]').click();
      assert.equal(await page.locator('#periodOverview').isVisible(), true);
      assert.equal(await page.locator('.marketing-assistant').isVisible(), false);
      await page.screenshot({ path: path.join(output, `month-${width}.png`) });
      const monthCount = Number(await page.locator('[data-board-count="all"] strong').innerText());
      await page.locator('[data-board-count="all"]').click();
      assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), monthCount);
      await page.locator('[data-board-back]').click();
      await page.locator('#boardMonthDate').fill('2026-08');
      await page.locator('#boardMonthDate').dispatchEvent('change');
      assert.match(await page.locator('#boardCoverage').innerText(), /历史覆盖|回溯样本/);
      await page.locator('.nav [data-page-target="overview"]').click();
      assert.equal(await page.locator('.marketing-assistant').isVisible(), true);
      assert.deepEqual(await page.evaluate(() => getFilteredItems().map(i => i.id)), homeIds);
      await page.locator('.nav details').evaluateAll(nodes => nodes.forEach(node => { node.open = true; }));
      await page.locator('.nav [data-page-target="sources"]').click();
      assert.equal(await page.locator('#source-rules').isVisible(), true);
      await page.locator('.nav [data-page-target="company-sources"]').click();
      assert.match(await page.locator('#companyCoverageTitle').innerText(), /ACRO/);
      await page.locator('.nav [data-page-target="overview"]').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}: legacy modules, counts, account/matrix drilldowns, region evidence, periods, history, sources and layout`);
      await page.close();
    }
    const page = await browser.newPage();
    await page.route(/^https?:/, route => route.abort());
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'share/acro_ai_hot_tracker_dashboard.html')).href);
    await verifyCounts(page);
    await page.locator('.nav [data-period-entry="week"]').click();
    assert.equal(await page.locator('#periodOverview').isVisible(), true);
    assert.deepEqual(errors, []);
    console.log('PASS offline standalone fusion preview');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
