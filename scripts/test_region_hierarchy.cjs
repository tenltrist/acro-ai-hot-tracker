const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const model = require('../web/region-model.js');
const root = path.resolve(__dirname, '..');

assert.equal(model.definitions.length, 16, 'No new stored region categories');
assert.deepEqual(model.families.map(row => row.id), ['apac', 'north_america', 'europe', 'latin_america', 'middle_east', 'africa']);
const example = [
  { id: 'a', title: 'Trial recruitment in Japan and Australia' },
  { id: 'b', title: 'APAC licensing agreement' },
  { id: 'c', title: 'Worldwide licensing rights' },
  { id: 'd', title: 'Trial recruitment in Asia' },
];
assert.deepEqual(model.distribution([...example, example[0]])[0].items.map(row => row.id), ['a', 'b']);
assert.deepEqual(model.analyze(example[2]).regions, ['global']);
assert.deepEqual(model.analyze(example[3]).regions, ['asia_unspecified']);
require('./test_data_preservation.cjs')(root, path.join(root, 'preview-checks/before-region-hierarchy-20260909'));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results = [];
  try {
    for (const [width, file] of [[1440, 'web/index.html'], [390, 'web/index.html'], [1440, 'share/acro_ai_hot_tracker_dashboard.html']]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^https?:/, route => route.abort());
      await page.goto(pathToFileURL(path.join(root, file)).href);
      await page.waitForFunction(() => document.querySelector('[data-fusion-region-family="apac"]'));
      await page.locator('[data-time-range="90"]').click();
      const baseline = await page.evaluate(() => getFilteredItems().map(row => row.id).sort());
      assert.equal(baseline.length, 146);
      assert.equal(await page.locator('.fusion-geography-bars [data-fusion-region-detail="global"], .fusion-geography-bars [data-fusion-region-detail="asia_unspecified"]').count(), 0);
      assert.equal(await page.locator('.region-family-breakdown').evaluate(el => el.open), false);
      assert.equal(await page.locator('.region-scope-evidence').evaluate(el => el.open), false);
      const expected = await page.evaluate(() => window.AIHOT_REGION_MODEL.distribution(getFilteredItems(), fusion.regionMode)[0].items.map(item => item.id).sort());
      assert.equal(Number(await page.locator('[data-fusion-region-family="apac"] strong').innerText()), expected.length);
      assert.equal(Number(await page.locator('#metricArchive').innerText()), expected.length);
      await page.locator('#regionPanel').screenshot({ path: path.join(root, `preview-checks/region-hierarchy-${width}-${file.startsWith('web') ? 'web' : 'share'}.png`) });
      await page.locator('[data-fusion-region-family="apac"]').click();
      assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), expected);
      assert.equal(await page.locator('#fusionEvidenceCards .signal-card').count(), expected.length);
      assert.match(await page.locator('#fusionEvidence .methodology-breadcrumb').innerText(), /亚太/);
      await page.locator('#fusionEvidence [data-fusion-back]').click();
      await page.locator('.region-family-breakdown > summary').click();
      assert.equal(await page.locator('[data-fusion-region-detail="japan"]').isVisible(), true);
      await page.locator('[data-fusion-region-detail="japan"]').click();
      assert.equal(await page.evaluate(() => fusion.detail.ids.every(id => fusionRegions(state.payload.items.find(item => item.id === id)).includes('japan'))), true);
      await page.locator('#fusionEvidence [data-fusion-back]').click();
      await page.locator('#fusionRegionLabel').click();
      await page.locator('[data-fusion-region-parent="apac"]').check();
      assert.deepEqual(await page.evaluate(() => getFilteredItems().map(item => item.id).sort()), expected);
      assert.equal(await page.locator('#fusionRegionLabel').innerText(), '亚太（全部）');
      await page.locator('[data-fusion-region][value="japan"]').uncheck();
      assert.equal(await page.locator('[data-fusion-region-parent="apac"]').evaluate(el => el.indeterminate), true);
      await page.locator('[data-fusion-regions-all]').click();
      assert.deepEqual(await page.evaluate(() => getFilteredItems().map(item => item.id).sort()), baseline);
      await page.locator('[data-fusion-regions-clear]').click();
      assert.deepEqual(await page.evaluate(() => getFilteredItems().map(item => item.id).sort()), baseline);
      await page.locator('#fusionRegionLabel').click();
      await page.locator('.nav [data-period-entry="month"]').click();
      await page.locator('#boardMonthDate').fill('2026-08');
      if (!(await page.locator('#boardRegionsSummary').isVisible())) await page.locator('#boardFilterPanel > summary').click();
      const expectedEvents = await page.evaluate(() => boardItems().filter(event => event.regions.some(id => window.AIHOT_REGION_MODEL.apac.includes(id))).map(event => event.id).sort());
      await page.locator('#boardRegionsSummary').click();
      await page.locator('[data-board-region-parent="apac"]').check();
      assert.deepEqual(await page.evaluate(() => boardItems().map(event => event.id).sort()), expectedEvents);
      assert.equal(Number(await page.locator('[data-board-count="all"] strong').innerText()), expectedEvents.length);
      await page.locator('#boardRegionsSummary').click();
      await page.locator('[data-board-count="all"]').click();
      assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), expectedEvents.length);
      await page.locator('[data-board-back]').click();
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      results.push({ width, file, news: baseline.length, apacNews: expected.length, monthlyApacEvents: expectedEvents.length });
      console.log(`PASS hierarchy ${width} ${file}: parent union, child counts, source scopes, filters, monthly detail and data preservation.`);
      await page.close();
    }
    fs.writeFileSync(path.join(root, 'preview-checks/region-hierarchy-results.json'), JSON.stringify({ date: '2026-09-09', results }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
