const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const model = require('../web/admission-model.js');
const overviewModel = require('../web/overview-model.js');

const root = path.resolve(__dirname, '..');
const payload = JSON.parse(fs.readFileSync(path.join(root, 'data/latest_run.json')));
const archive = JSON.parse(fs.readFileSync(path.join(root, 'data/event_archive.json')));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'config/rule_catalog.json')));
const reviewContext = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'web/admission-reviews.js'), 'utf8'), reviewContext);
const batch = JSON.parse(JSON.stringify(reviewContext.window.AIHOT_ADMISSION_REVIEWS));

function offset(day, amount) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

const rangeEnd = payload.generated_at.slice(0, 10);
const range = { start: offset(rangeEnd, -89), end: rangeEnd };
const events = overviewModel.buildEvents([...archive.items, ...payload.items], { companies: payload.companies });
const selectedEvents = events.filter(event => event.reports.some(item => model.selected(item)));
const otherEvents = events.filter(event => !event.reports.some(item => model.selected(item)));
const counts = Object.fromEntries(model.shadowCounts(otherEvents, { batch, catalog, range }));
const total = payload.items.length;
const selected = selectedEvents.length;
const other = otherEvents.length;
const retainedTotal = events.length;
const shadowReview = Object.values(counts).reduce((sum, count) => sum + count, 0);
assert.equal(shadowReview, otherEvents.filter(event => model.shadowEventReason(event, { batch, catalog, range })).length);
assert.equal(selected + other, retainedTotal);

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
      await page.waitForFunction(() => window.AIHOT_ADMISSION_UI && document.querySelector('#fusionTotals strong'));

      await page.locator('[data-page-target="methodology"]').click();
      assert.equal(await page.locator('.decision-pipeline-steps > button:visible').count(), 4);
      assert.match(await page.locator('.decision-pipeline').innerText(), /关键词与词组.*信息筛选分.*ACRO 相关性分.*信息准入与分流/s);
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('.decision-pipeline-steps > button')].every(button => button.scrollHeight <= button.clientHeight + 1)), true);
      await page.locator('.decision-pipeline [data-methodology-target="structured-extraction"]').click();
      assert.equal(await page.locator('#methodologyBreadcrumbTitle').innerText(), '关键词与词组识别');
      assert.match(await page.locator('#metric-structured-extraction').innerText(), /词组命中本身不等于入选/);
      await page.locator('#methodologyBackButton').click();

      await page.locator('.decision-pipeline [data-methodology-target="daily-admission"]').click();
      const current = await page.evaluate(() => ({
        total: Number(document.querySelector('#admissionCurrentTotal').textContent),
        selected: Number(document.querySelector('#admissionCurrentSelected').textContent),
        other: Number(document.querySelector('#admissionCurrentOther').textContent),
        review: Number(document.querySelector('#admissionShadowReview').textContent),
        retained: Number(document.querySelector('#admissionShadowRetained').textContent),
        reasons: Object.fromEntries([...document.querySelectorAll('#admissionShadowReasons button')].map(button => [button.dataset.admissionShadowOpen, Number(button.querySelector('strong').textContent)])),
      }));
      assert.deepEqual(current, { total: retainedTotal, selected, other, review: shadowReview, retained: other - shadowReview, reasons: counts });
      assert.match(await page.locator('#metric-daily-admission').innerText(), /现行 v1 · 已生效.*V1\.1 影子规则 · 未生效/s);
      await page.locator('#metric-daily-admission').screenshot({ path: path.join(root, `preview-checks/admission-pipeline-${width}.png`) });

      await page.locator('[data-admission-shadow-open=""]').click();
      assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), String(shadowReview));
      assert.match(await page.locator('.board-breadcrumbs').innerText(), /历史记录.*其他留存资料.*V1\.1 影子候选/s);
      assert.equal(await page.locator('.admission-row-reason.shadow').count(), 40);
      for (const [reason, count] of Object.entries(counts)) {
        await page.locator(`[data-board-shadow-reason="${reason}"]`).click();
        assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), String(count));
        assert.equal(await page.locator('.admission-row-reason.shadow').count(), Math.min(count, 40));
        assert.match(await page.locator('.board-breadcrumbs').innerText(), new RegExp(model.shadowLabels[reason]));
      }

      await page.locator('[data-board-shadow-reason="audit_reconsider"]').click();
      const eventId = await page.locator('#periodDetail [data-board-event]').first().getAttribute('data-board-event');
      await page.locator('#periodDetail [data-board-event]').first().click();
      assert.equal(await page.locator('[data-board-detail-event]').getAttribute('data-board-detail-event'), eventId);
      assert.match(await page.locator('.admission-shadow-status').innerText(), /V1\.1 影子判断：待复核.*未修改现行入选状态/s);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('[data-board-detail-event]'));
      await page.locator('[data-board-back]').click();
      assert.equal(await page.locator('[data-board-result-count]').getAttribute('data-board-result-count'), '5');
      assert.match(await page.locator('.board-breadcrumbs').innerText(), /抽查后建议复议/);
      assert.equal(await page.evaluate(() => state.payload.items.filter(item => ['daily', 'immediate'].includes(item.tier)).length), selected);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []);
      results.push({ width, file, ...current });
      console.log(`PASS admission pipeline ${width} ${file}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(root, 'preview-checks/admission-pipeline-results.json'), JSON.stringify(results, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
