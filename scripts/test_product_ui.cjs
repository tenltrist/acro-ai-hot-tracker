const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const results = [];
const sortedIds = page => page.evaluate(() => getFilteredItems().map(item => item.id).sort());
async function counts(page) {
  const result = await page.evaluate(() => {
    const items = getFilteredItems();
    return {
      total: items.length, shown: +document.querySelector('#fusionTotals strong').textContent,
      rows: [...document.querySelectorAll('#fusionProductRows [data-product-row]')].map(el => {
        const category = el.dataset.productRow;
        const matches = items.filter(item => productModel.matches(productAnalysis(item), [category], fusion.productDirection));
        return { category, count: +el.querySelector('[data-product-event-count]').textContent, expected: fusionTopicEvents(matches).length, news: matches.length };
      }),
      customer: [+document.querySelector('#metricImmediate').textContent, items.filter(item => getItemRole(item) === 'customer').length],
      competitor: [+document.querySelector('#metricDaily').textContent, items.filter(item => getItemRole(item) === 'competitor').length],
      regions: [...document.querySelectorAll('#regionBars [data-fusion-region-detail]')].map(el => [+el.querySelector('strong').textContent, el.dataset.fusionRegionDetail === 'all' ? items.length : items.filter(item => fusionRegions(item).includes(el.dataset.fusionRegionDetail)).length]),
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      productOverflow: [...document.querySelectorAll('#fusionProductRows .product-category-main')].some(el => el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2),
      classified: items.filter(item => productAnalysis(item).matches.length).length,
      unknown: items.filter(item => !productAnalysis(item).matches.length).length,
    };
  });
  assert.equal(result.total, result.shown);
  assert.equal(result.classified + result.unknown, result.total);
  assert.equal(result.overflow, false);
  assert.equal(result.productOverflow, false);
  for (const row of result.rows) assert.equal(row.count, row.expected, row.category);
  for (const [actual, expected] of [...result.regions, result.customer, result.competitor]) assert.equal(actual, expected);
  return result;
}
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  fs.mkdirSync(path.join(root, 'preview-checks'), { recursive: true });
  try {
    for (const [file, width] of [['web/index.html', 1440], ['web/index.html', 1024], ['web/index.html', 390], ['share/acro_ai_hot_tracker_dashboard.html', 1440]]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^https?:/, route => route.abort());
      await page.goto(pathToFileURL(path.join(root, file)).href);
      await page.waitForFunction(() => document.querySelectorAll('#fusionProductRows [data-product-row]').length === 9);
      const baseline = await counts(page);
      const baselineIds = await sortedIds(page);
      await page.screenshot({ path: path.join(root, `preview-checks/products-top-${width}-${file.startsWith('share') ? 'share' : 'web'}.png`) });
      await page.locator('#fusionProductRows').screenshot({ path: path.join(root, `preview-checks/products-rows-${width}.png`) });
      assert.equal(await page.locator('#fusionProductCategories input').count(), 10);
      assert.equal(await page.locator('#fusionProductCategories').innerText().then(text => /核酸与分子试剂/.test(text)), false);
      for (const category of [...baseline.rows.map(row => row.category), 'unidentified']) {
        const expected = await page.evaluate(category => {
          const items = getFilteredItems().filter(item => productModel.matches(productAnalysis(item), [category], fusion.productDirection));
          return { ids: items.map(item => item.id).sort(), events: fusionTopicEvents(items).length };
        }, category);
        await page.locator(`#fusionProductRows [data-product-open="${category}"]:not([data-product-direction])`).click();
        assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), expected.ids);
        assert.equal(await page.locator('.fusion-topic-evidence-event').count(), expected.events);
        assert.match(await page.locator('#fusionEvidence .methodology-breadcrumb').innerText(), /产品分类/);
        await page.locator('[data-fusion-back]').click();
        assert.deepEqual(await sortedIds(page), baselineIds);
      }
      for (const direction of ['customer', 'competitor', 'unspecified']) {
        const expected = await page.evaluate(direction => getFilteredItems().filter(item => productModel.matches(productAnalysis(item), ['antibody'], direction)).map(item => item.id).sort(), direction);
        await page.locator(`#fusionProductRows [data-product-open="antibody"][data-product-direction="${direction}"]`).click();
        assert.deepEqual(await page.evaluate(() => [...fusion.detail.ids].sort()), expected);
        await page.locator('[data-fusion-back]').click();
      }
      await page.locator('#fusionProductCategories summary').click();
      await page.locator('#fusionProductCategories input[value="drug"]').check();
      await page.locator('#fusionProductCategories input[value="assay"]').check();
      await page.locator('#fusionProductCategories').screenshot({ path: path.join(root, `preview-checks/products-filter-${width}.png`) });
      await counts(page);
      assert.deepEqual(await sortedIds(page), await page.evaluate(ids => fusionDashboardItems().filter(item => ids.includes(item.id) && productModel.matches(productAnalysis(item), ['drug', 'assay'])).map(item => item.id).sort(), baselineIds));
      await page.locator('#fusionProductDirection').selectOption('customer');
      await page.evaluate(() => { fusion.regions = ['japan']; state.relevance = 'high'; renderOverviewScope(); });
      await counts(page);
      const expectedIntersection = await page.evaluate(ids => fusionDashboardItems().filter(item => ids.includes(item.id) && productModel.matches(productAnalysis(item), ['drug', 'assay'], 'customer') && fusionRegions(item).includes('japan') && item.acro_relevance.level === 'high').map(item => item.id).sort(), baselineIds);
      assert.deepEqual(await sortedIds(page), expectedIntersection);
      await page.locator('#fusionProductCategories [data-product-clear]').click();
      assert.deepEqual(await page.evaluate(() => ({ products: fusion.products, direction: fusion.productDirection, regions: fusion.regions, relevance: state.relevance })), { products: [], direction: 'all', regions: ['japan'], relevance: 'high' });
      await page.evaluate(() => { fusion.regions = []; state.relevance = 'all'; renderOverviewScope(); });
      assert.deepEqual(await sortedIds(page), baselineIds);
      await page.locator('#fusionProductCategories input[value="unidentified"]').check();
      const unknown = await counts(page);
      assert.equal(unknown.total, baseline.unknown);
      await page.locator('#fusionProductCategories [data-product-clear]').click();
      await page.locator('#fusionProductCategories summary').click();
      await page.evaluate(() => { fusion.products = ['antibody']; fusion.productDirection = 'customer'; fusionSwitchBrowse('month'); periodView.anchor = '2026-09-15'; renderPeriodOverview(); writeBoardUrl(); });
      assert.deepEqual(await page.evaluate(() => periodView.products), ['antibody']);
      assert.equal(await page.locator('#boardProductDirection').inputValue(), 'customer');
      await page.reload();
      await page.waitForFunction(() => state.payload && periodView.products.includes('antibody'));
      assert.equal(await page.locator('#boardProductDirection').inputValue(), 'customer');
      await page.locator('#boardProductCategories summary').click();
      await page.locator('#boardProductCategories input[value="drug"]').check();
      assert.deepEqual(await page.evaluate(() => periodView.products), ['drug', 'antibody']);
      await page.locator('#boardProductCategories input[value="drug"]').uncheck();
      const menuBounds = await page.locator('#boardProductCategories').boundingBox();
      assert.ok(menuBounds.width >= 130, 'period product filter must not collapse into a single narrow grid column');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.locator('#periodControls').screenshot({ path: path.join(root, `preview-checks/products-period-filter-${width}.png`) });
      await page.locator('#boardProductCategories summary').click();
      const boardRows = await page.evaluate(() => [...document.querySelectorAll('#boardProductCategoriesRows [data-product-row]')].map(el => ({ id: el.dataset.productRow, count: +el.querySelector('[data-product-event-count]').textContent, expected: boardRouteItems({ product: el.dataset.productRow, productDirection: periodView.productDirection }, boardItems()).length })));
      for (const row of boardRows) assert.equal(row.count, row.expected, 'period ' + row.id);
      await page.locator('#boardProductCategoriesRows [data-product-open="antibody"]:not([data-product-direction])').click();
      assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), String(boardRows.find(row => row.id === 'antibody').count));
      await page.locator('[data-board-back]').click();
      await page.evaluate(() => { fusionSwitchBrowse('overview'); fusion.products = []; fusion.productDirection = 'all'; renderOverviewScope(); openMethodology('product-classification'); });
      assert.match(await page.locator('#productRulesContent').innerText(), /kaidi-products-v1/);
      assert.match(await page.locator('#productRulesContent').innerText(), /细胞技术设备/);
      assert.deepEqual(errors, []);
      results.push({ file, width, baseline, checks: '10 category drilldowns, 3 directions, union, intersection, unknown, clear, period navigation and restore', errors });
      console.log('PASS', file, width, JSON.stringify(baseline));
      await page.close();
    }
    fs.writeFileSync(path.join(root, 'preview-checks/product-results.json'), JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
