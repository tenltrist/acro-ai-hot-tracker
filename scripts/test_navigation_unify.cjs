const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
require('./test_data_preservation.cjs')(root, path.join(root, 'preview-checks/before-history-status-20260909'));
const results = [];

async function checkPeriod(page) {
  const data = await page.evaluate(() => {
    const items = boardItems();
    return {
      total: items.length,
      count: Number(document.querySelector('[data-board-count="all"] strong').textContent),
      products: items.filter(event => ['product_platform', 'target_therapy'].includes(event.category)).length,
      shownProducts: Number(document.querySelector('[data-board-count="products"] strong').textContent),
      trend: [...document.querySelectorAll('#boardTrend .board-day:not(:disabled) > strong')].reduce((n, el) => n + Number(el.textContent), 0),
      ids: items.map(event => event.id).sort(),
    };
  });
  assert.equal(data.total, data.count);
  assert.equal(data.products, data.shownProducts);
  assert.equal(data.trend, data.total);
  assert.equal(await page.locator('.marketing-assistant').isVisible(), false);
  assert.equal(await page.locator('#periodControls [data-board-mode]:visible').count(), 0);
  return data;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [width, file] of [[1440, 'web/index.html'], [390, 'web/index.html'], [1440, 'share/acro_ai_hot_tracker_dashboard.html']]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^https?:/, route => route.abort());
      await page.goto(pathToFileURL(path.join(root, file)).href);
      await page.waitForFunction(() => document.querySelector('#fusionTotals strong'));
      assert.deepEqual(await page.locator('[data-browse]').allTextContents(), ['总览', '周看板', '月看板', '历史记录']);
      assert.equal(await page.locator('[data-time-range]:visible').count(), 0);
      assert.equal(await page.evaluate(() => state.timeRange), 90);
      assert.match(await page.locator('#timeRangeControl').innerText(), /近 90 天/);
      assert.equal(await page.locator('[data-role-filter="customer"]').innerText(), '客户');
      assert.match(await page.locator('#overview').innerText(), /监测对象/);
      assert.doesNotMatch(await page.locator('#overview').innerText(), /公司角色|客户 \/ 账户/);
      assert.equal(await page.locator('.marketing-assistant').isVisible(), true);
      const home = await page.evaluate(() => getFilteredItems(true).map(item => item.id).sort());
      assert.equal(home.length, 146);
      const reportFilter = await page.evaluate(() => periodModel.select([
        { id: 'split', reports: [{ signal_type: 'news', acro_relevance: { level: 'low' } }, { signal_type: 'video', acro_relevance: { level: 'high' } }] },
        { id: 'together', reports: [{ signal_type: 'news', acro_relevance: { level: 'high' } }] },
      ], { signalType: 'news', relevance: 'high' }, {}, 'history').map(event => event.id));
      assert.deepEqual(reportFilter, ['together']);
      assert.equal(await page.locator('#signalTrendChart svg polyline').count(), 4);
      await page.screenshot({ path: path.join(root, `preview-checks/navigation-home-${width}.png`) });

      await page.locator('[data-role-filter="customer"]').click();
      await page.locator('#signalTypeFilter').selectOption('news');
      await page.locator('#relevanceFilter').selectOption('high');
      await page.locator('#fusionRegionLabel').click();
      await page.locator('[data-fusion-region][value="japan"]').check();
      await page.locator('#fusionRegionLabel').click();
      const customerIds = await page.evaluate(() => getFilteredItems(true).map(item => item.id).sort());
      await page.locator('[data-browse="month"]').click();
      assert.equal(await page.locator('#boardRole').inputValue(), 'customer');
      assert.equal(await page.locator('#boardSignalType').inputValue(), 'news');
      assert.equal(await page.locator('#boardRelevance').inputValue(), 'high');
      assert.deepEqual(await page.evaluate(() => periodView.regions), ['japan']);
      await page.locator('#boardMonthDate').fill('2026-08');
      assert.deepEqual(await page.evaluate(() => boardRange()), { start: '2026-08-01', end: '2026-08-31', days: 31, mode: 'month' });
      await checkPeriod(page);
      assert.equal(await page.evaluate(() => boardItems().every(event => event.reports.some(report => report.signal_type === 'news' && report.acro_relevance?.level === 'high'))), true);
      assert.equal(await page.evaluate(() => boardItems().every(event => event.roles.includes('customer') && event.regions.includes('japan'))), true);
      await page.locator('[data-browse="week"]').click();
      assert.equal(await page.evaluate(() => periodView.anchor), '2026-08-01');
      assert.deepEqual(await page.evaluate(() => boardRange()), { start: '2026-07-27', end: '2026-08-02', days: 7, mode: 'week' });
      await checkPeriod(page);
      await page.locator('[data-browse="overview"]').click();
      assert.deepEqual(await page.evaluate(() => getFilteredItems(true).map(item => item.id).sort()), customerIds);
      assert.equal(await page.locator('[data-role-filter="customer"]').getAttribute('aria-pressed'), 'true');
      await page.locator('[data-role-filter="all"]').click();
      await page.locator('#signalTypeFilter').selectOption('all');
      await page.locator('#relevanceFilter').selectOption('all');
      await page.locator('#fusionRegionLabel').click();
      await page.locator('[data-fusion-regions-clear]').click();
      await page.locator('#fusionRegionLabel').click();
      assert.deepEqual(await page.evaluate(() => getFilteredItems(true).map(item => item.id).sort()), home);

      await page.locator('[data-browse="month"]').click();
      await page.locator('#boardMonthDate').fill('2026-08');
      const month = await checkPeriod(page);
      const apac = await page.evaluate(() => boardItems().filter(event => event.regions.some(region => window.AIHOT_REGION_MODEL.apac.includes(region))).map(event => event.id).sort());
      assert.equal(Number(await page.locator('#boardRegionBars [data-board-value="apac"] strong').innerText()), apac.length);
      await page.locator('#boardRegionBars [data-board-value="apac"]').click();
      assert.deepEqual(await page.evaluate(() => boardRouteItems(periodView.route, boardItems()).map(event => event.id).sort()), apac);
      assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), apac.length);
      await page.locator('[data-board-back]').click();
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(root, `preview-checks/navigation-month-${width}.png`) });
      await page.locator('#boardTrend').screenshot({ path: path.join(root, `preview-checks/navigation-trend-${width}.png`) });
      const expectedProducts = await page.evaluate(() => boardItems().filter(event => ['product_platform', 'target_therapy'].includes(event.category)).map(event => event.id).sort());
      await page.locator('[data-board-count="products"]').click();
      assert.equal(await page.locator('#periodControls').isVisible(), false);
      assert.equal(await page.locator('#browseNavigation').isVisible(), false);
      assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), expectedProducts.length);
      assert.match(await page.locator('#periodDetail .board-breadcrumbs').innerText(), /看板.*月看板.*产品与技术动态/s);
      const eventId = await page.evaluate(() => boardRouteItems(periodView.route, boardItems()).slice(0, periodView.limit).find(event => event.companyIds.length).id);
      await page.locator(`#periodDetail [data-board-event="${eventId}"]`).first().click();
      await page.screenshot({ path: path.join(root, `preview-checks/navigation-detail-${width}.png`) });
      assert.match(await page.locator('#periodDetail .board-breadcrumbs').innerText(), /月看板.*产品与技术动态.*事件与证据/s);
      assert.ok(await page.locator('.board-evidence-links a').count());
      await page.locator('#periodDetail [data-board-company]').first().click();
      assert.match(await page.locator('#periodDetail .board-breadcrumbs').innerText(), /月看板.*事件与证据/s);
      await page.locator('[data-board-back]').click();
      assert.equal(await page.locator('[data-board-detail-event]').getAttribute('data-board-detail-event'), eventId);
      await page.locator('[data-board-back]').click();
      assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), expectedProducts.length);
      await page.locator('[data-board-home]').click();
      assert.deepEqual((await checkPeriod(page)).ids, month.ids);
      const beforeRulesUrl = page.url();
      await page.locator('.nav [data-page-target="methodology"]').click();
      await page.locator('[data-methodology-target="region-classification"]').click();
      await page.goBack(); await page.goBack();
      await page.waitForURL(beforeRulesUrl);
      assert.deepEqual((await checkPeriod(page)).ids, month.ids);

      await page.locator('[data-browse="records"]').click();
      const records = await page.evaluate(() => ({ all: boardItems().map(event => event.id).sort(), selected: boardItems('history', 'selected').map(event => event.id).sort(), other: boardItems('history', 'other').map(event => event.id).sort(), undated: boardItems().filter(event => !event.published).length }));
      assert.equal(await page.locator('#boardRecordModes').isVisible(), true);
      assert.equal(await page.locator('#periodControls .board-period-toolbar').isVisible(), false);
      assert.deepEqual([records.all.length, records.selected.length, records.other.length], [2295, 242, 2053]);
      assert.deepEqual([...records.selected, ...records.other].sort(), records.all);
      assert.ok(records.undated > 0);
      const synthetic = await page.evaluate(() => [
        ...[{ reports: [{ tier: 'archive' }] }, { reports: [{ tier: 'archive' }, { tier: 'daily' }] }, { reports: [{ tier: 'immediate' }] }, { reports: [{}] }, { reports: [] }].map(boardRecordKind),
        boardRecordStatus({ reports: [{}] }), boardRecordStatus({ reports: [] }),
        ...['2026-06-10', '2026-06-11', '2026-09-08', '2026-09-09', null].map(published => boardSelectionWindow({ published })),
      ]);
      assert.deepEqual(synthetic, ['other', 'selected', 'selected', 'other', 'other', '其他留存资料（入选状态未确认）', '其他留存资料（入选状态未确认）', 'outside', 'current', 'current', 'outside', 'unknown']);
      assert.match(await page.locator('#boardRecordModes').innerText(), /所有记录均已保存/);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('#boardRecordModes button')].every(button => {
        const bounds = button.getBoundingClientRect();
        const number = button.querySelector('b').getBoundingClientRect();
        const group = button.parentElement.getBoundingClientRect();
        return number.top >= bounds.top && number.bottom <= bounds.bottom && number.right <= bounds.right && bounds.bottom <= group.bottom;
      })), true, 'Record labels and counts fit their buttons at every viewport');
      await page.locator('[data-board-records="selected"]').click();
      assert.deepEqual(await page.evaluate(() => boardItems().map(event => event.id).sort()), records.selected);
      const selectedDates = await page.evaluate(() => Object.fromEntries(Object.keys(boardSelectionWindowLabels).map(key => [key, boardItems().filter(event => boardSelectionWindow(event) === key).map(event => event.id).sort()])));
      assert.deepEqual(Object.values(selectedDates).map(ids => ids.length), [146, 31, 65]);
      assert.deepEqual(Object.values(selectedDates).flat().sort(), records.selected);
      assert.deepEqual(selectedDates.current, home);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(root, `preview-checks/navigation-selected-${width}.png`) });
      await page.locator('.board-selection-breakdown').screenshot({ path: path.join(root, `preview-checks/navigation-selected-dates-${width}.png`) });
      for (const [key, expected] of Object.entries(selectedDates)) {
        assert.equal(Number(await page.locator(`[data-board-selection-window="${key}"] strong`).innerText()), expected.length);
        await page.locator(`[data-board-selection-window="${key}"]`).click();
        assert.deepEqual(await page.evaluate(() => boardRouteItems(periodView.route, boardItems()).map(event => event.id).sort()), expected);
        assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), expected.length);
        assert.match(await page.locator('#periodDetail .board-breadcrumbs').innerText(), /历史记录.*入选信息/s);
        assert.equal(await page.locator('#periodControls').isVisible(), false);
        await page.locator('#periodDetail [data-board-event]').first().click();
        assert.match(await page.locator('.board-facts').innerText(), /保存状态.*已留存.*筛选结果.*入选信息/s);
        await page.reload();
        await page.waitForFunction(() => document.querySelector('[data-board-detail-event]'));
        await page.locator('[data-board-back]').click();
        assert.deepEqual(await page.evaluate(() => boardRouteItems(periodView.route, boardItems()).map(event => event.id).sort()), expected);
        await page.locator('[data-board-back]').click();
        assert.deepEqual(await page.evaluate(() => boardItems().map(event => event.id).sort()), records.selected);
      }
      await page.locator('[data-board-records="other"]').click();
      assert.deepEqual(await page.evaluate(() => boardItems().map(event => event.id).sort()), records.other);
      assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), records.other.length);
      assert.equal(await page.locator('.board-detail-heading h2').innerText(), '其他留存资料');
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(root, `preview-checks/navigation-other-${width}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.locator('#periodDetail [data-board-event]').first().click();
      assert.match(await page.locator('.board-facts').innerText(), /保存状态.*已留存.*筛选结果.*其他留存资料/s);
      await page.locator('[data-board-back]').click();
      assert.deepEqual(await page.evaluate(() => boardItems().map(event => event.id).sort()), records.other);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('[data-board-result-count]'));
      assert.equal(await page.locator('[data-board-records="other"]').getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await page.evaluate(() => boardItems().map(event => event.id).sort()), records.other);
      await page.goto(page.url().replace('records=other', 'records=archive'));
      await page.reload();
      await page.waitForFunction(() => document.querySelector('[data-board-result-count]'));
      assert.equal(await page.evaluate(() => periodView.recordKind), 'other');
      assert.deepEqual(await page.evaluate(() => boardItems().map(event => event.id).sort()), records.other);
      await page.locator('#boardRole').selectOption('customer');
      const filteredOther = await page.evaluate(() => boardItems().map(event => event.id).sort());
      assert.equal(await page.evaluate(() => boardItems().every(event => event.roles.includes('customer') && boardRecordKind(event) === 'other')), true);
      assert.equal(Number(await page.locator('[data-board-records="other"] b').innerText()), filteredOther.length);
      assert.equal(Number(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count')), filteredOther.length);
      await page.locator('[data-board-records="selected"]').click();
      await page.locator('#boardRegionsSummary').click();
      await page.locator('[data-board-region][value="japan"]').check();
      await page.locator('#boardRegionsSummary').click();
      const filteredSelected = await page.evaluate(() => boardItems().map(event => event.id).sort());
      assert.equal(await page.evaluate(() => boardItems().every(event => event.roles.includes('customer') && event.regions.includes('japan') && boardRecordKind(event) === 'selected')), true);
      assert.equal(Number(await page.locator('[data-board-records="selected"] b').innerText()), filteredSelected.length);
      const filteredCounts = await page.evaluate(() => [...document.querySelectorAll('[data-board-selection-window] strong')].reduce((n, el) => n + Number(el.textContent), 0));
      assert.equal(filteredCounts, filteredSelected.length);
      await page.locator('[data-board-clear]').click();
      await page.locator('[data-board-records="all"]').click();
      assert.deepEqual(await page.evaluate(() => boardItems().map(event => event.id).sort()), records.all);
      await page.locator('[data-browse="overview"]').click();
      assert.deepEqual(await page.evaluate(() => getFilteredItems(true).map(item => item.id).sort()), home);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
      results.push({ width, file, home: home.length, month: month.total, retained: records.all.length, selected: records.selected.length, other: records.other.length, selectedDates: Object.fromEntries(Object.entries(selectedDates).map(([key, ids]) => [key, ids.length])), undated: records.undated });
      console.log(`PASS ${width} ${file}: fixed overview, calendar periods, preserved filters, evidence/company/back, stored/selected distinction, date drilldown and reload.`);
      await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(root, 'preview-checks/navigation-unify-results.json'), JSON.stringify({ date: '2026-09-09', results }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
