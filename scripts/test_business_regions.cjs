const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const labels = ['总计', '日本', '韩国', '印度', '新加坡', '澳大利亚', '其他国家'];
const keys = ['all', 'japan', 'korea', 'india', 'singapore', 'australia', 'other'];
async function ids(page) { return page.evaluate(() => getFilteredItems().map(item => item.id).sort()); }
async function menu(page) {
  if (!await page.locator('#fusionRegionControl').evaluate(el => el.open)) await page.locator('#fusionRegionControl > summary').click();
}
async function verify(page) {
  const result = await page.evaluate(() => {
    const items = getFilteredItems();
    const rows = [...document.querySelectorAll('#regionBars [data-fusion-region-detail]')].map(el => ({
      key: el.dataset.fusionRegionDetail,
      label: el.querySelector('span').textContent,
      count: +el.querySelector('strong').textContent,
      expected: el.dataset.fusionRegionDetail === 'all' ? items.length : items.filter(item => fusionRegions(item).includes(el.dataset.fusionRegionDetail)).length,
    }));
    return {
      rows, total: items.length,
      pending: items.filter(item => fusionRegions(item).includes('unknown')).length,
      located: +document.querySelector('#metricArchive').textContent,
      customer: [+document.querySelector('#metricImmediate').textContent, items.filter(item => getItemRole(item) === 'customer').length],
      competitor: [+document.querySelector('#metricDaily').textContent, items.filter(item => getItemRole(item) === 'competitor').length],
      accounts: [...document.querySelectorAll('[data-fusion-account-row]')].map(el => [+el.querySelector('.customer-priority-count strong').textContent, fusionAccountRows(items).find(row => row.key === el.dataset.fusionAccountRow).items.length]),
      directory: getJapanAccountData().accounts.length,
      pool: state.payload.companies.length,
      overflows: document.documentElement.scrollWidth > innerWidth + 1,
    };
  });
  assert.deepEqual(result.rows.map(row => row.label), labels);
  for (const row of result.rows) assert.equal(row.count, row.expected, row.key);
  assert.equal(result.located + result.pending, result.total);
  assert.equal(result.customer[0], result.customer[1]);
  assert.equal(result.competitor[0], result.competitor[1]);
  for (const [actual, expected] of result.accounts) assert.equal(actual, expected);
  assert.equal(result.directory, 232);
  assert.equal(result.overflows, false);
  return result;
}
(async () => {
  fs.mkdirSync(path.join(root, 'preview-checks'), { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const reports = [];
  try {
    for (const [file, width] of [['web/index.html', 1440], ['web/index.html', 1024], ['web/index.html', 390], ['share/acro_ai_hot_tracker_dashboard.html', 1440]]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^https?:/, route => route.abort());
      await page.goto(pathToFileURL(path.join(root, file)).href);
      await page.waitForFunction(() => document.querySelectorAll('#regionBars [data-fusion-region-detail]').length === 7);
      const baselineIds = await ids(page);
      const baseline = await verify(page);
      assert.equal(await page.locator('#fusionRegionOptions label').count(), 7);
      assert.deepEqual(await page.locator('#fusionRegionOptions label').allTextContents(), labels);
      for (const key of keys) {
        const expected = await page.evaluate(key => getFilteredItems().filter(item => key === 'all' || fusionRegions(item).includes(key)).map(item => item.id).sort(), key);
        await page.locator('[data-fusion-region-detail="' + key + '"]').click();
        assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), expected);
        assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), expected.length);
        assert.match(await page.locator('#fusionEvidence .methodology-breadcrumb').innerText(), /地区构成/);
        await page.locator('[data-fusion-back]').click();
        assert.deepEqual(await ids(page), baselineIds);
      }
      await menu(page);
      await page.locator('[data-fusion-region][value="japan"]').check();
      await page.locator('[data-fusion-region][value="other"]').check();
      await verify(page);
      const union = await page.evaluate(() => fusionDashboardItems().filter(item => ['daily', 'immediate'].includes(item.tier) && fusionWithinRange(item, 90) && fusionRegions(item).some(region => ['japan', 'other'].includes(region))).map(item => item.id).sort());
      assert.deepEqual(await ids(page), union);
      await page.locator('[data-fusion-regions-clear]').click();
      assert.deepEqual(await ids(page), baselineIds);
      await page.locator('[data-fusion-region][value="singapore"]').check();
      await page.locator('[data-fusion-regions-all]').click();
      assert.deepEqual(await ids(page), baselineIds);
      await page.locator('#fusionRegionControl > summary').click();
      // An exact company/event/topic/relevance intersection must survive drilldown and return.
      const originalScope = await page.evaluate(() => {
        const sample = getFilteredItems().find(item => fusionRegions(item).includes('other') && item.matched_companies?.length && fusionTopics(item).some(topic => topic !== 'unidentified'));
        if (!sample) throw new Error('Missing sample for intersection');
        Object.assign(state, { company: sample.matched_companies[0], category: getBusinessEventType(sample), relevance: sample.acro_relevance?.level || 'low', timeRange: 90 });
        fusion.topic = fusionTopics(sample)[0]; fusion.regions = ['other'];
        renderOverviewScope();
        return { company: state.company, category: state.category, relevance: state.relevance, timeRange: state.timeRange, topic: fusion.topic, regions: [...fusion.regions], ids: getFilteredItems().map(item => item.id).sort() };
      });
      assert.ok(originalScope.ids.length);
      await verify(page);
      await page.locator('[data-fusion-region-detail="other"]').click();
      assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), originalScope.ids);
      await page.locator('[data-fusion-back]').click();
      assert.deepEqual(await page.evaluate(() => ({ company: state.company, category: state.category, relevance: state.relevance, timeRange: state.timeRange, topic: fusion.topic, regions: [...fusion.regions], ids: getFilteredItems().map(item => item.id).sort() })), originalScope);
      await page.evaluate(() => { Object.assign(state, { company: 'all', category: 'all', relevance: 'all' }); fusion.topic = 'all'; fusion.regions = []; renderOverviewScope(); });
      await page.locator('#regionBars').screenshot({ path: path.join(root, 'preview-checks/business-regions-' + width + '-' + (file.startsWith('share') ? 'share' : 'web') + '.png') });
      await menu(page);
      await page.locator('#fusionRegionControl').screenshot({ path: path.join(root, 'preview-checks/business-region-filter-' + width + '.png') });
      await page.locator('[data-fusion-region][value="japan"]').check();
      await page.locator('[data-fusion-region-total]').check();
      assert.deepEqual(await ids(page), baselineIds);
      await page.locator('#fusionRegionControl > summary').click();
      await page.evaluate(() => openFusionRegionRules());
      assert.match(await page.locator('#regionRulesContent').innerText(), /2026-09-16.business-countries/i);
      assert.match(await page.locator('#regionRulesContent').innerText(), /地区待确认/);
      assert.deepEqual(errors, []);
      reports.push({ file, width, ...baseline, drilldown: '7/7', union: 'passed', intersection: 'passed', clear: 'passed', errors });
      console.log('PASS', file, width, JSON.stringify(baseline.rows.map(row => [row.label, row.count])));
      await page.close();
    }
    fs.writeFileSync(path.join(root, 'preview-checks/business-region-results.json'), JSON.stringify(reports, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
