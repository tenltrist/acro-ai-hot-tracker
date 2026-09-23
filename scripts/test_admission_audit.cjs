const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const model = require('../web/admission-model.js');
const root = path.resolve(__dirname, '..');
const baseline = path.join(root, 'preview-checks/before-admission-audit-20260909');
require('./test_data_preservation.cjs')(root, baseline);
for (const file of ['config/companies.json', 'config/sources.json', 'config/japan_accounts.json']) {
  assert.deepEqual(fs.readFileSync(path.join(root, file)), fs.readFileSync(path.join(baseline, file)), file);
}
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'config/rule_catalog.json')));
const baselineCatalog = JSON.parse(fs.readFileSync(path.join(baseline, 'config/rule_catalog.json')));
for (const key of ['manual_summary_tool', 'manual_summary_mode', 'note']) {
  delete baselineCatalog.strategy[key];
  delete catalog.strategy[key];
}
assert.deepEqual(catalog, baselineCatalog, 'config/rule_catalog.json outside the editorial workflow');
const runtimeCatalog = JSON.parse(fs.readFileSync(path.join(root, 'config/rule_catalog.json')));
const payload = JSON.parse(fs.readFileSync(path.join(root, 'data/latest_run.json')));
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'web/admission-reviews.js'), 'utf8'), context);
const batch = JSON.parse(JSON.stringify(context.window.AIHOT_ADMISSION_REVIEWS));
const other = payload.items.filter(item => item.tier === 'archive');
const groups = model.counts(other.map(item => ({ reports: [item] })), runtimeCatalog);
assert.equal(groups.reduce((n, [, count]) => n + count, 0), 2053);
assert.deepEqual(Object.fromEntries(groups), { score: 844, age: 804, type: 263, relevance: 74, noise: 61, source: 5, action: 2 });
const trial = payload.items.find(item => item.id === 'f5e6b2ab15962df6');
assert.equal(trial.score, 92);
assert.equal(model.explain(trial, runtimeCatalog).key, 'type');
assert.ok(model.explain(trial, runtimeCatalog).correction);
assert.equal(model.explain({ tier: 'archive', score: 80, reasons: [] }, runtimeCatalog).key, 'unknown');
assert.equal(model.eventReason({ reports: [trial, { tier: 'daily' }] }, runtimeCatalog), 'selected');
assert.equal(model.eventReason({ reports: [trial, { tier: 'archive', selection_reason: 'ACRO 相关性较低，仅归档' }] }, runtimeCatalog), 'mixed');
assert.equal(batch.reviews.length, 30);
assert.equal(model.reviews({ reports: [trial] }, batch).length, 1);
assert.equal(model.reviews({ reports: [{ ...trial, score: 93 }] }, batch).length, 0);
assert.equal(model.reviews({ reports: [{ ...trial, summary: 'Changed evidence' }] }, batch).length, 0);
assert.equal(model.reviews({ reports: [{ ...trial, url: 'https://example.com/different-evidence' }] }, batch).length, 0);
assert.equal(batch.reviews.filter(row => row.verdict === 'reconsider').length, 5);
assert.equal(batch.reviews.filter(row => row.evidence.length).length, 14);
const results = [];

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
      assert.equal(await page.evaluate(() => getFilteredItems(true).length), 146);
      await page.locator('[data-browse="records"]').click();
      await page.locator('[data-board-records="other"]').click();
      assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), '2053');
      const uiGroups = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-board-admission-reason]')].map(el => [el.dataset.boardAdmissionReason, Number(el.querySelector('strong').textContent)])));
      assert.deepEqual(uiGroups, Object.fromEntries(groups));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.locator('.admission-overview').screenshot({ path: path.join(root, `preview-checks/admission-reasons-${width}.png`) });
      for (const [key, count] of groups) {
        const ids = await page.evaluate(key => boardItems().filter(event => boardAdmissionReason(event) === key).map(event => event.id).sort(), key);
        await page.locator(`[data-board-admission-reason="${key}"]`).click();
        assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), String(count));
        assert.deepEqual(await page.evaluate(() => boardRouteItems(periodView.route, boardItems()).map(event => event.id).sort()), ids);
        const eventId = await page.locator('#periodDetail [data-board-event]').first().getAttribute('data-board-event');
        await page.locator('#periodDetail [data-board-event]').first().click();
        assert.equal(await page.locator('[data-board-detail-event]').getAttribute('data-board-detail-event'), eventId);
        assert.ok(await page.locator('[data-admission-report]').count());
        await page.locator('[data-board-back]').click();
        assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), String(count));
        await page.locator('[data-board-back]').click();
      }
      await page.locator('[data-board-audit]').click();
      assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), '30');
      assert.equal(await page.locator('[data-audit-event]').count(), 30);
      assert.match(await page.locator('.admission-audit-intro').innerText(), /不是30篇全文精读/);
      assert.match(await page.locator('.admission-comparison').innerText(), /实际入选\s*242.*候选意见\s*5.*已应用变更\s*0/s);
      for (const [verdict, count] of [['reconsider', 5], ['knowledge', 14], ['keep', 6], ['verify', 5], ['all', 30]]) {
        await page.locator(`[data-board-audit-verdict="${verdict}"]`).click();
        assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), String(count));
        assert.equal(await page.locator('[data-audit-event]').count(), count);
      }
      await page.locator('[data-board-audit-verdict="reconsider"]').click();
      await page.screenshot({ path: path.join(root, `preview-checks/admission-audit-${width}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const expectedCandidates = await page.evaluate(() => boardRouteItems(periodView.route, boardItems()).map(event => event.id).sort());
      await page.locator('[data-audit-event] [data-board-event]').first().click();
      assert.match(await page.locator('.admission-detail').innerText(), /建议复议.*未应用/s);
      assert.ok(await page.locator('.admission-evidence a[href^="https://"]').count());
      await page.reload();
      await page.waitForFunction(() => document.querySelector('[data-board-detail-event]'));
      await page.locator('[data-board-back]').click();
      assert.deepEqual(await page.evaluate(() => boardRouteItems(periodView.route, boardItems()).map(event => event.id).sort()), expectedCandidates);
      await page.locator('[data-board-back]').click();
      await page.locator('#boardRole').selectOption('competitor');
      await page.locator('#boardRegionsSummary').click();
      await page.locator('[data-board-region][value="north_america"]').check();
      await page.locator('#boardRegionsSummary').click();
      const filtered = await page.evaluate(() => ({ total: boardItems().length, reasons: [...document.querySelectorAll('[data-board-admission-reason] strong')].reduce((n, el) => n + Number(el.textContent), 0), sample: boardItems().filter(event => boardAdmissionReviews(event).length).map(event => event.id).sort() }));
      assert.equal(filtered.total, filtered.reasons);
      await page.locator('[data-board-audit]').click();
      assert.deepEqual(await page.evaluate(() => boardRouteItems(periodView.route, boardItems()).map(event => event.id).sort()), filtered.sample);
      await page.locator('[data-board-back]').click();
      await page.locator('[data-board-clear]').click();
      await page.locator('#boardQuery').fill('no-match-admission-fixture');
      await page.locator('#boardQuery').press('Tab');
      assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), '0');
      await page.locator('[data-board-audit]').click();
      assert.equal(await page.locator('[data-audit-event]').count(), 0);
      await page.locator('[data-board-back]').click();
      await page.locator('[data-board-clear]').click();
      await page.evaluate(() => {
        const event = periodView.events.find(event => event.reports.some(item => item.id === 'f5e6b2ab15962df6'));
        event.reports.find(item => item.id === 'f5e6b2ab15962df6').url = 'https://example.com/changed-test';
        openBoardRoute({ type: 'event', value: event.id, parent: periodView.route });
      });
      assert.match(await page.locator('.admission-detail').innerText(), /旧意见已停用/);
      assert.equal(await page.locator('.admission-detail [data-audit-review]').count(), 0);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('[data-board-detail-event]'));
      await page.locator('[data-board-back]').click();
      await page.locator('[data-browse="overview"]').click();
      assert.equal(await page.evaluate(() => getFilteredItems(true).length), 146);
      assert.equal(await page.evaluate(() => state.payload.items.filter(item => ['daily', 'immediate'].includes(item.tier)).length), 242);
      assert.deepEqual(errors, []);
      results.push({ width, file, reasons: uiGroups, samples: 30, proposed: expectedCandidates.length, applied: 0, filtered });
      console.log(`PASS admission audit ${width} ${file}`);
      await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(root, 'preview-checks/admission-ui-results.json'), JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
